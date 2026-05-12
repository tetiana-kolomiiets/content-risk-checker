# AI Content Risk Checker

Backend service that analyzes text for content risk (toxicity, spam, hate speech, scam, etc.) using a deterministic pipeline that combines rule-based heuristics with a Claude-powered AI step (via OpenRouter). Requests are accepted over HTTP and processed asynchronously through a BullMQ worker.

**Stack:** NestJS 11, TypeScript, PostgreSQL 15 + pgvector, Prisma, BullMQ + Redis, Pino, Zod.

## Quickstart

```bash
docker-compose up -d
npm install
cp .env.example .env          # set OPENROUTER_API_KEY (https://openrouter.ai/keys)
npm run prisma:migrate
npm run prisma:seed
npm run start:all
```

Open [http://localhost:3000/api](http://localhost:3000/api) for Swagger.

## Process modes

- `npm run start:all` — HTTP + worker in one process (default for dev)
- `npm run start:api` — HTTP only
- `npm run start:worker` — worker only

## API Reference

All endpoints are prefixed with `/api/v1` and return `{ data, error, meta }`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/content-risk-checks` | Submit text for risk analysis (returns 202) |
| `GET`  | `/api/v1/content-risk-checks/:id` | Read a check + its analysis result |
| `GET`  | `/api/v1/content-risk-checks` | List checks (optional `?status=…`) |
| `GET`  | `/api/v1/content-risk-checks/:id/logs` | Read step execution logs |
| `POST` | `/api/v1/content-risk-checks/:id/replay` | Re-run with the current active prompt |
| `POST` | `/api/v1/prompts/:id/activate` | Activate a prompt version |
| `GET`  | `/api/v1/health` | Liveness/readiness |

Submit a check:

```bash
curl -X POST http://localhost:3000/api/v1/content-risk-checks \
  -H "content-type: application/json" \
  -d '{"text":"hello world"}'
```

## Testing

```bash
npm run test                  # unit tests
npm run test:e2e              # end-to-end (needs test infra up, see below)
```

For e2e:

```bash
docker-compose -f docker-compose.test.yml up -d
npm run test:e2e
```

The LLM client is overridden in e2e tests, so no real OpenRouter calls are made.
