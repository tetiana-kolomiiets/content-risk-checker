# AI Content Risk Checker

## Overview

Backend service that analyzes text for content risk (toxicity, spam, hate speech, etc.)
using a deterministic 6-step pipeline. AI signal source is Anthropic Claude
accessed through **OpenRouter** as the LLM gateway.

## Architecture

```
HTTP → Controller → Service → Queue → Worker → PipelineRunner → 6 steps → DB
```

The six pipeline steps run in fixed order: `NORMALIZE_TEXT` →
`DETECT_DUPLICATE` → `RUN_RULE_BASED_CHECKS` → `RETRIEVE_AI_CONTEXT` →
`RUN_AI_ANALYSIS` → `AGGREGATE_RESULT`. Each step is an isolated `@Injectable`
returning a discriminated `StepResult<O>`; the runner is the only component that
knows the step order, persists `ContentRiskStepLog` rows, and decides when to
short-circuit (duplicate detection) or finalize.

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
| Service orchestration (step-based) | `src/modules/main/content-risk-checks/content-risk-checks-pipeline.service.ts` + 6 steps |
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
| Controlled LLM usage | `AiAnalysisStep` is one of 6 steps, doesn't control flow |
| LLM does NOT control flow | Pipeline order hardcoded in `ContentRiskChecksPipelineService.run` |
| Outputs validated | `AiAnalysisOutputSchema` (Zod) in `domain/content-risk-checks/schemas/ai-output.schema.ts` with retry-on-fail |
| Prompts versioned | `Prompt` model, `promptVersionId` snapshotted at create |
| Structured logging | `nestjs-pino` with `traceId` injected via AsyncLocalStorage |
| Request tracing | `TraceContext` propagates traceId from HTTP middleware → service → queue payload → worker |
| API keys (usage only) | `OPENROUTER_API_KEY` via ConfigService, redacted in Pino logs |
| Rate limiting | `@nestjs/throttler` per-endpoint via `@Throttle` decorators |
| Input validation | `class-validator` on DTOs + Zod on LLM output |
| Few-shot context injection | Stage 5 (Prompts 22–24): `RetrieveAiContextStep` + `AiAnalysisMemory` (pgvector) — backend-controlled retrieval, see [AI Memory](#ai-memory-few-shot-examples) |

## AI Memory (Few-Shot Examples)

The pipeline includes a `RETRIEVE_AI_CONTEXT` step that injects similar past
decisions as few-shot examples into the AI prompt.

How it works:

1. Past `COMPLETED` checks store their embedding + final decision in
   `AiAnalysisMemory`.
2. New checks compute an embedding for the normalized text.
3. Top-N (default 3) most similar past records (cosine ≥ 0.85) get injected as
   examples into the prompt's `{examples_section}` placeholder.
4. The AI step receives the enriched prompt; output validation is unchanged.
5. After `AGGREGATE_RESULT`, the runner persists a new memory row for the
   current check (skipped on the duplicate-detection short-circuit and when the
   embedding could not be computed).

Why this is **not** "agent magic":

- The backend deterministically decides retrieval — the LLM does not choose
  what to remember.
- Pipeline order remains hardcoded in `ContentRiskChecksPipelineService.run`.
- AI output is still Zod-validated.
- Memory persistence is a side effect of the runner, not an AI decision.

Configuration (env):

| Var | Default | Purpose |
|---|---|---|
| `AI_MEMORY_ENABLED` | `true` | Master switch for retrieval + persistence |
| `AI_MEMORY_TOP_N` | `3` | Max number of examples injected |
| `AI_MEMORY_MIN_SIMILARITY` | `0.85` | Cosine threshold for inclusion |
| `AI_EMBEDDING_MODEL` | `openai/text-embedding-3-small` | OpenRouter embedding model |
| `AI_EMBEDDING_TIMEOUT_MS` | `10000` | Per-call timeout |

Known limitations:

- Embeddings are external API calls (~$0.02/1M tokens via OpenRouter).
- Cold start: the first ~5 checks per prompt version see no examples.
- Stored snippets are not PII-aware (200 chars max).
- pgvector is required for similarity search.
- Embedding-API failure is graceful: the step returns ok with
  `examplesFound=0` and `embeddingErrorCode` populated; the AI step still runs
  with empty examples; no memory row is written.

## Rule-based scan

The third pipeline step (`RUN_RULE_BASED_CHECKS`) applies cheap deterministic
heuristics to the normalized text before any LLM call. It is **not** a robust
safety net — it is a fast pre-filter whose output feeds into the final
aggregation alongside the AI score.

What it does:

- Runs structural rules with stable IDs (`many_urls`, `char_repetition`,
  `excessive_punctuation`, `suspicious_tld`).
- Runs blacklist rules loaded at startup from `config/rules/*.json`. Each file
  is one rule (`{ id, category, weight, words[] }`) and is cached in memory by
  `RulesProvider`. Edit the JSON and restart the worker to update wordlists; no
  rebuild is required.
- Emits a per-check `score` (sum of triggered rule weights, capped at 1), a
  deduplicated list of `flags` (categories), and `flaggedFragments` ({ text,
  reason }) for downstream display.

What it explicitly does **not** do:

- It is **not** a content moderation classifier. The shipped blacklists are
  `placeholder_*` seeds — they intentionally do not contain real slurs or
  threat terms, so on production traffic the blacklist rules will essentially
  never fire on their own. The structural rules (URL counts, repetition,
  shouting, suspicious TLDs) carry the rule-based signal in practice.
- It does **not** decide the final risk level. Aggregation combines this score
  with the AI score; either signal alone is insufficient.
- It does **not** do tokenization, stemming, or fuzzy matching. Blacklist
  matching is plain lowercased substring match — adversarial obfuscation
  defeats it. That's the LLM's job.
- It does **not** hot-reload. Wordlist edits require a worker restart.

Replacing the seed wordlists with real lists is a deployment-time concern: drop
your own `*.json` files into `config/rules/`, keep the schema, and restart.
Tests inject their own `RulesProvider` via DI (see
`rule-based-scan.step.spec.ts`) so the test suite is independent of whatever
wordlists ship to production.

## Architecture Decisions

- **Ports + adapters for repositories:** allows mocking in tests, isolates Prisma to the infrastructure layer (enforced by ESLint).
- **Pipeline-as-service-of-steps:** each step is `@Injectable`, the runner composes them; LLM is one step out of 6.
- **Prompt versioning via DB:** prompts are stored with a version, activation flips `isActive`, and the chosen `promptVersionId` is snapshotted at check creation.
- **TraceId via AsyncLocalStorage:** propagates HTTP middleware → service → queue payload → worker. The worker re-enters `TraceContext.run(payload.traceId, ...)`.
- **Three-layer idempotency:** service-level fast-path → DB unique partial index → `DetectDuplicate` pipeline step → race-fallback copy on `P2002` at finalize.
- **OpenRouter as LLM gateway:** one SDK (openai) for chat completions; switching models is a config change (`LLM_MODEL`), no code change.
- **pgvector over `Float[]` for embedding similarity:** `AiAnalysisMemory.embedding` is `vector(1536)` with an HNSW cosine index (`CREATE INDEX … USING hnsw (embedding vector_cosine_ops)`), and similarity search runs in SQL via the `<=>` operator. The alternative was storing embeddings as `Float[]` (or `Json`) and computing cosine in Node. Trade-off:
  - **pgvector wins on:** indexed nearest-neighbour search (sub-linear at scale), cosine operator (`<=>`) in SQL so retrieval stays in the repository layer, and constant memory (no need to load every row into Node per check).
  - **`Float[]` would have won on:** zero infra dependency (works on stock Postgres), trivial local dev. The cost is O(N) full-scan + O(N·D) JS math per check — acceptable at a few-thousand rows but not beyond.
  - **Why pgvector here:** memory grows monotonically with traffic and replays, and we want retrieval latency bounded by an index, not by row count. The cost is one Postgres extension (`CREATE EXTENSION IF NOT EXISTS vector` in migration `20260505100000_enable_pgvector`) and a Postgres image that ships pgvector. The current `docker-compose.yml` uses stock `postgres:15`, so for that image to apply migrations it must either be swapped for `pgvector/pgvector:pg15` (or similar) or have the extension installed in the running container.
- **Language detection is not a separate step.** The LLM (Claude) handles multilingual input natively, and the rule-based heuristics support both Latin and Cyrillic alphabets. A dedicated language step would duplicate work the LLM already performs.

## Statuses

The `ContentRiskCheckStatus` enum has four values: `PENDING`, `PROCESSING`,
`COMPLETED`, `FAILED`. Two statuses sometimes seen in similar systems are
intentionally absent:

- `REJECTED` would duplicate the HTTP 400 path — DTO validation rejects bad
  input before a row is ever written to the database, so a `REJECTED` row would
  never exist.
- `CANCELLED` is out of scope for the MVP — there is no user-facing cancel
  action, and aborting an in-flight pipeline is not a supported use case.

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
