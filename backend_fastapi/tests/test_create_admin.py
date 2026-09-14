import pytest
from pydantic import ValidationError

from scripts.create_admin import AdminData, validate_password


def test_admin_data_accepts_valid_values() -> None:
    data = AdminData(
        dni="12345678",
        nombres="Administrador",
        apellido_p="Sistema",
        apellido_m="UNHEVAL",
        email="admin@unheval.edu.pe",
    )

    assert data.dni == "12345678"
    assert data.email == "admin@unheval.edu.pe"


def test_admin_data_rejects_invalid_dni() -> None:
    with pytest.raises(ValidationError):
        AdminData(
            dni="123",
            nombres="Administrador",
            apellido_p="Sistema",
            apellido_m="UNHEVAL",
            email="admin@unheval.edu.pe",
        )


@pytest.mark.parametrize(
    ("password", "confirmation"),
    [
        ("corta1A", "corta1A"),
        ("SINMINUSCULA1", "SINMINUSCULA1"),
        ("sinmayuscula1", "sinmayuscula1"),
        ("SinNumerosAqui", "SinNumerosAqui"),
        ("Segura123A", "Diferente123A"),
    ],
)
def test_validate_password_rejects_weak_values(password: str, confirmation: str) -> None:
    with pytest.raises(ValueError):
        validate_password(password, confirmation)


def test_validate_password_accepts_strong_value() -> None:
    validate_password("ClaveSegura2026", "ClaveSegura2026")
