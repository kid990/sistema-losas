"""Entrena RF-04 (predicción de ocupación) y guarda el artefacto versionado.

Uso:
    python -m ml.train_rf04
    python -m ml.train_rf04 --no-save
    python -m ml.train_rf04 --test-from 2026-01-01 --quick
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import Any

import numpy as np
import pandas as pd
import psycopg
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from ml.losa_ml import db, etl, features, registry

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

CATEGORICAS = features.CATEGORICAS
NUMERICAS = features.NUMERICAS
FEATURES = CATEGORICAS + NUMERICAS
OBJETIVO = "ocupado"


def preprocesador() -> ColumnTransformer:
    return ColumnTransformer(
        [
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAS),
            ("num", Pipeline([("imputar", SimpleImputer(strategy="median"))]), NUMERICAS),
        ]
    )


def candidatos(quick: bool = False) -> dict[str, Pipeline]:
    arboles = 120 if quick else 400
    iteraciones = 120 if quick else 400
    return {
        "RandomForest": Pipeline(
            [
                ("pre", preprocesador()),
                (
                    "modelo",
                    RandomForestClassifier(
                        n_estimators=arboles,
                        min_samples_leaf=4,
                        n_jobs=-1,
                        random_state=42,
                    ),
                ),
            ]
        ),
        "HistGradientBoosting": Pipeline(
            [
                ("pre", preprocesador()),
                (
                    "modelo",
                    HistGradientBoostingClassifier(
                        max_iter=iteraciones,
                        learning_rate=0.06,
                        random_state=42,
                    ),
                ),
            ]
        ),
    }


def metricas(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    return {
        "roc_auc": float(roc_auc_score(y, p)),
        "pr_auc": float(average_precision_score(y, p)),
        "brier": float(brier_score_loss(y, p)),
    }


def _tabla_calibracion(y: np.ndarray, p: np.ndarray) -> pd.DataFrame:
    tabla = pd.DataFrame({"prob": p, "real": y})
    tabla["decena"] = pd.qcut(tabla["prob"], 10, duplicates="drop")
    resumen = (
        tabla.groupby("decena", observed=True)
        .agg(bloques=("real", "size"), predicho=("prob", "mean"), observado=("real", "mean"))
        .reset_index(drop=True)
    )
    return resumen


def _imprimir_calibracion(titulo: str, resumen: pd.DataFrame) -> None:
    print(f"\n== Calibración ({titulo}) ==")
    print("  decil  bloques  predicho  observado  error")
    for i, fila in resumen.iterrows():
        error = abs(fila.predicho - fila.observado)
        print(
            f"  {i + 1:>4}  {int(fila.bloques):>7}  {fila.predicho:>8.3f}  "
            f"{fila.observado:>9.3f}  {error:>5.3f}"
        )


def _validacion_expansiva(
    datos: pd.DataFrame, modelos: dict[str, Pipeline], test_from: pd.Timestamp
) -> dict[str, list[float]]:
    entrenamiento = datos[datos["fecha"] < test_from]
    fechas = np.array(sorted(entrenamiento["fecha"].unique()))
    resultados: dict[str, list[float]] = {nombre: [] for nombre in modelos}

    for fraccion in (0.6, 0.7, 0.8):
        corte = fechas[int(len(fechas) * fraccion)]
        siguiente = fechas[min(int(len(fechas) * (fraccion + 0.1)), len(fechas) - 1)]
        train = entrenamiento[entrenamiento["fecha"] < corte]
        val = entrenamiento[(entrenamiento["fecha"] >= corte) & (entrenamiento["fecha"] < siguiente)]
        for nombre, pipeline in modelos.items():
            pipeline.fit(train[FEATURES], train[OBJETIVO])
            prob = pipeline.predict_proba(val[FEATURES])[:, 1]
            resultados[nombre].append(float(roc_auc_score(val[OBJETIVO], prob)))
        print(
            f"  corte {corte:%Y-%m-%d}: "
            + "  ".join(f"{n} {resultados[n][-1]:.4f}" for n in modelos)
        )
    return resultados


def _importancias(pipeline: Pipeline, limite: int = 12) -> list[tuple[str, float]]:
    modelo = pipeline.named_steps["modelo"]
    if not hasattr(modelo, "feature_importances_"):
        return []
    nombres = pipeline.named_steps["pre"].get_feature_names_out()
    pares = sorted(
        zip(nombres, modelo.feature_importances_, strict=True), key=lambda x: x[1], reverse=True
    )
    return [(nombre, float(valor)) for nombre, valor in pares[:limite]]


def _graficar_calibracion(y: np.ndarray, p: np.ndarray, version: str):
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from sklearn.calibration import calibration_curve
    except ImportError:
        return None

    fraccion, media = calibration_curve(y, p, n_bins=10, strategy="quantile")
    figura, eje = plt.subplots(figsize=(5.2, 5.2))
    eje.plot([0, 1], [0, 1], "--", color="#888888", label="perfecta")
    eje.plot(media, fraccion, "o-", color="#1f77b4", label="modelo")
    eje.set_xlabel("Probabilidad predicha")
    eje.set_ylabel("Frecuencia observada")
    eje.set_title("Curva de calibración · RF-04")
    eje.legend(loc="upper left")
    eje.grid(alpha=0.3)
    destino = registry.MODELS_DIR / f"calibracion_{version}.png"
    figura.savefig(destino, dpi=140, bbox_inches="tight")
    plt.close(figura)
    return destino


def _cargar_dataset() -> etl.Dataset:
    ultimo: Exception | None = None
    for intento in range(3):
        try:
            with db.connect() as conn:
                print("  conexión establecida, leyendo reservas...")
                return etl.load(conn)
        except psycopg.OperationalError as exc:
            ultimo = exc
            print(f"  conexión cortada por el pooler, reintento {intento + 1}/3")
            time.sleep(2 * (intento + 1))
    raise SystemExit(f"No se pudo leer la base de datos: {ultimo}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test-from", default="2026-01-01", help="primer día del conjunto de prueba")
    parser.add_argument("--no-save", action="store_true", help="no escribe artefactos")
    parser.add_argument("--quick", action="store_true", help="modelos más pequeños para probar")
    args = parser.parse_args()

    corte = pd.Timestamp(args.test_from)
    print(f"Conectando a {db.describe_target()}")
    dataset = _cargar_dataset()

    print(f"Dataset: {etl.describe(dataset)}")
    datos = features.add_history(dataset.frame, dataset.fechas, dataset.losas)

    for columna in CATEGORICAS:
        datos[columna] = datos[columna].astype(str)

    train = datos[datos["fecha"] < corte]
    test = datos[datos["fecha"] >= corte]
    if train.empty or test.empty:
        raise SystemExit(f"Split inválido: train={len(train)}, test={len(test)}")

    print(
        f"Train: {len(train):,} filas ({train['fecha'].nunique()} días, "
        f"base {train[OBJETIVO].mean():.1%}) · "
        f"Test: {len(test):,} filas ({test['fecha'].nunique()} días, "
        f"base {test[OBJETIVO].mean():.1%})"
    )

    modelos = candidatos(args.quick)
    print("\n== Validación expansiva (solo train) ==")
    print("  entrenando candidatos, tarda ~2 min...")
    validacion = _validacion_expansiva(datos, modelos, corte)
    for nombre, valores in validacion.items():
        print(f"  {nombre}: media {np.mean(valores):.4f} · desv {np.std(valores):.4f}")

    print("\n== Evaluación en test ==")
    resultados: dict[str, dict[str, float]] = {}
    predicciones: dict[str, np.ndarray] = {}
    for nombre, pipeline in modelos.items():
        pipeline.fit(train[FEATURES], train[OBJETIVO])
        prob = pipeline.predict_proba(test[FEATURES])[:, 1]
        predicciones[nombre] = prob
        resultados[nombre] = metricas(test[OBJETIVO].to_numpy(), prob)
        m = resultados[nombre]
        print(f"  {nombre:<22} ROC-AUC {m['roc_auc']:.4f}  PR-AUC {m['pr_auc']:.4f}  Brier {m['brier']:.4f}")

    ganador = max(resultados, key=lambda n: (resultados[n]["roc_auc"], -resultados[n]["brier"]))
    print(f"\nGanador sin calibrar: {ganador}")

    calibrado = CalibratedClassifierCV(
        modelos[ganador], method="isotonic", cv=TimeSeriesSplit(n_splits=3)
    )
    calibrado.fit(train[FEATURES], train[OBJETIVO])
    prob_cal = calibrado.predict_proba(test[FEATURES])[:, 1]
    resultado_cal = metricas(test[OBJETIVO].to_numpy(), prob_cal)
    print(
        f"Calibrado (isotonic): ROC-AUC {resultado_cal['roc_auc']:.4f}  "
        f"PR-AUC {resultado_cal['pr_auc']:.4f}  Brier {resultado_cal['brier']:.4f}"
    )

    usar_calibrado = resultado_cal["brier"] < resultados[ganador]["brier"]
    modelo_final: Any = calibrado if usar_calibrado else modelos[ganador]
    prob_final = prob_cal if usar_calibrado else predicciones[ganador]
    metricas_finales = resultado_cal if usar_calibrado else resultados[ganador]
    print(f"Modelo final: {ganador}{' calibrado' if usar_calibrado else ' sin calibrar'}")

    _imprimir_calibracion("modelo final", _tabla_calibracion(test[OBJETIVO].to_numpy(), prob_final))

    importancias = _importancias(modelos["RandomForest"])
    if importancias:
        print("\n== Variables más importantes (RandomForest) ==")
        for nombre, valor in importancias:
            print(f"  {nombre:<40} {valor:.4f}")

    resumen_metricas = {
        "roc_auc": metricas_finales["roc_auc"],
        "pr_auc": metricas_finales["pr_auc"],
        "brier": metricas_finales["brier"],
        "modelo": ganador,
        "calibrado": usar_calibrado,
        "validacion_expansiva": {n: float(np.mean(v)) for n, v in validacion.items()},
    }

    if args.no_save:
        print("\n--no-save: no se escribieron artefactos.")
        return 0

    version = registry.build_version(
        "rf04", FEATURES, {"modelo": ganador, "calibrado": usar_calibrado, "corte": str(corte)}
    )
    ruta = registry.save(
        modelo=modelo_final,
        prefix="rf04_ocupacion",
        version=version,
        features=FEATURES,
        metricas=resumen_metricas,
        extra={
            "algoritmo": ganador,
            "ventana_train": f"{train['fecha'].min():%Y-%m-%d}/{train['fecha'].max():%Y-%m-%d}",
            "ventana_test": f"{test['fecha'].min():%Y-%m-%d}/{test['fecha'].max():%Y-%m-%d}",
            "filas_train": int(len(train)),
            "filas_test": int(len(test)),
            "base_train": float(train[OBJETIVO].mean()),
            "base_test": float(test[OBJETIVO].mean()),
            "importancias": {nombre: valor for nombre, valor in importancias},
        },
    )

    grafico = _graficar_calibracion(test[OBJETIVO].to_numpy(), prob_final, version)
    registry.DATA_DIR.mkdir(parents=True, exist_ok=True)
    datos.to_csv(registry.DATA_DIR / "rf04_dataset.csv", index=False)

    print(f"\nGuardado: {ruta}")
    print(f"Versión : {version}")
    if grafico is not None:
        print(f"Gráfico : {grafico}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
