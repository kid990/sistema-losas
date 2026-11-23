"""Genera la predicción de ocupación (RF-04) y la guarda en PostgreSQL.

Uso:
    python -m ml.predict_ocupacion
    python -m ml.predict_ocupacion --dias 21
    python -m ml.predict_ocupacion --desde 2026-12-01 --dias 10

Requiere la tabla `prediccion_ocupacion` (ver PG/migrations/).
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta

import joblib
import pandas as pd
import psycopg

from ml.losa_ml import db, etl, features, registry

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


def _fechas_habiles(desde: date, dias: int, feriados: set[date]) -> list[pd.Timestamp]:
    salida: list[pd.Timestamp] = []
    cursor = desde
    while len(salida) < dias:
        if cursor.weekday() < 5 and cursor not in feriados:
            salida.append(pd.Timestamp(cursor))
        cursor += timedelta(days=1)
    return salida


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dias", type=int, default=14)
    parser.add_argument("--desde", default=date.today().isoformat())
    parser.add_argument(
        "--modelo", default=str(registry.MODELS_DIR / "rf04_ocupacion.joblib")
    )
    args = parser.parse_args()

    payload = joblib.load(args.modelo)
    modelo = payload["modelo"]
    columnas = payload["features"]
    version = payload["modelo_version"]

    print(f"Modelo  : {version}")
    print(f"Conectando a {db.describe_target()}")
    with db.connect() as conn:
        dataset = etl.load(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT fecha FROM dias_bloqueados")
            feriados = {fila[0] for fila in cur.fetchall()}

    fechas = _fechas_habiles(date.fromisoformat(args.desde), args.dias, feriados)
    if not fechas:
        print("No hay días hábiles en el rango solicitado.")
        return 0

    historico = dataset.frame
    perfil = historico.groupby(["dow", "hora", "id_l"])["ocupado"].mean()

    filas = []
    for fecha in fechas:
        dow = fecha.weekday()
        for hora in etl.HORAS:
            for id_l in dataset.losas:
                filas.append(
                    {
                        "fecha": fecha,
                        "hora": hora,
                        "id_l": id_l,
                        "disciplina": dataset.disciplinas[id_l],
                        "es_feriado": 0,
                        "dow": dow,
                        "mes": fecha.month,
                        "semana_anio": int(fecha.isocalendar().week),
                        "dias_desde_inicio": int((fecha - historico["fecha"].min()).days),
                        # Valor de apoyo para los rezagos: perfil histórico del bloque.
                        "ocupado": float(perfil.get((dow, hora, id_l), 0.6)),
                    }
                )

    base = pd.concat([historico, pd.DataFrame(filas)], ignore_index=True)
    calendario = [pd.Timestamp(x) for x in sorted(base["fecha"].unique())]
    base = features.add_history(base, calendario, dataset.losas)

    prediccion = base[base["fecha"].isin(fechas)].copy()
    entrada = prediccion[columnas].copy()
    for columna in features.CATEGORICAS:
        entrada[columna] = entrada[columna].astype(str)
    prediccion["probabilidad"] = modelo.predict_proba(entrada)[:, 1].clip(0.01, 0.99)

    registros = [
        (fila.fecha.date(), int(fila.hora), int(fila.id_l), round(float(fila.probabilidad), 3), version)
        for fila in prediccion.itertuples()
    ]

    try:
        with db.connect() as conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM prediccion_ocupacion WHERE fecha BETWEEN %s AND %s",
                (fechas[0].date(), fechas[-1].date()),
            )
            cur.executemany(
                "INSERT INTO prediccion_ocupacion "
                "(fecha, hora, id_l, probabilidad, modelo_version) "
                "VALUES (%s, %s, %s, %s, %s)",
                registros,
            )
    except psycopg.errors.UndefinedTable:
        raise SystemExit(
            "Falta la tabla prediccion_ocupacion. Ejecuta "
            "PG/migrations/20261123_prediccion_ocupacion.sql"
        ) from None

    resumen = prediccion.groupby("fecha")["probabilidad"].mean()
    print(f"\nGuardadas {len(registros)} predicciones · {fechas[0]:%Y-%m-%d} → {fechas[-1]:%Y-%m-%d}")
    for fecha, valor in resumen.items():
        print(f"  {fecha:%a %d/%m}  {valor:.1%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
