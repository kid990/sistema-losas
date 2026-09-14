from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


def pg_enum(*values: str, name: str) -> ENUM:
    return ENUM(*values, name=name, create_type=False)


class Disciplina(Base):
    __tablename__ = "disciplinas"
    id_d: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True)
    estado: Mapped[str] = mapped_column(
        pg_enum("Activo", "Inactivo", name="disciplinas_estado_enum"), default="Activo"
    )


class User(Base):
    __tablename__ = "users"
    id_u: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(15), unique=True)
    password: Mapped[str] = mapped_column(String(100))
    rol: Mapped[str] = mapped_column(
        pg_enum("Alumno", "Docente", "PersonalAdministrativo", name="users_rol_enum")
    )
    estado: Mapped[str] = mapped_column(
        pg_enum("Activo", "Inactivo", name="users_estado_enum"), default="Activo"
    )
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())


class Trabajador(Base):
    __tablename__ = "trabajadores"
    id_t: Mapped[int] = mapped_column(Integer, primary_key=True)
    dni: Mapped[str] = mapped_column(String(8), unique=True)
    nombres: Mapped[str] = mapped_column(String(30))
    apellido_p: Mapped[str] = mapped_column(String(30))
    apellido_m: Mapped[str] = mapped_column(String(30))
    rol: Mapped[str] = mapped_column(pg_enum("Administrador", "Seguridad", name="trabajadores_rol_enum"))
    email: Mapped[str] = mapped_column(String(50), unique=True)
    password: Mapped[str] = mapped_column(String(100))
    telefono: Mapped[str | None] = mapped_column(String(15))
    estado: Mapped[str] = mapped_column(
        pg_enum("Activo", "Inactivo", name="trabajadores_estado_enum"), default="Activo"
    )
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())


class Losa(Base):
    __tablename__ = "losas"
    id_l: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50))
    numero_l: Mapped[str] = mapped_column(String(2), unique=True)
    ubicacion: Mapped[str] = mapped_column(String(100))
    dimensiones: Mapped[str | None] = mapped_column(String(100))
    superficie: Mapped[str | None] = mapped_column(String(100))
    iluminacion: Mapped[str | None] = mapped_column(String(100))
    id_d: Mapped[int] = mapped_column(ForeignKey("disciplinas.id_d"))
    estado: Mapped[str] = mapped_column(
        pg_enum("Disponible", "Mantenimiento", "Inactiva", name="losas_estado_enum"), default="Disponible"
    )


class Imagen(Base):
    __tablename__ = "imagenes"
    id_img: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(255))
    id_l: Mapped[int] = mapped_column(ForeignKey("losas.id_l"))
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())


class Archivo(Base):
    __tablename__ = "archivos"
    id_arch: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre_original: Mapped[str] = mapped_column(String(255))
    nombre_unico: Mapped[str] = mapped_column(String(255), unique=True)
    mimetype: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(255))
    tamanio: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())


class Permiso(Base):
    __tablename__ = "permisos"
    id_p: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_u: Mapped[int | None] = mapped_column(ForeignKey("users.id_u"))
    id_t: Mapped[int | None] = mapped_column(ForeignKey("trabajadores.id_t"))
    id_t_decision: Mapped[int | None] = mapped_column(ForeignKey("trabajadores.id_t"))
    autor: Mapped[str] = mapped_column(
        pg_enum("Usuario", "Administrador", name="permisos_autor_enum"), default="Usuario"
    )
    tipo: Mapped[str] = mapped_column(pg_enum("Normal", "Especial", name="permisos_tipo_enum"))
    id_arch: Mapped[int | None] = mapped_column(ForeignKey("archivos.id_arch", ondelete="SET NULL"))
    duracion_t: Mapped[int] = mapped_column(Integer)
    estado: Mapped[str | None] = mapped_column(
        pg_enum("Pendiente", "Aceptado", "Rechazado", "Cancelado", name="permisos_estado_enum"),
        default="Pendiente",
    )
    fecha_creacion: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    fecha_decision: Mapped[datetime | None] = mapped_column(DateTime)


class DetallePermiso(Base):
    __tablename__ = "detalle_permisos"
    id_d: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_p: Mapped[int] = mapped_column(ForeignKey("permisos.id_p"))
    id_l: Mapped[int] = mapped_column(ForeignKey("losas.id_l"))
    fecha: Mapped[date] = mapped_column(Date)
    hora_inicio: Mapped[time] = mapped_column(Time)
    hora_fin: Mapped[time] = mapped_column(Time)
    duracion: Mapped[int] = mapped_column(Integer)


class Notificacion(Base):
    __tablename__ = "notificacion"
    id_n: Mapped[int] = mapped_column(Integer, primary_key=True)
    mensaje: Mapped[str | None] = mapped_column(Text)
    fecha_envio: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    tipo: Mapped[str] = mapped_column(
        pg_enum("Aceptado", "Rechazado", "Cancelado", "Pendiente", name="notificacion_tipo_enum")
    )
    id_p: Mapped[int | None] = mapped_column(ForeignKey("permisos.id_p"))
    leido: Mapped[bool] = mapped_column(Boolean, default=False)


class ConfiguracionGlobal(Base):
    __tablename__ = "configuracion_global"
    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    hora_min_solicitud: Mapped[time] = mapped_column(Time)
    hora_max_solicitud: Mapped[time] = mapped_column(Time)
    hora_min_apertura: Mapped[time] = mapped_column(Time)
    hora_max_apertura: Mapped[time] = mapped_column(Time)
    restriccion_hoy: Mapped[time] = mapped_column(Time)
    max_horas_semana: Mapped[Decimal] = mapped_column(Numeric(4, 2))


class DiaBloqueado(Base):
    __tablename__ = "dias_bloqueados"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fecha: Mapped[date] = mapped_column(Date, unique=True)
    motivo: Mapped[str] = mapped_column(String(255))
    fecha_creacion: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())


class UserSession(Base):
    __tablename__ = "user_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer)
    user_type: Mapped[str] = mapped_column(
        pg_enum("usuario", "trabajador", name="user_sessions_user_type_enum")
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    device_name: Mapped[str | None] = mapped_column(String(150))
    browser: Mapped[str | None] = mapped_column(String(80))
    operating_system: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer)
    user_type: Mapped[str] = mapped_column(
        pg_enum("usuario", "trabajador", name="password_reset_tokens_user_type_enum")
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
