# ScholarMatch AI

ScholarMatch AI helps students find scholarships for which they are eligible and competitive. It combines verified eligibility rules, semantic retrieval, deterministic scoring, and grounded explanations; AI never overrides hard eligibility rules.

## Repository layout

- `frontend/` — Next.js 16, React 19, and TypeScript web application.
- `backend/` — FastAPI application scaffold and Python quality tooling.
- `docs/openapi.yaml` — source-of-truth `/api/v1` HTTP contract shared by both services.
- `docs/adr/` — accepted architecture decision records.
- `supabase/` — future database migrations and local Supabase configuration.

See [Technology Stack and Backend Architecture](docs/TECH_STACK_AND_ARCHITECTURE.md) and [Development Prompts and Delivery Timeline](docs/DEVELOPMENT_PROMPTS_AND_TIMELINE.md).

## Prerequisites

- Node.js 20.9 or newer and npm 11 or newer.
- Python 3.12 or newer.
- Supabase project URL and public/server keys.
- Qwen/DashScope API credentials for backend AI calls.

Redis is part of the accepted worker architecture but is not required by the current API scaffold. Keep every credential in an ignored local environment file; never commit one.

## Local startup

Install and start the backend:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt -r requirements-dev.txt
cp app/.env.example app/.env
# Fill app/.env with your own values.
uvicorn api.main:app --app-dir app --reload --port 8000
```

The API health check is available at `http://localhost:8000/healthz`. Interactive API docs are available at `http://localhost:8000/docs` when `ENVIRONMENT=development`.

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
- `API_V1_STR`
- `ENVIRONMENT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QWEN_API_KEY`
- `QWEN_API_URL`
- `REDIS_URL`
- `CORS_ORIGINS`

Frontend variables in `frontend/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Quality commands

Run each service's deterministic CI checks after installing its dependencies:

```bash
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

```bash
cd backend
make format-check
make lint
make typecheck
make test
make build
```

Use `npm run format` and `make format` to apply automatic formatting. The OpenAPI contract is currently checked in directly and is validated by both test suites; update `docs/openapi.yaml` before implementing or changing an endpoint.

