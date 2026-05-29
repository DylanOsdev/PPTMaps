"""Alembic environment (async, GeoAlchemy2-aware).

- Reads the DB URL from ``DATABASE_URL`` (decoupled from ``core/config.py``).
- Runs migrations over an async psycopg engine.
- Filters PostGIS-managed objects (``spatial_ref_sys``) out of autogenerate so it
  never tries to drop them.
"""

import asyncio
import os

from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool

from app.models import Base

config = context.config

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://movimed:movimed@localhost:5432/movimed",
)
config.set_main_option("sqlalchemy.url", DATABASE_URL)

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):
    # PostGIS owns this table; never let Alembic manage it.
    if type_ == "table" and name == "spatial_ref_sys":
        return False
    return True


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_offline():
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
