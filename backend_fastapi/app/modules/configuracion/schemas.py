from datetime import time
from decimal import Decimal

from pydantic import BaseModel, Field


class ConfiguracionUpdate(BaseModel):
    hora_min_solicitud: time
    hora_max_solicitud: time
    hora_min_apertura: time
    hora_max_apertura: time
    restriccion_hoy: time
    max_horas_semana: Decimal = Field(gt=0, max_digits=4, decimal_places=2)
