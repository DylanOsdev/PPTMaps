from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.api_key import APIKeyHeader
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, UserRole
from app.crud import get_user_by_id
from app.schemas.token import TokenPayload
import secrets

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Header de API key para máquinas (ingesta de telemetría). auto_error=False para
# devolver 401 explícito en vez del 403 por defecto cuando falta el header.
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Depends(_api_key_header)) -> str:
    """Valida la API key de telemetría con comparación de tiempo constante."""
    if not api_key or not secrets.compare_digest(api_key, settings.TELEMETRY_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida o ausente",
        )
    return api_key

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        if token_data.sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await get_user_by_id(db, user_id=int(token_data.sub))
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Usuario inactivo")
    return current_user

def require_role(*roles: UserRole):
    """Factory de dependencias para verificar roles."""
    async def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes para esta acción",
            )
        return current_user
    return role_checker
