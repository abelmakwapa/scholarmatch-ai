import argparse
import asyncio
import json
from uuid import UUID

from app.core.config import get_settings
from app.db.unit_of_work import PostgresDatabase
from app.services.ingestion import IngestionOrchestrator


async def _run_fixture_batch(run_id: UUID) -> None:
    database = PostgresDatabase.from_settings(get_settings())
    await database.open()
    try:
        result = await IngestionOrchestrator(database).run_fixture_batch(run_id)
    finally:
        await database.close()
    print(
        json.dumps(
            {
                "run_id": str(result.id),
                "status": result.status,
                "resume_cursor": result.resume_cursor,
                "counters": result.counters,
                "safe_errors": result.safe_errors,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run one approved fixture ingestion batch.")
    parser.add_argument("--run-id", required=True, type=UUID)
    arguments = parser.parse_args()
    asyncio.run(_run_fixture_batch(arguments.run_id))


if __name__ == "__main__":
    main()
