import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import make_conninfo

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
BOOTSTRAP = REPOSITORY_ROOT / "supabase" / "tests" / "bootstrap_local_postgres.sql"
MIGRATIONS = tuple(sorted((REPOSITORY_ROOT / "supabase" / "migrations").glob("*.sql")))


def apply_sql_file(connection: psycopg.Connection[tuple[object, ...]], path: Path) -> None:
    connection.execute(path.read_text(encoding="utf-8"), prepare=False)


@pytest.fixture
def isolated_database_url() -> Iterator[str]:
    admin_url = os.getenv("TEST_DATABASE_URL")
    if not admin_url:
        pytest.skip("TEST_DATABASE_URL is not configured")

    database_name = f"scholarmatch_test_{uuid4().hex}"
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("create database {}").format(sql.Identifier(database_name)))

    database_url = make_conninfo(admin_url, dbname=database_name)
    try:
        yield database_url
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin:
            admin.execute(
                "select pg_terminate_backend(pid) from pg_stat_activity "
                "where datname = %s and pid <> pg_backend_pid()",
                (database_name,),
            )
            admin.execute(sql.SQL("drop database {}").format(sql.Identifier(database_name)))


@pytest.fixture
def migrated_database_url(isolated_database_url: str) -> str:
    with psycopg.connect(isolated_database_url, autocommit=True) as connection:
        apply_sql_file(connection, BOOTSTRAP)
        for migration in MIGRATIONS:
            apply_sql_file(connection, migration)
    return isolated_database_url
