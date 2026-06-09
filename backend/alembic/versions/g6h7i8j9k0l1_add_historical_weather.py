"""add_historical_weather

Revision ID: g6h7i8j9k0l1
Revises: f5a6b7c8d9e0
Create Date: 2026-06-09 13:28:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g6h7i8j9k0l1'
down_revision = 'a6b7c8d9e0f1'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS historical_weather_medellin (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            temperature_c REAL,
            precipitation_mm REAL,
            humidity INTEGER,
            UNIQUE(timestamp)
        )
    """)
    
    # Índice para consultas por fecha
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_historical_weather_timestamp 
        ON historical_weather_medellin(timestamp)
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS historical_weather_medellin CASCADE")
