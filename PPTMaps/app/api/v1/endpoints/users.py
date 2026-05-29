from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, require_role
from app.crud import get_users, get_user_by_id, update_user
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import User as UserSchema, UserUpdate

router = APIRouter()

@router.get("/", response_model=List[UserSchema], summary="Listar todos los usuarios")
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    """Solo ADMIN puede listar todos los usuarios."""
    return await get_users(db, skip=skip, limit=limit)

@router.get("/{user_id}", response_model=UserSchema, summary="Obtener usuario por ID")
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """ADMIN puede ver cualquier usuario; el usuario solo puede verse a sí mismo."""
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    user = await get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

@router.put("/{user_id}", response_model=UserSchema, summary="Actualizar usuario")
async def update_user_endpoint(
    user_id: UUID,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    user = await get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return await update_user(db, db_user=user, user_in=user_in)
