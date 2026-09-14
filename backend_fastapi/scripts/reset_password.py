import argparse
import asyncio
from getpass import getpass

from sqlalchemy import select

from app.core.database import session_factory
from app.core.security import hash_password
from app.models import Trabajador


async def reset(email: str, password: str) -> None:
    """Actualiza la contraseña de un trabajador por correo."""
    async with session_factory() as db:
        worker = await db.scalar(select(Trabajador).where(Trabajador.email == email))
        if worker is None:
            raise SystemExit("Trabajador no encontrado")
        worker.password = await hash_password(password)
        await db.commit()
        print(f"Contraseña actualizada para {worker.email}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Restablecer contraseña de trabajador")
    parser.add_argument("email")
    args = parser.parse_args()
    password = getpass("Nueva contraseña: ")
    confirmation = getpass("Confirma la contraseña: ")
    if len(password) < 6 or password != confirmation:
        raise SystemExit("Las contraseñas no coinciden o tienen menos de 6 caracteres")
    asyncio.run(reset(args.email, password))


if __name__ == "__main__":
    main()
