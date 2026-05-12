# AI Content Risk Checker

Backend service that analyzes text for content risk (toxicity, spam, hate speech, scam, etc.) using a deterministic pipeline that combines rule-based heuristics with a Claude-powered AI step (via OpenRouter). Requests are accepted over HTTP and processed asynchronously through a BullMQ worker.

**Stack:** NestJS 11, TypeScript, PostgreSQL 15 + pgvector, Prisma, BullMQ + Redis, Pino, Zod. Frontend: React 19 + Vite + Tailwind.

This repository is a **yarn workspaces monorepo**:

- [apps/backend/](apps/backend/) — NestJS backend (HTTP API + worker)
- [apps/frontend/](apps/frontend/) — React + Vite frontend

A single `yarn.lock` at the root covers both workspaces; both use yarn.

## Quickstart (full stack in one command)

```bash
docker-compose up -d
yarn install
cp apps/backend/.env.example apps/backend/.env   # set OPENROUTER_API_KEY (https://openrouter.ai/keys)
yarn prisma:migrate
yarn prisma:seed
yarn dev                                         # runs backend + frontend together
```

- Backend Swagger: [http://localhost:3000/api](http://localhost:3000/api)
- Frontend: [http://localhost:5173](http://localhost:5173)

## Scripts (run from repo root)

### Run

| Script | Purpose |
|---|---|
| `yarn dev` | Backend (watch) + frontend (vite) together via `concurrently` |
| `yarn backend:dev` | Backend only, watch mode (combined HTTP + worker) |
| `yarn frontend:dev` | Frontend only (vite dev server) |

For production-style backend processes (after `yarn backend:build`), run them inside `apps/backend/`:

```bash
cd apps/backend
node dist/main.api.js       # HTTP only
node dist/main.worker.js    # worker only
node dist/main.js           # HTTP + worker in one process
```

### Build

| Script | Purpose |
|---|---|
| `yarn backend:build` | Compile backend TypeScript via `nest build` (output: `apps/backend/dist/`) |
| `yarn frontend:build` | Build frontend for production (output: `apps/frontend/dist/`) |

### Database

| Script | Purpose |
|---|---|
| `yarn prisma:generate` | Regenerate the Prisma client |
| `yarn prisma:migrate` | Apply pending migrations (`prisma migrate dev`) |
| `yarn prisma:seed` | Seed the database (initial prompt, etc.) |

### Quality

| Script | Purpose |
|---|---|
| `yarn backend:lint` | ESLint backend with `--fix` |
| `yarn frontend:lint` | ESLint frontend |
| `yarn backend:test` | Run backend unit tests (`*.spec.ts` under `apps/backend/src/`) |
| `yarn backend:test:e2e` | Run backend e2e tests (requires test infra, see Testing) |

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
yarn backend:test          # unit tests
yarn backend:test:e2e      # end-to-end (needs test infra up, see below)
```

For e2e:

```bash
docker-compose -f docker-compose.test.yml up -d
yarn backend:test:e2e
```

The LLM client is overridden in e2e tests, so no real OpenRouter calls are made.
