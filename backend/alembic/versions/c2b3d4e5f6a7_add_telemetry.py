"""add telemetry table (option B)

Revision ID: c2b3d4e5f6a7
Revises: b1a2c3d4e5f6
Create Date: 2026-05-30 00:35:00.000000

Hand-written: autogenerate falla con GeoAlchemy2+asyncpg (ConnectionResetError ssl).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

revision: str = "c2b3d4e5f6a7"
down_revision: Union[str, None] = "b1a2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "telemetry",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("speed", sa.Float(), nullable=True),
        sa.Column("heading", sa.Float(), nullable=True),
        sa.Column(
            "location",
            geoalchemy2.types.Geometry(
                geometry_type="POINT", srid=4326, spatial_index=False, from_text="ST_GeomFromEWKT", name="geometry"
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_telemetry_id"), "telemetry", ["id"], unique=False)
    op.create_index(op.f("ix_telemetry_vehicle_id"), "telemetry", ["vehicle_id"], unique=False)
    op.create_index(op.f("ix_telemetry_timestamp"), "telemetry", ["timestamp"], unique=False)
    op.create_index("idx_telemetry_location", "telemetry", ["location"], unique=False, postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("idx_telemetry_location", table_name="telemetry")
    op.drop_index(op.f("ix_telemetry_timestamp"), table_name="telemetry")
    op.drop_index(op.f("ix_telemetry_vehicle_id"), table_name="telemetry")
    op.drop_index(op.f("ix_telemetry_id"), table_name="telemetry")
    op.drop_table("telemetry")
