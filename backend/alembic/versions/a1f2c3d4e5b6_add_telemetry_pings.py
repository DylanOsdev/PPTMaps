"""add telemetry_pings

Revision ID: a1f2c3d4e5b6
Revises: d617cc424b41
Create Date: 2026-05-29 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'a1f2c3d4e5b6'
down_revision: Union[str, None] = 'd617cc424b41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'telemetry_pings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.String(length=64), nullable=False),
        sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, spatial_index=False, from_text='ST_GeomFromEWKT', name='geometry', nullable=False), nullable=False),
        sa.Column('speed_kmh', sa.Float(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_telemetry_pings_geom', 'telemetry_pings', ['geom'], unique=False, postgresql_using='gist')
    op.create_index(op.f('ix_telemetry_pings_id'), 'telemetry_pings', ['id'], unique=False)
    op.create_index(op.f('ix_telemetry_pings_device_id'), 'telemetry_pings', ['device_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_telemetry_pings_device_id'), table_name='telemetry_pings')
    op.drop_index(op.f('ix_telemetry_pings_id'), table_name='telemetry_pings')
    op.drop_index('idx_telemetry_pings_geom', table_name='telemetry_pings', postgresql_using='gist')
    op.drop_table('telemetry_pings')
