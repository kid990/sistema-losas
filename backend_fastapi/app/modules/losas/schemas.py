from typing import Literal

from pydantic import BaseModel, Field


class LosaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    numero_l: str = Field(min_length=1, max_length=2)
    ubicacion: str = Field(min_length=1, max_length=100)
    dimensiones: str | None = Field(default=None, max_length=100)
    superficie: str | None = Field(default=None, max_length=100)
    iluminacion: str | None = Field(default=None, max_length=100)
    id_d: int = Field(gt=0)
    estado: Literal["Disponible", "Mantenimiento", "Inactiva"] | None = None
