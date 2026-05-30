"""add zones table (comunas + municipios)

Revision ID: f5a6b7c8d9e0
Revises: e4d5f6a7b8c9
Create Date: 2026-05-30 02:55:00.000000

Hand-written: autogenerate falla con GeoAlchemy2+asyncpg (ConnectionResetError ssl).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e4d5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "zones",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("number", sa.Integer(), nullable=True),
        sa.Column("center_lat", sa.Float(), nullable=True),
        sa.Column("center_lng", sa.Float(), nullable=True),
        sa.Column("color", sa.String(length=16), nullable=True),
        sa.Column(
            "geom",
            geoalchemy2.types.Geometry(
                srid=4326, spatial_index=False, from_text="ST_GeomFromEWKT", name="geometry"
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("kind", "slug", name="uq_zones_kind_slug"),
    )
    op.create_index(op.f("ix_zones_id"), "zones", ["id"], unique=False)
    op.create_index(op.f("ix_zones_kind"), "zones", ["kind"], unique=False)
    op.create_index("idx_zones_geom", "zones", ["geom"], unique=False, postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("idx_zones_geom", table_name="zones")
    op.drop_index(op.f("ix_zones_kind"), table_name="zones")
    op.drop_index(op.f("ix_zones_id"), table_name="zones")
    op.drop_table("zones")
