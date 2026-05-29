from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MoviMed API"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:8000"]

    database_url: str = "postgresql+psycopg://movimed:movimed@localhost:5432/movimed"
    redis_url: str = "redis://localhost:6379/0"


settings = Settings()
