# AI Content Risk Checker

## Overview

Backend service that analyzes text for content risk (toxicity, spam, hate speech, etc.)
using a deterministic 5-step pipeline. AI signal source is Anthropic Claude
accessed through **OpenRouter** as the LLM gateway.

## Architecture

```
HTTP → Controller → Service → Queue → Worker → PipelineRunner → 5 steps → DB
```

The five pipeline steps run in fixed order: `NORMALIZE_TEXT` →
`DETECT_DUPLICATE` → `RUN_RULE_BASED_CHECKS` → `RUN_AI_ANALYSIS` →
`AGGREGATE_RESULT`. Each step is an isolated `@Injectable` returning a
discriminated `StepResult<O>`; the runner is the only component that knows the
step order, persists `ContentRiskStepLog` rows, and decides when to short-circuit
(duplicate detection) or finalize.

## Quickstart

1. `docker-compose up -d`
2. `npm install`
3. `cp .env.example .env` and set `OPENROUTER_API_KEY` (get one at https://openrouter.ai/keys)
4. `npm run prisma:migrate`
5. `npm run prisma:seed`
6. `npm run start:dev`
7. Open http://localhost:3000/api for Swagger

## Development

### Backend

```bash
docker-compose up -d
npm install
npm run prisma:migrate
npm run prisma:seed
npm run start:all
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

The SPA is built with React 19 + TypeScript strict + Vite + Tailwind CSS and uses
plain `fetch` in a centralized API client (`frontend/src/lib/api.ts`). UI follows a
minimal light theme with white surfaces, subtle borders, and Feather icons.

#### Frontend UX highlights

- Toast notifications for API failures and rate limiting (with countdown hints)
- Keyboard shortcuts: `Cmd/Ctrl + Enter` to submit, `r` to replay on check details
- First-visit onboarding modal persisted in `localStorage`
- Accessibility polish (labels, live status region for pipeline updates, visible focus)
- Empty states for first-time sidebar and quick-start guidance on the home screen

#### Screenshots (placeholders)

- `docs/screenshots/home-empty.png`
- `docs/screenshots/home-filled.png`
- `docs/screenshots/check-detail.png`
- `docs/screenshots/rate-limit-toast.png`

## Process modes

- `npm run start:all` — HTTP + worker in one process (default for dev)
- `npm run start:api` — HTTP only
- `npm run start:worker` — worker only

## API Reference

All endpoints are prefixed with `/api/v1` (URI versioning) and return a wrapped
envelope `{ data, error, meta }`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/content-risk-checks` | Submit text for risk analysis (returns 202) |
| `GET`  | `/api/v1/content-risk-checks/:id` | Read a check + its analysis result |
| `GET`  | `/api/v1/content-risk-checks` | List checks (optional `?status=…`) |
| `GET`  | `/api/v1/content-risk-checks/:id/logs` | Read step execution logs |
| `POST` | `/api/v1/content-risk-checks/:id/replay` | Re-run with the current active prompt |
| `POST` | `/api/v1/prompts/:id/activate` | Activate a prompt version |
| `GET`  | `/api/v1/health` | Liveness/readiness |

Example — submit a check:

```bash
curl -X POST http://localhost:3000/api/v1/content-risk-checks \
  -H "content-type: application/json" \
  -d '{"text":"hello world"}'
```

```json
{
  "data": {
    "id": "5e6b…",
    "status": "PENDING",
    "rawText": "hello world",
    "contentHash": "b94d…",
    "retryCount": 0,
    "maxRetries": 3
  },
  "error": null,
  "meta": {
    "traceId": "a4f1…",
    "apiVersion": "v1",
    "timestamp": "2026-05-05T12:00:00.000Z"
  }
}
```

## PDP Coverage Map

### Phase 2: Backend Workflows

| PDP requirement | File / feature |
|---|---|
| Service orchestration (step-based) | `src/modules/main/content-risk-checks/content-risk-checks-pipeline.service.ts` + 5 steps |
| Background processing | `src/modules/main/content-risk-checks/content-risk-checks.processor.ts` (BullMQ WorkerHost) |
| Queue-based execution | BullMQ in `src/modules/queue/queue.module.ts` |
| Each step isolated | `src/modules/main/content-risk-checks/pipeline/steps/*.step.ts`, one class per step |
| Failures handled per step | `StepResult<O>` discriminated union in `pipeline/contracts/step-result.type.ts` |
| Logs describe full execution path | `ContentRiskStepLog` model + Pino with traceId |
| Long-running jobs | BullMQ with 3 attempts, exponential backoff (`queue.module.ts`) |
| Idempotent jobs | sha256 contentHash + DB unique partial index + DetectDuplicate step |
| Jobs can be replayed | `POST /:id/replay` in `content-risk-checks.controller.ts` + `replayOfCheckId` |

### Phase 3: AI Integration

| PDP requirement | File / feature |
|---|---|
| Unified API, consistent envelope | `src/common/interceptors/response.interceptor.ts` + `src/common/filters/all-exceptions.filter.ts` |
| API versioning | URI versioning in `src/bootstrap/http.bootstrap.ts`, all endpoints under `/api/v1/` |
| Controlled LLM usage | `AiAnalysisStep` is one of 5 steps, doesn't control flow |
| LLM does NOT control flow | Pipeline order hardcoded in `ContentRiskChecksPipelineService.run` |
| Outputs validated | `AiAnalysisOutputSchema` (Zod) in `domain/content-risk-checks/schemas/ai-output.schema.ts` with retry-on-fail |
| Prompts versioned | `Prompt` model, `promptVersionId` snapshotted at create |
| Structured logging | `nestjs-pino` with `traceId` injected via AsyncLocalStorage |
| Request tracing | `TraceContext` propagates traceId from HTTP middleware → service → queue payload → worker |
| API keys (usage only) | `OPENROUTER_API_KEY` via ConfigService, redacted in Pino logs |
| Rate limiting | `@nestjs/throttler` per-endpoint via `@Throttle` decorators |
| Input validation | `class-validator` on DTOs + Zod on LLM output |

## Architecture Decisions

- **Ports + adapters for repositories:** allows mocking in tests, isolates Prisma to the infrastructure layer (enforced by ESLint).
- **Pipeline-as-service-of-steps:** each step is `@Injectable`, the runner composes them; LLM is one step out of 5.
- **Prompt versioning via DB:** prompts are stored with a version, activation flips `isActive`, and the chosen `promptVersionId` is snapshotted at check creation.
- **TraceId via AsyncLocalStorage:** propagates HTTP middleware → service → queue payload → worker. The worker re-enters `TraceContext.run(payload.traceId, ...)`.
- **Three-layer idempotency:** service-level fast-path → DB unique partial index → `DetectDuplicate` pipeline step → race-fallback copy on `P2002` at finalize.
- **OpenRouter as LLM gateway:** one SDK (openai) for chat completions; switching models is a config change (`LLM_MODEL`), no code change.

## Known Limitations (MVP)

- Rate limiting is in-memory; multi-instance deployments need a Redis-based throttler.
- Prompt cache TTL is 60 s; activation propagation lag of up to 60 s across workers.
- Worker can run as a separate process (`npm run start:worker`), but the default dev mode is combined.
- LLM gateway is OpenRouter; switching to direct Anthropic only requires swapping the `LlmClient` adapter — the interface is stable.

## Production Notes

- Build frontend with `cd frontend && npm run build` and serve `frontend/dist` behind
  the API domain or a reverse proxy.
- Set `VITE_API_BASE_URL` in frontend environment to point to the production
  `/api/v1` endpoint.
- Keep CORS and CSP aligned with your deployed frontend origin.
- Current backend throttling is in-memory; for multi-instance production, replace
  with Redis-backed throttling.

## Testing

- `npm run test` — unit tests (`*.spec.ts` under `src/`)
- `npm run test:e2e` — end-to-end tests against a real Postgres + Redis

The e2e suite expects the test infra to be up:

```bash
docker-compose -f docker-compose.test.yml up -d
npm run test:e2e
```

The e2e config sets `DATABASE_URL` to the test Postgres on port `5434` and Redis
on port `6380`, then runs `prisma db push` to apply the schema before the suite
starts. The LLM client is overridden via Nest's `overrideProvider(LLM_CLIENT)`,
so no real OpenRouter calls are made.
