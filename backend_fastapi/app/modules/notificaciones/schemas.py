from typing import Literal

from pydantic import BaseModel, Field


class NotificacionIn(BaseModel):
    mensaje: str = Field(min_length=1)
    tipo: Literal["Aceptado", "Rechazado", "Cancelado", "Pendiente"]
    id_p: int = Field(gt=0)
