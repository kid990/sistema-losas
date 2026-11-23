"""Variables históricas para RF-04, calculadas solo con datos del pasado.

Los rezagos se obtienen desplazando el cubo `fecha × losa × hora`. Nunca se
usa `shift(-n)` ni la expansión incluye la fila actual, para que el modelo no
vea el futuro.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.losa_ml.etl import HORAS

CATEGORICAS = ["hora", "dow", "id_l", "disciplina", "es_feriado"]
NUMERICAS = [
    "mes",
    "semana_anio",
    "dias_desde_inicio",
    "lag_1w",
    "lag_2w",
    "lag_4w",
    "hist_losa_hora",
    "hist_dow_hora",
    "carga_dia_anterior",
]
FEATURES = CATEGORICAS + NUMERICAS


def add_history(frame: pd.DataFrame, fechas: list[pd.Timestamp], losas: list[int]) -> pd.DataFrame:
    frame = frame.sort_values(["fecha", "hora", "id_l"]).reset_index(drop=True)

    pos = {fecha: i for i, fecha in enumerate(fechas)}
    pos_losa = {id_l: i for i, id_l in enumerate(losas)}
    pos_hora = {hora: i for i, hora in enumerate(HORAS)}

    p = frame["fecha"].map(pos).to_numpy()
    a = frame["id_l"].map(pos_losa).to_numpy()
    b = frame["hora"].map(pos_hora).to_numpy()

    cubo = np.zeros((len(fechas), len(losas), len(HORAS)), dtype=np.float32)
    cubo[p, a, b] = frame["ocupado"].to_numpy(dtype=np.float32)

    def rezago(offset: int) -> np.ndarray:
        origen = p - offset
        valores = np.full(len(frame), np.nan, dtype=np.float32)
        valido = origen >= 0
        valores[valido] = cubo[origen[valido], a[valido], b[valido]]
        return valores

    frame["lag_1w"] = rezago(5)
    frame["lag_2w"] = rezago(10)
    frame["lag_4w"] = rezago(20)

    acumulado = np.cumsum(cubo, axis=0)
    denominador = np.arange(1, len(fechas) + 1, dtype=np.float32)[:, None, None]
    media = (acumulado - cubo) / np.maximum(denominador - 1, 1)
    historica = np.full(len(frame), np.nan, dtype=np.float32)
    historica[p >= 1] = media[p[p >= 1], a[p >= 1], b[p >= 1]]
    frame["hist_losa_hora"] = historica

    carga = cubo.sum(axis=(1, 2))
    anterior = np.full(len(frame), np.nan, dtype=np.float32)
    valido = p >= 1
    anterior[valido] = carga[p[valido] - 1]
    frame["carga_dia_anterior"] = anterior

    diario = (
        frame.groupby(["fecha", "dow", "hora"], as_index=False)["ocupado"]
        .mean()
        .sort_values("fecha")
    )
    diario["hist_dow_hora"] = diario.groupby(["dow", "hora"])["ocupado"].transform(
        lambda serie: serie.shift(1).expanding().mean()
    )
    frame = frame.merge(
        diario[["fecha", "dow", "hora", "hist_dow_hora"]],
        on=["fecha", "dow", "hora"],
        how="left",
    )
    return frame
