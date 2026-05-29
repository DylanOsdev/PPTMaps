from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.config import settings
from app.core.security import create_access_token
from app.crud import authenticate_user, create_user, get_user_by_email
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, User as UserSchema

router = APIRouter()

@router.post("/login", response_model=Token, summary="Iniciar sesión")
async def login(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """Autentica al usuario y devuelve un JWT access token."""
    user = await authenticate_user(db, email=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(subject=str(user.id), expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED, summary="Registrar usuario")
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Registra un nuevo usuario en el sistema."""
    existing = await get_user_by_email(db, email=user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user = await create_user(db, user_in=user_in)
    return user

@router.get("/me", response_model=UserSchema, summary="Perfil del usuario actual")
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Retorna el perfil del usuario autenticado."""
    return current_user
