"""drop_vehicles_telemetry_tables

Revision ID: d85cbb436027
Revises: g6h7i8j9k0l1
Create Date: 2026-06-10 22:06:54.539133

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'd85cbb436027'
down_revision: Union[str, None] = 'g6h7i8j9k0l1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Eliminar tablas de tráfico/navegación (pivot a clima + seguridad)
    op.drop_table('telemetry')
    op.drop_table('vehicles')


def downgrade() -> None:
    # Recrear tablas si es necesario revertir
    op.create_table(
        'vehicles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plate', sa.String(length=20), nullable=False),
        sa.Column('vehicle_type', sa.String(length=50), nullable=True),
        sa.Column('status', sa.Enum('active', 'inactive', 'maintenance', name='vehiclestatus'), nullable=True),
        sa.Column('driver_name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plate')
    )
    
    op.create_table(
        'telemetry',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('speed_kmh', sa.Float(), nullable=True),
        sa.Column('heading', sa.Float(), nullable=True),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=False),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_telemetry_vehicle_timestamp', 'telemetry', ['vehicle_id', 'timestamp'], unique=False)
    op.create_index('idx_telemetry_location', 'telemetry', ['location'], unique=False, postgresql_using='gist')
