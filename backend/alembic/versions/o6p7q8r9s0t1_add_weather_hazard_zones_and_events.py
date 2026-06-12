"""add weather hazard zones and events tables

Revision ID: o6p7q8r9s0t1
Revises: n4o5p6q7r8s9
Create Date: 2026-06-11 22:25:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'o6p7q8r9s0t1'
down_revision: Union[str, None] = 'n4o5p6q7r8s9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('weather_hazard_zones',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('severity', sa.Integer(), nullable=True),
    sa.Column('event_count', sa.Integer(), nullable=True),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='MULTIPOLYGON', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_weather_hazard_zones_id'), 'weather_hazard_zones', ['id'], unique=False)
    
    # Use raw SQL with IF NOT EXISTS for GIST indexes (not transactional)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_weather_hazard_zones_geom 
        ON weather_hazard_zones USING gist (geom)
    """)
    
    op.create_table('weather_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('event_type', sa.String(), nullable=False),
    sa.Column('severity', sa.Integer(), nullable=True),
    sa.Column('intensity', sa.Float(), nullable=True),
    sa.Column('timestamp', sa.DateTime(), nullable=False),
    sa.Column('source', sa.String(), nullable=True),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_weather_events_id'), 'weather_events', ['id'], unique=False)
    
    # Use raw SQL with IF NOT EXISTS for GIST indexes
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_weather_events_geom 
        ON weather_events USING gist (geom)
    """)
    
    op.create_index('idx_weather_events_timestamp', 'weather_events', ['timestamp'], unique=False)
    
    # Unique constraint para prevenir duplicados (mismo timestamp + ubicación)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_events_unique 
        ON weather_events (timestamp, ST_AsText(geom))
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_weather_events_unique")
    op.drop_index('idx_weather_events_timestamp', table_name='weather_events')
    op.drop_index('idx_weather_events_geom', table_name='weather_events', postgresql_using='gist')
    op.drop_index(op.f('ix_weather_events_id'), table_name='weather_events')
    op.drop_table('weather_events')
    
    op.drop_index('idx_weather_hazard_zones_geom', table_name='weather_hazard_zones', postgresql_using='gist')
    op.drop_index(op.f('ix_weather_hazard_zones_id'), table_name='weather_hazard_zones')
    op.drop_table('weather_hazard_zones')
