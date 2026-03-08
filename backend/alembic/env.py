import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# --------------------------------------------------------------------------
# App imports — must come after sys.path is set up correctly.
# Running `alembic` from inside `backend/` (where alembic.ini lives) means
# the `app` package is already on the path.
# --------------------------------------------------------------------------
from app.database import Base  # noqa: E402
from app import models  # noqa: F401 — registers all ORM models against Base
from app.config import settings  # loads DATABASE_URL from .env via pydantic-settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Point Alembic at our full schema so autogenerate works.
target_metadata = Base.metadata

# Use settings.DATABASE_URL (loaded from .env by pydantic-settings).
# os.environ.get() does NOT read from .env files — settings does.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL to stdout)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
