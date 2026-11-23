"""Construcción del dataset de ocupación para RF-04.

Una fila por `losa × fecha × franja`. La etiqueta es 1 si existe un permiso
`Aceptado` en ese bloque. Los días bloqueados (feriados) entran con etiqueta 0
para que la variable `es_feriado` tenga señal.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pandas as pd
import psycopg

HORAS = list(range(7, 19))


@dataclass(frozen=True)
class Dataset:
    frame: pd.DataFrame
    fechas: list[pd.Timestamp]
    losas: list[int]
    disciplinas: dict[int, str]


def _frame(cur: psycopg.Cursor, sql: str) -> pd.DataFrame:
    cur.execute(sql)
    columnas = [desc[0] for desc in cur.description]
    return pd.DataFrame(cur.fetchall(), columns=columnas)


def load(conn: psycopg.Connection) -> Dataset:
    with conn.cursor() as cur:
        detalles = _frame(
            cur,
            """
            SELECT d.fecha,
                   extract(hour FROM d.hora_inicio)::int AS hora,
                   d.id_l,
                   p.id_u,
                   p.estado
            FROM detalle_permisos d
            JOIN permisos p ON p.id_p = d.id_p
            """,
        )
        feriados = _frame(cur, "SELECT fecha FROM dias_bloqueados")
        losas = _frame(
            cur,
            """
            SELECT l.id_l, di.nombre AS disciplina
            FROM losas l
            JOIN disciplinas di ON di.id_d = l.id_d
            ORDER BY l.id_l
            """,
        )

    if detalles.empty:
        raise SystemExit("No hay reservas en la base de datos")

    dias_con_datos: set[date] = set(detalles["fecha"])
    primero, ultimo = min(dias_con_datos), max(dias_con_datos)

    festivos = {
        f
        for f in feriados["fecha"]
        if primero <= f <= ultimo and f.weekday() < 5
    }
    dias = sorted(dias_con_datos | festivos)
    ids_losa = [int(x) for x in losas["id_l"]]
    disciplinas = {int(fila.id_l): str(fila.disciplina) for fila in losas.itertuples()}

    indice = pd.MultiIndex.from_product(
        [pd.to_datetime(dias), HORAS, ids_losa], names=["fecha", "hora", "id_l"]
    )
    grid = indice.to_frame(index=False)

    aceptadas = detalles.loc[detalles["estado"] == "Aceptado", ["fecha", "hora", "id_l"]]
    aceptadas = aceptadas.drop_duplicates()
    aceptadas["fecha"] = pd.to_datetime(aceptadas["fecha"])
    aceptadas["ocupado"] = 1

    grid = grid.merge(aceptadas, on=["fecha", "hora", "id_l"], how="left")
    grid["ocupado"] = grid["ocupado"].fillna(0).astype("int8")

    calendario = grid["fecha"].dt
    grid["dow"] = calendario.weekday.astype("int8")
    grid["mes"] = calendario.month.astype("int8")
    grid["semana_anio"] = calendario.isocalendar().week.astype("int16")
    grid["dias_desde_inicio"] = (grid["fecha"] - grid["fecha"].min()).dt.days.astype("int16")
    grid["es_feriado"] = grid["fecha"].dt.date.isin(festivos).astype("int8")
    grid["disciplina"] = grid["id_l"].map(disciplinas)

    return Dataset(
        frame=grid,
        fechas=[pd.Timestamp(d) for d in dias],
        losas=ids_losa,
        disciplinas=disciplinas,
    )


def describe(dataset: Dataset) -> str:
    frame = dataset.frame
    dias = frame["fecha"].nunique()
    ocupacion = frame["ocupado"].mean()
    feriados = int(frame.loc[frame["es_feriado"] == 1, "fecha"].nunique())
    return (
        f"{len(frame):,} bloques · {dias} días ({feriados} feriados) · "
        f"{len(dataset.losas)} losas · {len(HORAS)} franjas · "
        f"ocupación {ocupacion:.1%} · "
        f"{frame['fecha'].min():%Y-%m-%d} → {frame['fecha'].max():%Y-%m-%d}"
    )
