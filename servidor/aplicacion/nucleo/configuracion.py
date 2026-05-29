from pydantic_settings import BaseSettings, SettingsConfigDict


class Ajustes(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    nombre_app: str = "MoviMed API"
    prefijo_api_v1: str = "/api/v1"
    host: str = "0.0.0.0"
    puerto: int = 8000
    origenes_cors: str = "*"

    url_base_datos: str = "postgresql+psycopg://movimed:movimed@db:5432/movimed"
    url_redis: str = "redis://redis:6379/0"
    verificar_bd: bool = True


ajustes = Ajustes()
