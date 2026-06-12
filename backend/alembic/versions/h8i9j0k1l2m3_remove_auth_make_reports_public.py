"""remove_auth_make_reports_public

Revision ID: h8i9j0k1l2m3
Revises: d85cbb436027
Create Date: 2026-06-10 23:30:11.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, None] = 'd85cbb436027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Eliminar FK constraint de reports a users
    op.drop_constraint('reports_reporter_id_fkey', 'reports', type_='foreignkey')
    
    # Eliminar columna reporter_id
    op.drop_column('reports', 'reporter_id')
    
    # Agregar columnas para reportes anónimos
    op.add_column('reports', sa.Column('reporter_name', sa.String(255), nullable=True))
    op.add_column('reports', sa.Column('reporter_email', sa.String(255), nullable=True))


def downgrade() -> None:
    # Revertir: eliminar columnas nuevas
    op.drop_column('reports', 'reporter_email')
    op.drop_column('reports', 'reporter_name')
    
    # Restaurar reporter_id
    op.add_column('reports', sa.Column('reporter_id', sa.Integer(), nullable=True))
    
    # Restaurar FK (solo si tabla users existe)
    op.create_foreign_key('reports_reporter_id_fkey', 'reports', 'users', ['reporter_id'], ['id'], ondelete='SET NULL')
