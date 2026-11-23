"""Ejecuta la predicción diaria a las 06:00 (America/Lima).

Pensado para correr dentro de un contenedor con el backend siempre levantado.
Si el contenedor arranca después de las 06:00, ejecuta ese mismo día; si ya
existe una predicción generada hoy, la omite.
"""

from __future__ import annotations

import subprocess
import sys
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

from ml.losa_ml import db

HORA = 6
ZONA = ZoneInfo("America/Lima")


def ya_corrio_hoy() -> bool:
    try:
        with db.connect() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT EXISTS ("
                "SELECT 1 FROM prediccion_ocupacion "
                "WHERE generado_en::date = CURRENT_DATE"
                ")"
            )
            return bool(cur.fetchone()[0])
    except Exception as exc:  # base caída o tabla inexistente: se intenta igual
        print(f"  aviso: no se pudo verificar la corrida de hoy ({exc})", flush=True)
        return False


def ejecutar() -> bool:
    print(f"[{datetime.now(ZONA):%Y-%m-%d %H:%M}] ejecutando predicción RF-04", flush=True)
    proceso = subprocess.run(
        [sys.executable, "-m", "ml.predict_ocupacion", "--dias", "14"],
        check=False,
    )
    return proceso.returncode == 0


def main() -> None:
    ultimo: date | None = None
    while True:
        ahora = datetime.now(ZONA)
        if ultimo != ahora.date() and ahora.hour >= HORA:
            if ya_corrio_hoy():
                print(f"[{ahora:%Y-%m-%d %H:%M}] ya hay predicción de hoy; se omite", flush=True)
                ultimo = ahora.date()
            elif ejecutar():
                ultimo = ahora.date()
            else:
                print("  falló la predicción; reintento en 60 s", flush=True)
                time.sleep(60)
                continue
        time.sleep(30)


if __name__ == "__main__":
    main()
