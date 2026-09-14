from datetime import date, datetime, time
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator


class DetallePermisoIn(BaseModel):
    id_l: int = Field(gt=0)
    fecha: date
    hora_inicio: time
    hora_fin: time
    duracion: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_time_range(self) -> Self:
        if self.hora_fin <= self.hora_inicio:
            raise ValueError("hora_fin debe ser posterior a hora_inicio")
        start = datetime.combine(self.fecha, self.hora_inicio)
        end = datetime.combine(self.fecha, self.hora_fin)
        seconds = int((end - start).total_seconds())
        if seconds % 3600 != 0:
            raise ValueError("Los bloques deben tener una duración exacta en horas")
        self.duracion = seconds // 3600
        return self


class PermisoIn(BaseModel):
    tipo: Literal["Normal", "Especial"]
    id_u: int | None = None
    duracion_t: int = Field(gt=0)
    detalles: list[DetallePermisoIn] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_dates_and_total(self) -> Self:
        today = date.today()
        if self.tipo == "Normal" and any(item.fecha != today for item in self.detalles):
            raise ValueError("Los permisos normales solo pueden solicitarse para hoy")
        if self.tipo == "Especial" and any(item.fecha < today for item in self.detalles):
            raise ValueError("Los permisos especiales no pueden incluir fechas pasadas")
        self.duracion_t = sum(item.duracion for item in self.detalles)
        return self


class EstadoPermisoIn(BaseModel):
    estado: Literal["Pendiente", "Aceptado", "Rechazado", "Cancelado"]


class PermisoTrabajadorIn(BaseModel):
    id_t: int = Field(gt=0)
    tipo: Literal["Normal", "Especial"]
    duracion_t: int = Field(gt=0)
    detalles: list[DetallePermisoIn] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_dates_and_total(self) -> Self:
        if any(item.fecha < date.today() for item in self.detalles):
            raise ValueError("No se pueden registrar permisos en fechas pasadas")
        self.duracion_t = sum(item.duracion for item in self.detalles)
        return self
