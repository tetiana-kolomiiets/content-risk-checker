import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureHttpApp } from '../../src/bootstrap/http.bootstrap';
import { ContentRiskCheckStatus } from '../../src/domain/content-risk-checks/enums/content-risk-check-status.enum';
import { ContentRiskStepName } from '../../src/domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../src/domain/content-risk-checks/enums/step-execution-status.enum';
import {
  LLM_CLIENT,
  LlmClient,
  LlmCompletionOutput,
} from '../../src/infrastructure/llm/llm.types';
import { PrismaService } from '../../src/infrastructure/postgres/prisma/prisma.service';
import { PROMPTS_REPOSITORY } from '../../src/infrastructure/postgres/ports/prompts.repository';

interface ApiEnvelope<T> {
  data: T;
  error: null | { code: string; message: string; details?: unknown };
  meta: { traceId: string; apiVersion: 'v1'; timestamp: string };
}

interface CheckShape {
  id: string;
  status: ContentRiskCheckStatus;
  retryCount: number;
  replayOfCheckId?: string | null;
  duplicateOfCheckId?: string | null;
  analysisResult?: {
    finalRiskLevel: string;
    categories: string[];
    summary: string | null;
  } | null;
}

const VALID_AI_RESPONSE = {
  finalLevel: 'LOW',
  categories: [],
  score: 0.1,
  rationale: 'Looks fine.',
  flaggedFragments: [],
};

const ACTIVE_PROMPT_NAME = 'content-risk-analysis';
const SEED_TEMPLATE = JSON.stringify({
  system: 'You are a moderator. Reply ONLY with JSON.',
  userTemplate: 'Flags: {rule_flags}\nText: {text}',
});

