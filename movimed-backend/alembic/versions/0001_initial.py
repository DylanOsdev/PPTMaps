"""initial postgis schema: users, reports, accident_zones, flood_hazards

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column(
            "role",
            sa.Enum("citizen", "authority", "admin", name="user_role"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reporter_id", sa.Integer(), nullable=True),
        sa.Column(
            "report_type",
            sa.Enum("accident", "flood", "obstruction", "other", name="report_type"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "geom",
            geoalchemy2.Geometry(geometry_type="POINT", srid=4326, spatial_index=True),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "accident_zones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("severity", sa.Integer(), nullable=False),
        sa.Column("incident_count", sa.Integer(), nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "flood_hazards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("siata_station_id", sa.String(64), nullable=True),
        sa.Column(
            "status",
            sa.Enum("dry", "watch", "flooded", name="flood_status"),
            nullable=False,
        ),
        sa.Column("water_level_m", sa.Float(), nullable=True),
        sa.Column(
            "geom",
            geoalchemy2.Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_flood_hazards_siata_station_id", "flood_hazards", ["siata_station_id"]
    )


def downgrade() -> None:
    op.drop_table("flood_hazards")
    op.drop_table("accident_zones")
    op.drop_table("reports")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS flood_status")
    op.execute("DROP TYPE IF EXISTS report_type")
    op.execute("DROP TYPE IF EXISTS user_role")
