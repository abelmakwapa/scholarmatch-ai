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

Profile and private-document endpoints are mounted under `/api/v1/profile`. The document flow is
backend-mediated: configure a private `PRIVATE_DOCUMENT_BUCKET` and the service-role credential;
clients never receive storage paths or permanent URLs. Uploads require a SHA-256 checksum and are
bounded by the configured per-file, count, and total-byte quotas. Signed downloads expire after
`DOCUMENT_DOWNLOAD_TTL_SECONDS`.

Malware scanning, document processing, derived-content deletion, and rematching are dispatched
through interfaces. The included in-memory queue adapter is deterministic and useful for local
development/tests, but is not durable; production deployment must inject a worker-backed adapter
before running more than one process.

The public catalog endpoints are `GET /api/v1/scholarships` and
`GET /api/v1/scholarships/{scholarship_id}`. They return active, published, unexpired records and
use opaque, sort-bound cursor pagination. Catalog administration and deterministic fixture
ingestion are under `/api/v1/admin`; both require a verified application-admin JWT. The fixture
adapter is the only included source adapter, is untrusted, performs no network scraping, and
requires review before publication. Production must inject a durable queue consumer; database
claims, resume cursors, bounded attempts, quarantine, and dead-letter state form the worker-safe
boundary.

Deterministic matching is available at `GET /api/v1/matches`,
`POST /api/v1/matches/recalculate`, and `GET /api/v1/matches/{scholarship_id}`. Small catalog
workloads calculate in the request; larger workloads create an idempotent recalculation job for a
durable worker adapter. The bundled queue only records dispatch in memory and is not a production
worker. Matching never calls Qwen or another LLM. Formulas, evidence handling, GPA policy, and known
limitations are documented in [`docs/MATCHING.md`](../docs/MATCHING.md).

After an admin queues a deterministic fixture run, process one resumable batch locally with:

```bash
make run-ingestion RUN_ID=00000000-0000-0000-0000-000000000000
```

Repeat while the sanitized status is `partial`. The command selects only the fixture version
recorded on the run and refuses unapproved adapters.

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

OpenAPI endpoints (`/docs`, `/redoc`, and `/openapi.json`) exist only in the `development`
environment. Live-source adapters, durable match/ingestion worker implementations, automatic
duplicate merging, matching calculations beyond the documented deterministic MVP, derived
text/embedding generation, application endpoints, notifications, and Qwen integration remain
intentionally unimplemented.
