from datetime import date

from pydantic import BaseModel, Field


class DiaBloqueadoIn(BaseModel):
    fecha: date
    motivo: str = Field(min_length=1, max_length=255)
