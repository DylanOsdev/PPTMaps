from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "PPTMaps"
    API_V1_STR: str = "/api/v1"
    
    # Configuraciones de Base de Datos (PostgreSQL / PostGIS)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "movimed"
    POSTGRES_PORT: str = "5432"

    @property
    def ASYNC_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis y Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # Seguridad JWT
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # API key para ingesta de telemetría (dispositivos GPS = máquinas, no users)
    TELEMETRY_API_KEY: str = "dev-telemetry-key-change-me"

    # Ruta del JSON de comunas/municipios que se siembra en PostGIS al arrancar.
    ZONES_JSON_PATH: str = "../frontend/public/assets/data/medellin-comunas.json"

    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()
