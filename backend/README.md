# ScholarMatch backend

The backend is a Python 3.12.13 FastAPI scaffold. Its single ASGI entry point is
`app.main:app`.

## Run locally

```bash
cd backend
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
make install
cp app/.env.example app/.env
make run
```

The safe example configuration permits startup without credentials. `/healthz` then
reports that the process is alive, while `/readyz` reports `503` until Supabase, Qwen,
and Redis are configured. Do not commit `app/.env`.

## Verify

```bash
cd backend
make quality
```

Individual commands are `make format-check`, `make lint`, `make typecheck`, `make test`,
and `make build`. Use `make format` to apply Ruff formatting and safe lint fixes.

OpenAPI endpoints (`/docs`, `/redoc`, and `/openapi.json`) exist only in the
`development` environment. Domain endpoints, database migrations, authentication,
authorization, persistence, workers, and external service clients are intentionally
outside this foundation scaffold.
