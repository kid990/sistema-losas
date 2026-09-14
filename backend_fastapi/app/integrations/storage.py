import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from uuid import uuid4

import boto3
from botocore.config import Config

from app.core.config import settings
from app.core.exceptions import AppError


@dataclass(frozen=True, slots=True)
class StoredFile:
    url: str
    key: str


async def upload_file(
    content: bytes,
    filename: str,
    content_type: str,
    key_prefix: str | None = None,
) -> StoredFile:
    """Sube un archivo a un almacenamiento compatible con S3 sin bloquear el event loop."""
    required = (
        settings.s3_endpoint,
        settings.aws_access_key_id,
        settings.aws_secret_access_key,
        settings.s3_bucket,
    )
    if not all(required):
        raise AppError(
            "S3 no configurado. Define S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y S3_BUCKET",
            500,
        )
    suffix = Path(filename).suffix.lower()
    prefix = (key_prefix or settings.s3_key_prefix).strip("/")
    key = f"{prefix + '/' if prefix else ''}{uuid4()}{suffix}"

    def put_object() -> None:
        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path" if settings.s3_force_path_style else "virtual"},
            ),
        )
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content,
            ContentType=content_type or "application/octet-stream",
        )

    await asyncio.to_thread(put_object)
    return StoredFile(url=_object_url(key), key=key)


def _client() -> Any:
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        region_name=settings.s3_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path" if settings.s3_force_path_style else "virtual"},
        ),
    )


async def delete_file(key: str) -> None:
    """Elimina un objeto que quedó huérfano después de un rollback."""
    await asyncio.to_thread(lambda: _client().delete_object(Bucket=settings.s3_bucket, Key=key))


async def signed_download_url(key: str) -> str:
    """Genera una URL temporal para descargar un documento privado."""
    return await asyncio.to_thread(
        lambda: _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": key},
            ExpiresIn=settings.s3_signed_url_expires_seconds,
        )
    )


def object_key(stored_value: str) -> str | None:
    """Obtiene la clave S3 desde una clave simple o una URL generada por este bucket."""
    if not stored_value:
        return None
    if not stored_value.lower().startswith(("http://", "https://")):
        return stored_value.lstrip("/")

    stored_parts = urlsplit(stored_value)
    endpoint_parts = urlsplit(settings.s3_endpoint)
    path = unquote(stored_parts.path).lstrip("/")
    virtual_host = f"{settings.s3_bucket}.{endpoint_parts.hostname}"

    if stored_parts.hostname == virtual_host:
        return path
    if stored_parts.hostname == endpoint_parts.hostname:
        bucket_prefix = f"{settings.s3_bucket}/"
        return path.removeprefix(bucket_prefix) if path.startswith(bucket_prefix) else None
    return None


async def signed_stored_object_url(stored_value: str) -> str:
    """Firma objetos del bucket y conserva sin cambios las URLs externas heredadas."""
    key = object_key(stored_value)
    return await signed_download_url(key) if key else stored_value


def _object_url(key: str) -> str:
    endpoint = settings.s3_endpoint.rstrip("/")
    encoded_key = quote(key, safe="/")
    if settings.s3_force_path_style:
        return f"{endpoint}/{settings.s3_bucket}/{encoded_key}"
    parts = urlsplit(endpoint)
    return urlunsplit((parts.scheme, f"{settings.s3_bucket}.{parts.netloc}", f"/{encoded_key}", "", ""))
