"""Lectura del padrón UNHEVAL desde el dump SQL (escuela y año académico).

El backend guarda `users.codigo`, pero la escuela y el año académico viven en
MySQL (`api_unheval`). Para no depender de que MySQL esté arriba, el mapeo se
extrae del dump `DB/api_unheval_data.sql`, que es la fuente del contenedor.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DUMP = REPO_ROOT / "DB" / "api_unheval_data.sql"

_ESCUELA_ROW = re.compile(r"\(\s*'[^']*'\s*,\s*'(?P<nombre>[^']*)'\s*,\s*\d+\s*\)")
_ALUMNO_ROW = re.compile(
    r"\(\s*'(?P<codigo>\d{6,15})'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,"
    r"\s*'[^']*'\s*,\s*(?:'[^']*'|NULL)\s*,\s*(?P<anio>\d+)\s*,\s*(?P<id_esc>\d+)\s*\)"
)


def _insert_blocks(text: str, table: str) -> list[str]:
    pattern = re.compile(rf"INSERT INTO {table}\s*\([^;]*?VALUES(.*?);", re.S)
    return pattern.findall(text)


def load_padron(path: Path = DEFAULT_DUMP) -> dict[str, tuple[str, int]]:
    """Devuelve `codigo -> (escuela, año_academico)` para todos los alumnos."""
    if not path.exists():
        raise SystemExit(f"No se encontró el padrón: {path}")

    text = path.read_text(encoding="utf-8", errors="replace")

    escuelas: dict[int, str] = {}
    for block in _insert_blocks(text, "escuela_profesional"):
        for nombre in _ESCUELA_ROW.findall(block):
            escuelas[len(escuelas) + 1] = nombre

    padron: dict[str, tuple[str, int]] = {}
    for block in _insert_blocks(text, "alumno"):
        for codigo, anio, id_esc in _ALUMNO_ROW.findall(block):
            nombre = escuelas.get(int(id_esc), f"Escuela {id_esc}")
            padron[codigo] = (nombre, int(anio))

    if not padron:
        raise SystemExit("El padrón quedó vacío: revisa el formato del dump SQL")
    return padron
