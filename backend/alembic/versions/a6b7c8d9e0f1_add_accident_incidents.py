"""add accident_incidents table

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-05-30 10:10:00.000000

Hand-written: autogenerate falla con GeoAlchemy2+asyncpg (ConnectionResetError ssl).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accident_incidents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("llave", sa.String(length=40), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("incident_date", sa.Date(), nullable=True),
        sa.Column("incident_hour", sa.String(length=20), nullable=True),
        sa.Column("incident_class", sa.String(length=40), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=True),
        sa.Column("comuna", sa.String(length=60), nullable=True),
        sa.Column("barrio", sa.String(length=80), nullable=True),
        sa.Column(
            "geom",
            geoalchemy2.types.Geometry(
                geometry_type="POINT", srid=4326, spatial_index=False, from_text="ST_GeomFromEWKT", name="geometry"
            ),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accident_incidents_id"), "accident_incidents", ["id"], unique=False)
    op.create_index(op.f("ix_accident_incidents_llave"), "accident_incidents", ["llave"], unique=True)
    op.create_index(op.f("ix_accident_incidents_year"), "accident_incidents", ["year"], unique=False)
    op.create_index(op.f("ix_accident_incidents_incident_class"), "accident_incidents", ["incident_class"], unique=False)
    op.create_index(op.f("ix_accident_incidents_severity"), "accident_incidents", ["severity"], unique=False)
    op.create_index(op.f("ix_accident_incidents_comuna"), "accident_incidents", ["comuna"], unique=False)
    op.create_index("idx_accident_incidents_geom", "accident_incidents", ["geom"], unique=False, postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("idx_accident_incidents_geom", table_name="accident_incidents")
    op.drop_index(op.f("ix_accident_incidents_comuna"), table_name="accident_incidents")
    op.drop_index(op.f("ix_accident_incidents_severity"), table_name="accident_incidents")
    op.drop_index(op.f("ix_accident_incidents_incident_class"), table_name="accident_incidents")
    op.drop_index(op.f("ix_accident_incidents_year"), table_name="accident_incidents")
    op.drop_index(op.f("ix_accident_incidents_llave"), table_name="accident_incidents")
    op.drop_index(op.f("ix_accident_incidents_id"), table_name="accident_incidents")
    op.drop_table("accident_incidents")
