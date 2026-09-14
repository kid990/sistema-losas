from typing import Literal

from pydantic import BaseModel, Field


class EstadoUsuarioIn(BaseModel):
    codigo: str = Field(min_length=1, max_length=15)
    estado: Literal["Activo", "Inactivo"]


class PasswordChange(BaseModel):
    actualPassword: str = Field(min_length=1)
    nuevaPassword: str = Field(min_length=4)
