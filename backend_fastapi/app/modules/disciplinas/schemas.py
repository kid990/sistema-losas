from typing import Literal

from pydantic import BaseModel, Field


class DisciplinaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)


class EstadoIn(BaseModel):
    estado: Literal["Activo", "Inactivo"]
