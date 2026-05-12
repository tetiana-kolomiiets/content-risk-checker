# AI Content Risk Checker

Backend service that analyzes text for content risk (toxicity, spam, hate speech, scam, etc.) using a deterministic pipeline that combines rule-based heuristics with a Claude-powered AI step (via OpenRouter). Requests are accepted over HTTP and processed asynchronously through a BullMQ worker.

**Stack:** NestJS 11, TypeScript, PostgreSQL 15 + pgvector, Prisma, BullMQ + Redis, Pino, Zod. Frontend: React 19 + Vite + Tailwind.

## Quickstart (full stack in one command)

```bash
docker-compose up -d
yarn install
yarn frontend:install
cp .env.example .env          # set OPENROUTER_API_KEY (https://openrouter.ai/keys)
yarn prisma:migrate
yarn prisma:seed
yarn dev                      # runs backend + frontend together
```

- Backend Swagger: [http://localhost:3000/api](http://localhost:3000/api)
- Frontend: [http://localhost:5173](http://localhost:5173)

## Scripts

### Run

| Script | Purpose |
|---|---|
| `yarn dev` | Run backend (watch) + frontend (vite) together via `concurrently` |
| `yarn start:dev` | Backend only, watch mode (combined HTTP + worker) |
| `yarn frontend:dev` | Frontend only (`cd frontend && npm run dev`) |
| `yarn start:all` | HTTP + worker in one prod-built process (requires `yarn build` first) |
| `yarn start:api` | HTTP only, prod build (requires `yarn build` first) |
| `yarn start:worker` | Worker only, prod build (requires `yarn build` first) |

### Build & install

| Script | Purpose |
|---|---|
| `yarn build` | Compile TypeScript via `nest build` (outputs to `dist/`) |
| `yarn frontend:install` | `cd frontend && npm install` |

### Database

| Script | Purpose |
|---|---|
| `yarn prisma:generate` | Regenerate the Prisma client |
| `yarn prisma:migrate` | Apply pending migrations (`prisma migrate dev`) |
| `yarn prisma:seed` | Seed the database (initial prompt, etc.) |

### Quality

| Script | Purpose |
|---|---|
| `yarn lint` | Run ESLint with `--fix` |
| `yarn test` | Run unit tests (`*.spec.ts` under `src/`) |
| `yarn test:e2e` | Run end-to-end tests (requires test infra, see Testing) |

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
yarn test                  # unit tests
yarn test:e2e              # end-to-end (needs test infra up, see below)
```

For e2e:

```bash
docker-compose -f docker-compose.test.yml up -d
yarn test:e2e
```

The LLM client is overridden in e2e tests, so no real OpenRouter calls are made.
