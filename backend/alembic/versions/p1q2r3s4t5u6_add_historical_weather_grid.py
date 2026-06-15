"""add_historical_weather_grid

Revision ID: p1q2r3s4t5u6
Revises: o6p7q8r9s0t1
Create Date: 2026-06-14 01:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2


revision = 'p1q2r3s4t5u6'
down_revision = 'o6p7q8r9s0t1'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS historical_weather_grid (
            id SERIAL PRIMARY KEY,
            grid_cell_lat DOUBLE PRECISION NOT NULL,
            grid_cell_lng DOUBLE PRECISION NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            precipitation_mm REAL,
            temperature_c REAL,
            geom GEOMETRY(POINT, 4326),
            UNIQUE(grid_cell_lat, grid_cell_lng, timestamp)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_hw_grid_cell ON historical_weather_grid (grid_cell_lat, grid_cell_lng)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_hw_grid_ts ON historical_weather_grid (timestamp)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_hw_grid_geom ON historical_weather_grid USING GIST (geom)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS historical_weather_grid CASCADE")
