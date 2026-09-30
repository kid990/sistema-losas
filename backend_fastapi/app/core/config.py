from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    """Configuración validada desde variables de entorno."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 3000
    database_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "postgres"
    postgres_password: str = Field(
        default="",
        validation_alias=AliasChoices("POSTGRES_PASSWORD", "DB_PASSWORD"),
    )
    postgres_db: str = "losa"

    jwt_secret: str = "development_access_secret_change_me_32"
    jwt_refresh_secret: str = "development_refresh_secret_change_me_32"
    access_token_ttl_minutes: int = Field(default=15, ge=1)
    refresh_token_ttl_days: int = Field(default=7, ge=1)

    frontend_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173"]
    unheval_api_url: str = "http://localhost:3001/api"

    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_endpoint: str = ""
    s3_region: str = "us-west-004"
    s3_bucket: str = ""
    s3_key_prefix: str = "documentos"
    s3_image_key_prefix: str = "imagenes"
    s3_document_key_prefix: str = "documentos"
    s3_report_key_prefix: str = "reportes"
    s3_force_path_style: bool = False
    s3_signed_url_expires_seconds: int = Field(default=900, ge=60, le=604800)

    mail_host: str = ""
    mail_port: int = 587
    mail_secure: bool = False
    mail_user: str = ""
    mail_password: str = ""
    mail_from: str = "noreply@unheval.edu"
    mail_log_file: str = "mail.log"

    reniec_api_token: str = ""
    reniec_api_url: str = ""

    # LosaBot: credenciales cargadas únicamente desde el entorno.
    ai_provider: Literal["gemini", "deepseek"] = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-flash"
    deepseek_base_url: str = "https://api.deepseek.com"
    document_ai_provider: Literal["gemini"] = "gemini"
    document_ai_min_confidence: float = Field(default=0.85, ge=0.5, le=1)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        """Acepta CORS_ORIGINS como CSV o lista JSON."""
        if isinstance(value, str) and not value.lstrip().startswith("["):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("mail_from", mode="before")
    @classmethod
    def default_mail_from(cls, value: object) -> object:
        """Mantiene un remitente válido mientras MAIL_FROM no esté configurado."""
        return value or "noreply@unheval.edu"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def sqlalchemy_database_url(self) -> str:
        """Construye la URL PostgreSQL sin concatenar las credenciales manualmente."""
        if self.database_url:
            return self.database_url
        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password or None,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    """Devuelve una única instancia inmutable en la práctica."""
    return Settings()


settings = get_settings()
