import asyncio

import httpx

from app.core.config import settings
from app.integrations.storage import delete_file, signed_download_url, upload_file


async def main() -> None:
    keys: list[str] = []
    try:
        image = await upload_file(
            b"Verificacion de imagen S3",
            "verificacion-imagen.jpg",
            "image/jpeg",
            settings.s3_image_key_prefix,
        )
        keys.append(image.key)
        document = await upload_file(
            b"%PDF-1.4 verificacion S3",
            "verificacion-documento.pdf",
            "application/pdf",
            settings.s3_document_key_prefix,
        )
        keys.append(document.key)

        if not image.key.startswith(f"{settings.s3_image_key_prefix}/"):
            raise RuntimeError("La imagen no se guardó en su carpeta S3")
        if not document.key.startswith(f"{settings.s3_document_key_prefix}/"):
            raise RuntimeError("El documento no se guardó en su carpeta S3")
        signed_url = await signed_download_url(image.key)
        if not signed_url.startswith("https://"):
            raise RuntimeError("S3 no genero una URL firmada valida")
        async with httpx.AsyncClient(timeout=10.0) as client:
            signed_response = await client.get(signed_url)
        if not signed_response.is_success:
            raise RuntimeError(f"La URL firmada respondió HTTP {signed_response.status_code}")

        print("S3 FastAPI: imagenes/ y documentos/ verificados.")
    finally:
        if keys:
            await asyncio.gather(*(delete_file(key) for key in keys))
            print("S3 FastAPI: archivo temporal eliminado.")


if __name__ == "__main__":
    asyncio.run(main())
