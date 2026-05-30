"""add weather_snapshots table

Revision ID: e4d5f6a7b8c9
Revises: d3c4e5f6a7b8
Create Date: 2026-05-30 02:25:00.000000

Hand-written: autogenerate falla con GeoAlchemy2+asyncpg (ConnectionResetError ssl).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision: str = "e4d5f6a7b8c9"
down_revision: Union[str, None] = "d3c4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weather_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("location_name", sa.String(length=120), nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.types.Geometry(
                geometry_type="POINT", srid=4326, spatial_index=False, from_text="ST_GeomFromEWKT", name="geometry"
            ),
            nullable=False,
        ),
        sa.Column("temperature_c", sa.Float(), nullable=True),
        sa.Column("humidity", sa.Float(), nullable=True),
        sa.Column("rain_mm", sa.Float(), nullable=True),
        sa.Column("precipitation_prob_2h", sa.Integer(), nullable=True),
        sa.Column("weather_code", sa.Integer(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weather_snapshots_id"), "weather_snapshots", ["id"], unique=False)
    op.create_index(op.f("ix_weather_snapshots_location_name"), "weather_snapshots", ["location_name"], unique=True)
    op.create_index("idx_weather_snapshots_geom", "weather_snapshots", ["geom"], unique=False, postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("idx_weather_snapshots_geom", table_name="weather_snapshots")
    op.drop_index(op.f("ix_weather_snapshots_location_name"), table_name="weather_snapshots")
    op.drop_index(op.f("ix_weather_snapshots_id"), table_name="weather_snapshots")
    op.drop_table("weather_snapshots")
