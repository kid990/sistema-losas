"""Persistencia de modelos: joblib + metadata versionada."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib

ML_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ML_ROOT / "models"
DATA_DIR = ML_ROOT / "data"


def build_version(prefix: str, features: list[str], params: dict[str, Any]) -> str:
    crudo = json.dumps({"features": features, "params": params}, sort_keys=True, default=str)
    digest = hashlib.sha256(crudo.encode()).hexdigest()[:6]
    return f"{prefix}-{datetime.now(UTC):%Y%m%d}-{digest}"


def save(
    modelo: Any,
    prefix: str,
    version: str,
    features: list[str],
    metricas: dict[str, Any],
    extra: dict[str, Any] | None = None,
) -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    entrenado = datetime.now(UTC).isoformat(timespec="seconds")
    payload = {
        "modelo": modelo,
        "features": features,
        "modelo_version": version,
        "metricas": metricas,
        "entrenado_en": entrenado,
    }
    destino = MODELS_DIR / f"{version}.joblib"
    joblib.dump(payload, destino)
    joblib.dump(payload, MODELS_DIR / f"{prefix}.joblib")

    metadata = {
        "modelo_version": version,
        "entrenado_en": entrenado,
        "features": features,
        "metricas": metricas,
        **(extra or {}),
    }
    (MODELS_DIR / f"{version}.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )
    return destino
