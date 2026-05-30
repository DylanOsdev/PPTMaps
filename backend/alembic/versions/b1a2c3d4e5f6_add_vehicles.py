"""add vehicles table (option B)

Revision ID: b1a2c3d4e5f6
Revises: d617cc424b41
Create Date: 2026-05-30 00:20:00.000000

Hand-written: autogenerate falla con GeoAlchemy2+asyncpg (ConnectionResetError ssl).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b1a2c3d4e5f6"
down_revision: Union[str, None] = "d617cc424b41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vehicles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plate", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "INACTIVE", "IN_MAINTENANCE", "ON_MISSION", name="vehiclestatus"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vehicles_id"), "vehicles", ["id"], unique=False)
    op.create_index(op.f("ix_vehicles_plate"), "vehicles", ["plate"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_vehicles_plate"), table_name="vehicles")
    op.drop_index(op.f("ix_vehicles_id"), table_name="vehicles")
    op.drop_table("vehicles")
    sa.Enum(name="vehiclestatus").drop(op.get_bind(), checkfirst=True)
