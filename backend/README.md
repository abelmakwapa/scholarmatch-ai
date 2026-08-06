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
PostgreSQL, and Redis are configured. JWT issuer and JWKS URLs are derived from
`SUPABASE_URL` unless explicitly overridden. Do not commit `app/.env`.

The PostgreSQL connection uses `DATABASE_URL`. The API validates Supabase access tokens against
`SUPABASE_JWKS_URL` (or the URL derived from `SUPABASE_URL`) with issuer
`SUPABASE_JWT_ISSUER` and audience `SUPABASE_JWT_AUDIENCE`.

## Verify

```bash
cd backend
make quality
```

Individual commands are `make format-check`, `make lint`, `make typecheck`, `make test`,
and `make build`. Use `make format` to apply Ruff formatting and safe lint fixes.

PostgreSQL integration tests create and drop uniquely named temporary databases. Point them only at
a disposable local administrator database:

```bash
docker run --rm --detach --name scholarmatch-postgres \
  -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:55432:5432 postgres:16-alpine
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres make test-db
docker stop scholarmatch-postgres
```

Supabase migration commands and the persistence documentation are in
[`supabase/README.md`](../supabase/README.md).

OpenAPI endpoints (`/docs`, `/redoc`, and `/openapi.json`) exist only in the
`development` environment. The current work provides persistence and authorization infrastructure
only. Profile/document services, scholarship endpoints, matching calculations, workers, storage,
notifications, and external service clients remain intentionally unimplemented.