async function pollUntilFinal(
  http: ReturnType<typeof request>,
  id: string,
  timeoutMs = 10_000,
): Promise<ApiEnvelope<CheckShape>> {
  const start = Date.now();
  let lastBody: ApiEnvelope<CheckShape> | undefined;
  while (Date.now() - start < timeoutMs) {
    const res = await http.get(`/api/v1/content-risk-checks/${id}`).expect(200);
    const body = res.body as ApiEnvelope<CheckShape>;
    lastBody = body;
    const status = body.data.status;
    if (
      status === ContentRiskCheckStatus.COMPLETED ||
      status === ContentRiskCheckStatus.FAILED
    ) {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Timed out waiting for check ${id} to reach a terminal state. Last status: ${
      lastBody?.data.status ?? 'unknown'
    }`,
  );
}

const llmMock: jest.Mocked<LlmClient> = {
  complete: jest.fn(),
};

const respondValid = (): LlmCompletionOutput => ({
  content: JSON.stringify(VALID_AI_RESPONSE),
  tokensIn: 50,
  tokensOut: 25,
  finishReason: 'stop',
});

describe('Content risk checks (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule.forRoot({ enableWorker: true })],
    })
      .overrideProvider(LLM_CLIENT)
      .useValue(llmMock)
      .compile();

    app = module.createNestApplication();
    configureHttpApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    llmMock.complete.mockReset();
    llmMock.complete.mockResolvedValue(respondValid());

    // Reset the prompt cache so freshly-seeded rows are picked up.
    app.get<{ invalidateCache: (name?: string) => void }>(PROMPTS_REPOSITORY)
      .invalidateCache();

    await prisma.contentRiskStepLog.deleteMany();
    await prisma.contentRiskAnalysisResult.deleteMany();
    await prisma.contentRiskCheck.deleteMany();
    await prisma.prompt.deleteMany();

    await prisma.prompt.create({
      data: {
        name: ACTIVE_PROMPT_NAME,
        version: 1,
        template: SEED_TEMPLATE,
        model: 'anthropic/claude-opus-4-5',
        isActive: true,
      },
    });
  });

  it('happy path: POST → poll until COMPLETED → 5 step logs, all COMPLETED, traceId consistent, envelope wrapped', async () => {
    const traceId = 'trace-happy-path';

    const post = await request(server)
      .post('/api/v1/content-risk-checks')
      .set('x-trace-id', traceId)
      .send({ text: 'a calm and harmless message' })
      .expect(202);

    const postBody = post.body as ApiEnvelope<CheckShape>;
    expect(postBody.error).toBeNull();
    expect(postBody.meta.apiVersion).toBe('v1');
    expect(postBody.meta.traceId).toBe(traceId);
    expect(postBody.data.id).toMatch(/^[0-9a-f-]+$/);

    const finalRes = await pollUntilFinal(request(server), postBody.data.id);
    expect(finalRes.data.status).toBe(ContentRiskCheckStatus.COMPLETED);
    expect(finalRes.data.analysisResult).toBeTruthy();

    const logsRes = await request(server)
      .get(`/api/v1/content-risk-checks/${postBody.data.id}/logs`)
      .expect(200);
    const logsBody = logsRes.body as ApiEnvelope<
      Array<{ stepName: ContentRiskStepName; status: StepExecutionStatus; traceId: string }>
    >;

    const completedSteps = logsBody.data.filter(
      (l) => l.status === StepExecutionStatus.COMPLETED,
    );
    const stepNames = completedSteps.map((l) => l.stepName);
    expect(stepNames).toEqual(
      expect.arrayContaining([
        ContentRiskStepName.NORMALIZE_TEXT,
        ContentRiskStepName.DETECT_DUPLICATE,
        ContentRiskStepName.RUN_RULE_BASED_CHECKS,
        ContentRiskStepName.RUN_AI_ANALYSIS,
        ContentRiskStepName.AGGREGATE_RESULT,
        ContentRiskStepName.PERSIST_AI_MEMORY,
      ]),
    );
    expect(completedSteps.length).toBeGreaterThanOrEqual(6);

    for (const log of logsBody.data) {
      expect(log.traceId).toBe(traceId);
    }
  });

  it('failure path: invalid LLM JSON always → check is FAILED, AI step FAILED with AI_VALIDATION_FAILED, retryCount === maxRetries', async () => {
    llmMock.complete.mockResolvedValue({
      content: 'not even json',
      tokensIn: 5,
      tokensOut: 5,
      finishReason: 'stop',
    });

    const post = await request(server)
      .post('/api/v1/content-risk-checks')
      .send({ text: 'this will fail validation' })
      .expect(202);
    const created = (post.body as ApiEnvelope<CheckShape>).data;

    const finalRes = await pollUntilFinal(request(server), created.id, 20_000);
    expect(finalRes.data.status).toBe(ContentRiskCheckStatus.FAILED);

    const logsRes = await request(server)
      .get(`/api/v1/content-risk-checks/${created.id}/logs`)
      .expect(200);
    const logs = (
      logsRes.body as ApiEnvelope<
        Array<{
          stepName: ContentRiskStepName;
          status: StepExecutionStatus;
          errorMessage: string | null;
        }>
      >
    ).data;

    const aiFailed = logs.find(
      (l) =>
        l.stepName === ContentRiskStepName.RUN_AI_ANALYSIS &&
        l.status === StepExecutionStatus.FAILED,
    );
    expect(aiFailed).toBeDefined();
    expect(aiFailed?.errorMessage ?? '').toContain('AI_VALIDATION_FAILED');

    // BullMQ retried up to its 3 attempts; the check's retryCount is bumped on each retry.
    const dbCheck = await prisma.contentRiskCheck.findUnique({
      where: { id: created.id },
    });
    expect(dbCheck?.retryCount).toBe(dbCheck?.maxRetries);

    // The processor's onFailed handler writes a final FAILED step log marking exhaustion.
    const finalFailedLog = logs.find(
      (l) =>
        l.status === StepExecutionStatus.FAILED &&
        (l.errorMessage ?? '').includes('Pipeline exhausted retries'),
    );
    expect(finalFailedLog).toBeDefined();
  });

  it('idempotency: POST same text twice → same checkId and only one COMPLETED row', async () => {
    const text = 'an idempotent payload';

    const first = await request(server)
      .post('/api/v1/content-risk-checks')
      .send({ text })
      .expect(202);
    const firstId = (first.body as ApiEnvelope<CheckShape>).data.id;
    await pollUntilFinal(request(server), firstId);

    const second = await request(server)
      .post('/api/v1/content-risk-checks')
      .send({ text })
      .expect(202);
    const secondId = (second.body as ApiEnvelope<CheckShape>).data.id;

    expect(secondId).toBe(firstId);

    const completedRows = await prisma.contentRiskCheck.findMany({
      where: { status: ContentRiskCheckStatus.COMPLETED },
    });
    expect(completedRows).toHaveLength(1);
    expect(completedRows[0]!.id).toBe(firstId);
  });

  it('replay: complete a check, activate a new prompt version, POST /replay → new check eventually COMPLETED with replayOfCheckId set', async () => {
    const text = 'a payload to replay';
    const original = await request(server)
      .post('/api/v1/content-risk-checks')
      .send({ text })
      .expect(202);
    const originalId = (original.body as ApiEnvelope<CheckShape>).data.id;
    await pollUntilFinal(request(server), originalId);

    // Activate a new prompt version → triggers replay-with-new-prompt log.
    const newPrompt = await prisma.prompt.create({
      data: {
        name: ACTIVE_PROMPT_NAME,
        version: 2,
        template: SEED_TEMPLATE,
        model: 'anthropic/claude-opus-4-5',
        isActive: false,
      },
    });
    await request(server)
      .post(`/api/v1/prompts/${newPrompt.id}/activate`)
      .expect((res) => {
        if (res.status !== 200 && res.status !== 201) {
          throw new Error(`unexpected activation status ${res.status}`);
        }
      });

    // Belt-and-braces: invalidate the per-process prompt cache so the freshly
    // activated prompt is read on the very next request.
    app.get<{ invalidateCache: (name?: string) => void }>(PROMPTS_REPOSITORY)
      .invalidateCache(ACTIVE_PROMPT_NAME);

    const replay = await request(server)
      .post(`/api/v1/content-risk-checks/${originalId}/replay`)
      .expect(202);
    const replayId = (replay.body as ApiEnvelope<CheckShape>).data.id;
    expect(replayId).not.toBe(originalId);

    const finalRes = await pollUntilFinal(request(server), replayId);
    expect(finalRes.data.status).toBe(ContentRiskCheckStatus.COMPLETED);
    expect(finalRes.data.replayOfCheckId).toBe(originalId);

    const replayRow = await prisma.contentRiskCheck.findUnique({
      where: { id: replayId },
    });
    expect(replayRow?.promptVersionId).toBe(newPrompt.id);
  });

  it('race fallback: 5 concurrent POSTs same text → 1 canonical COMPLETED, 4 with duplicateOfCheckId, 5 analysisResult rows', async () => {
    const text = 'race-condition-test-text-' + randomUUID();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(server).post('/api/v1/content-risk-checks').send({ text }),
      ),
    );

    const ids = responses.map(
      (r) => (r.body as ApiEnvelope<CheckShape>).data.id,
    );
    expect(new Set(ids).size).toBe(5);

    const finals = await Promise.all(
      ids.map((id) => pollUntilFinal(request(server), id)),
    );

    finals.forEach((f) =>
      expect(f.data.status).toBe(ContentRiskCheckStatus.COMPLETED),
    );

    const canonical = finals.filter((f) => !f.data.duplicateOfCheckId);
    expect(canonical).toHaveLength(1);

    const duplicates = finals.filter((f) => f.data.duplicateOfCheckId);
    expect(duplicates).toHaveLength(4);
    duplicates.forEach((d) =>
      expect(d.data.duplicateOfCheckId).toBe(canonical[0]!.data.id),
    );

    const results = await prisma.contentRiskAnalysisResult.findMany({
      where: { checkId: { in: ids } },
    });
    expect(results).toHaveLength(5);
    expect(new Set(results.map((r) => r.summary)).size).toBe(1);
  });
});
