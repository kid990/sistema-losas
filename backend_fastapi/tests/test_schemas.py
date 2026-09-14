from datetime import date, time, timedelta

import pytest
from pydantic import ValidationError

from app.modules.permisos.schemas import DetallePermisoIn, PermisoIn


def test_permission_detail_accepts_valid_time_range() -> None:
    detail = DetallePermisoIn(
        id_l=1,
        fecha=date.today(),
        hora_inicio=time(8),
        hora_fin=time(9),
        duracion=1,
    )
    assert detail.duracion == 1


def test_permission_detail_rejects_reversed_time_range() -> None:
    with pytest.raises(ValidationError):
        DetallePermisoIn(
            id_l=1,
            fecha=date.today(),
            hora_inicio=time(10),
            hora_fin=time(9),
            duracion=1,
        )


def test_permission_recalculates_detail_and_total_duration() -> None:
    permission = PermisoIn(
        tipo="Especial",
        duracion_t=99,
        detalles=[
            {
                "id_l": 1,
                "fecha": date.today() + timedelta(days=1),
                "hora_inicio": time(8),
                "hora_fin": time(10),
                "duracion": 99,
            }
        ],
    )
    assert permission.detalles[0].duracion == 2
    assert permission.duracion_t == 2


def test_normal_permission_rejects_a_future_date() -> None:
    with pytest.raises(ValidationError):
        PermisoIn(
            tipo="Normal",
            duracion_t=1,
            detalles=[
                {
                    "id_l": 1,
                    "fecha": date.today() + timedelta(days=1),
                    "hora_inicio": time(8),
                    "hora_fin": time(9),
                    "duracion": 1,
                }
            ],
        )


def test_permission_rejects_fractional_hour_when_storage_is_integer() -> None:
    with pytest.raises(ValidationError):
        DetallePermisoIn(
            id_l=1,
            fecha=date.today(),
            hora_inicio=time(8),
            hora_fin=time(8, 30),
            duracion=1,
        )
