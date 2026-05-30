"""add alerts table (option B)

Revision ID: d3c4e5f6a7b8
Revises: c2b3d4e5f6a7
Create Date: 2026-05-30 00:45:00.000000

Hand-written: autogenerate falla con GeoAlchemy2+asyncpg (ConnectionResetError ssl).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d3c4e5f6a7b8"
down_revision: Union[str, None] = "c2b3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column(
            "severity",
            sa.Enum("INFO", "WARNING", "CRITICAL", name="alertseverity"),
            nullable=False,
        ),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("is_resolved", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alerts_id"), "alerts", ["id"], unique=False)
    op.create_index(op.f("ix_alerts_vehicle_id"), "alerts", ["vehicle_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_alerts_vehicle_id"), table_name="alerts")
    op.drop_index(op.f("ix_alerts_id"), table_name="alerts")
    op.drop_table("alerts")
    sa.Enum(name="alertseverity").drop(op.get_bind(), checkfirst=True)
