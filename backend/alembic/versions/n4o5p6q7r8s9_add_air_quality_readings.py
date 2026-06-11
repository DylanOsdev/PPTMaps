"""add air_quality_readings table

Revision ID: n4o5p6q7r8s9
Revises: h8i9j0k1l2m3
Create Date: 2026-06-11 15:11:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


# revision identifiers, used by Alembic.
revision: str = 'n4o5p6q7r8s9'
down_revision: Union[str, None] = 'h8i9j0k1l2m3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create air_quality_readings table
    op.create_table(
        'air_quality_readings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('station_id', sa.String(length=20), nullable=False),
        sa.Column('station_name', sa.String(length=100), nullable=True),
        sa.Column('geom', Geometry(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('aqi', sa.Integer(), nullable=True),
        sa.Column('pm25', sa.Float(), nullable=True),
        sa.Column('pm10', sa.Float(), nullable=True),
        sa.Column('no2', sa.Float(), nullable=True),
        sa.Column('o3', sa.Float(), nullable=True),
        sa.Column('so2', sa.Float(), nullable=True),
        sa.Column('temp', sa.Float(), nullable=True),
        sa.Column('humidity', sa.Float(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('station_id', 'timestamp', name='uq_station_timestamp')
    )
    
    # Create indexes
    op.create_index('idx_aq_station_time', 'air_quality_readings', ['station_id', sa.text('timestamp DESC')], unique=False)
    op.create_index(op.f('ix_air_quality_readings_station_id'), 'air_quality_readings', ['station_id'], unique=False)
    op.create_index(op.f('ix_air_quality_readings_id'), 'air_quality_readings', ['id'], unique=False)
    op.create_index(op.f('ix_air_quality_readings_timestamp'), 'air_quality_readings', ['timestamp'], unique=False)
    op.execute("CREATE INDEX idx_aq_geom ON air_quality_readings USING GIST(geom)")


def downgrade() -> None:
    op.drop_index('idx_aq_geom', table_name='air_quality_readings')
    op.drop_index(op.f('ix_air_quality_readings_timestamp'), table_name='air_quality_readings')
    op.drop_index(op.f('ix_air_quality_readings_id'), table_name='air_quality_readings')
    op.drop_index(op.f('ix_air_quality_readings_station_id'), table_name='air_quality_readings')
    op.drop_index('idx_aq_station_time', table_name='air_quality_readings')
    op.drop_table('air_quality_readings')
