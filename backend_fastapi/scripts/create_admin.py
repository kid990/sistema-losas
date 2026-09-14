import argparse
import asyncio
from getpass import getpass

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import session_factory
from app.core.security import hash_password
from app.models import Trabajador


class AdminData(BaseModel):
    """Datos mínimos permitidos para crear el administrador inicial."""

    model_config = ConfigDict(str_strip_whitespace=True)

    dni: str = Field(pattern=r"^\d{8}$")
    nombres: str = Field(min_length=1, max_length=30)
    apellido_p: str = Field(min_length=1, max_length=30)
    apellido_m: str = Field(min_length=1, max_length=30)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=15)


def validate_password(password: str, confirmation: str) -> None:
    if password != confirmation:
        raise ValueError("Las contraseñas no coinciden")
    if len(password) < 10:
        raise ValueError("La contraseña debe tener al menos 10 caracteres")
    if not any(character.islower() for character in password):
        raise ValueError("La contraseña debe incluir una letra minúscula")
    if not any(character.isupper() for character in password):
        raise ValueError("La contraseña debe incluir una letra mayúscula")
    if not any(character.isdigit() for character in password):
        raise ValueError("La contraseña debe incluir un número")


def prompt_value(current: str | None, label: str) -> str:
    return current.strip() if current else input(f"{label}: ").strip()


async def create_admin(data: AdminData, password: str) -> int:
    async with session_factory() as db:
        try:
            existing = await db.scalar(
                select(Trabajador).where(or_(Trabajador.dni == data.dni, Trabajador.email == str(data.email)))
            )
            if existing is not None:
                raise ValueError("Ya existe un trabajador con ese DNI o correo")

            admin = Trabajador(
                dni=data.dni,
                nombres=data.nombres,
                apellido_p=data.apellido_p,
                apellido_m=data.apellido_m,
                rol="Administrador",
                email=str(data.email),
                password=await hash_password(password),
                telefono=data.telefono or None,
                estado="Activo",
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
            return admin.id_t
        except (SQLAlchemyError, ValueError):
            await db.rollback()
            raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crear de forma segura el administrador inicial en PostgreSQL"
    )
    parser.add_argument("--dni")
    parser.add_argument("--nombres")
    parser.add_argument("--apellido-p")
    parser.add_argument("--apellido-m")
    parser.add_argument("--email")
    parser.add_argument("--telefono")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        data = AdminData(
            dni=prompt_value(args.dni, "DNI (8 dígitos)"),
            nombres=prompt_value(args.nombres, "Nombres"),
            apellido_p=prompt_value(args.apellido_p, "Apellido paterno"),
            apellido_m=prompt_value(args.apellido_m, "Apellido materno"),
            email=prompt_value(args.email, "Correo"),
            telefono=args.telefono.strip() if args.telefono else None,
        )
        password = getpass("Contraseña: ")
        confirmation = getpass("Confirmar contraseña: ")
        validate_password(password, confirmation)
        admin_id = asyncio.run(create_admin(data, password))
    except ValidationError as exc:
        raise SystemExit(f"Datos inválidos: {exc}") from exc
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    except SQLAlchemyError as exc:
        raise SystemExit(
            "No se pudo crear el administrador. Verifica PostgreSQL y POSTGRES_PASSWORD en .env"
        ) from exc

    print(f"Administrador creado correctamente con ID {admin_id}")


if __name__ == "__main__":
    main()
