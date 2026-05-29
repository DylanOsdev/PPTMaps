"""Declarative base for all ORM models.

Kept independent from ``core/database.py`` (engine/session, Part 1) so models and
migrations can be developed without coupling to the runtime database wiring.
"""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Shared declarative base. Import models so they register on this metadata."""


class TimestampMixin:
    """Adds server-managed created/updated timestamps."""

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
