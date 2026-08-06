# ScholarMatch AI

ScholarMatch AI helps students find scholarships for which they are eligible and competitive. It combines verified eligibility rules, semantic retrieval, deterministic scoring, and grounded explanations; AI never overrides hard eligibility rules.

## Repository layout

- `frontend/` — Next.js 16, React 19, and TypeScript web application.
- `backend/` — typed FastAPI application and PostgreSQL repository foundation.
- `docs/openapi.yaml` — source-of-truth `/api/v1` HTTP contract shared by both services.
- `docs/adr/` — accepted architecture decision records.
- `supabase/` — PostgreSQL migrations, RLS policies, data dictionary, and rollback notes.

See [Technology Stack and Backend Architecture](docs/TECH_STACK_AND_ARCHITECTURE.md) and [Development Prompts and Delivery Timeline](docs/DEVELOPMENT_PROMPTS_AND_TIMELINE.md).

## Prerequisites

- Node.js 20.9 or newer and npm 11 or newer.
- Python 3.12.13 (pinned in `backend/.python-version`).
- Supabase project URL and public/server keys.
- Qwen/DashScope API credentials for backend AI calls.

Redis is part of the accepted worker architecture but is not required by the current API scaffold. Keep every credential in an ignored local environment file; never commit one.

## Local startup

Install and start the backend:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
make install
cp app/.env.example app/.env
# Fill app/.env with your own values when integration readiness is required.
make run
```

The canonical ASGI import is `app.main:app`. Liveness is available at
`http://localhost:8000/healthz`; readiness is available at
`http://localhost:8000/readyz`. Readiness returns `503` until the configured Supabase,
Qwen, and Redis dependencies have their required settings. Interactive docs and
`/openapi.json` are available only when `ENVIRONMENT=development`.

In a second terminal, install and start the frontend:

```bash
cd frontend
npm ci
cp .env.example .env.local
# Fill .env.local with your own values.
npm run dev
```

Open `http://localhost:3000`. The frontend example contains only browser-safe variables. Never add a Supabase service-role key or Qwen key to a `NEXT_PUBLIC_` variable.

## Environment variables

Backend variables in `backend/app/.env`:

- `PROJECT_NAME`
- `API_V1_PREFIX`
- `ENVIRONMENT`
- `LOG_LEVEL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `SUPABASE_JWT_ISSUER` (optional override)
- `SUPABASE_JWKS_URL` (optional override)
- `SUPABASE_JWT_AUDIENCE`
- `JWKS_CACHE_TTL_SECONDS`
- `JWKS_MAX_STALE_SECONDS`
- `JWKS_HTTP_TIMEOUT_SECONDS`
- `QWEN_API_KEY`
- `QWEN_API_URL`
- `REDIS_URL`
- `CORS_ALLOWED_ORIGINS`

Frontend variables in `frontend/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_OBSERVABILITY_ENDPOINT` (optional same-origin path; leave blank to disable reporting)

## Quality commands

Run each service's deterministic CI checks after installing its dependencies:

```bash
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run performance:budget
npm run test:e2e:chromium
```

```bash
cd backend
make install
make format-check
make lint
make typecheck
make test
make build
```

Run the isolated PostgreSQL migration, RLS, index, and unit-of-work tests with
`TEST_DATABASE_URL=<disposable-admin-dsn> make test-db`. See
[`supabase/README.md`](supabase/README.md) before applying migrations.

Use `npm run format` and `make format` to apply automatic formatting. `make quality`
runs every backend verification check. The OpenAPI contract is currently checked in
directly and is validated by both test suites; update `docs/openapi.yaml` before
implementing or changing an endpoint.
