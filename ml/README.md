# ml — modelo de ocupación RF-04

Entrenamiento **offline**. Este directorio no forma parte de la imagen de la
API ni se importa desde `backend_fastapi`.

## Requisitos

- Python 3.11+ (probado con 3.13)
- Acceso al PostgreSQL de Supabase configurado en `backend_fastapi/.env.docker`
  (`DATABASE_URL`)
- Ejecutar siempre desde la raíz del repo

## Instalación (una vez)

```powershell
cd C:\Users\HP\Desktop\SISTEMA_LOSA
python -m venv ml\.venv
ml\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt
```

## Entrenar

```powershell
# entrenamiento completo (~3 min en CPU)
ml\.venv\Scripts\python.exe -m ml.train_rf04

# verificación rápida
ml\.venv\Scripts\python.exe -m ml.train_rf04 --quick --no-save

# solo métricas, sin escribir artefactos
ml\.venv\Scripts\python.exe -m ml.train_rf04 --no-save

# cambiar el inicio del conjunto de prueba
ml\.venv\Scripts\python.exe -m ml.train_rf04 --test-from 2025-07-01
```

Flujo: lee `permisos`/`detalle_permisos` → grilla `losa × fecha × franja` →
features históricas → split temporal → RandomForest vs HistGradientBoosting →
calibración isotónica → guarda el mejor.

## Regenerar el histórico (opcional)

```powershell
ml\.venv\Scripts\python.exe -m ml.seed_historico --dry-run
ml\.venv\Scripts\python.exe -m ml.seed_historico --apply --yes
ml\.venv\Scripts\python.exe -m ml.seed_historico --rollback --yes
```

`--apply` respalda antes en `permisos_bak_20261122`,
`detalle_permisos_bak_20261122` y `notificacion_bak_20261122`.

## Archivos que genera

| Ruta | Contenido |
|---|---|
| `ml/models/rf04-AAAAMMDD-hash.joblib` | Modelo versionado (dict con `modelo`, `features`, `modelo_version`, `metricas`) |
| `ml/models/rf04-AAAAMMDD-hash.json` | Features, métricas, ventanas, importancias |
| `ml/models/rf04_ocupacion.joblib` | Alias del último modelo, para servir |
| `ml/models/calibracion_*.png` | Curva de calibración |
| `ml/data/rf04_dataset.csv` | Dataset usado en el entrenamiento |

`ml/models/` y `ml/data/` están en `.gitignore`. **Sobreviven si borras
`ml/.venv`**: el venv solo contiene paquetes.

## Dataset

- Una fila por `losa × fecha × franja` (12 franjas de 07:00 a 18:00).
- Etiqueta `ocupado = 1` si existe un permiso `Aceptado` en ese bloque.
- Los feriados entran con etiqueta 0 y `es_feriado = 1`.
- 51,540 bloques · 859 días · 5 losas · ocupación 61.0% · 2022-04-18 → 2026-11-20.

Features: `hora`, `dow`, `id_l`, `disciplina`, `es_feriado`, `mes`,
`semana_anio`, `dias_desde_inicio`, `lag_1w`, `lag_2w`, `lag_4w`,
`hist_losa_hora`, `hist_dow_hora`, `carga_dia_anterior`.

Los rezagos usan solo el pasado (`shift` positivo). El preprocesador se ajusta
únicamente con el train.

## Métricas vigentes (v1)

Train hasta 2025 · test 2026.

| Modelo | ROC-AUC | PR-AUC | Brier |
|---|---|---|---|
| RandomForest | 0.8247 | 0.8811 | 0.1642 |
| HistGradientBoosting | 0.8282 | 0.8846 | 0.1668 |
| HistGradientBoosting calibrado | **0.8330** | **0.8882** | **0.1592** |

Validación expansiva: 0.8308 ± 0.0080.

## Predicciones

```powershell
# manual
ml\.venv\Scripts\python.exe -m ml.predict_ocupacion

# lanzador Windows (usa el venv y la raíz del repo)
ml\predict_diario.cmd
```

Predice los próximos **14 días hábiles** (lunes a viernes, sin feriados) y los
guarda en `prediccion_ocupacion`. Opciones: `--dias 21`,
`--desde 2026-12-01`, `--modelo <ruta.joblib>`. Requiere la migración
`PG/migrations/20261123_prediccion_ocupacion.sql`.

Cada corrida reemplaza su ventana y purga las predicciones con más de 30 días.

## Servicio automático (Docker)

El servicio `ml-cron` se levanta con el stack:

- Ejecuta a las **06:00 America/Lima**.
- Si el contenedor arranca después de las 06:00 y todavía no hay corrida de
  hoy, la ejecuta (catch-up).
- Si ya existe la predicción del día, la omite.
- Monta `ml/models` en solo lectura; el `.joblib` debe existir en el host.

Imagen: `docker/ml/Dockerfile`. Servicio en `docker/compose.yml` y
`docker/compose.production.yml`.

## Reentrenamiento

Es **manual**. Recomendado mensual + inicio de semestre:

```powershell
ml\.venv\Scripts\python.exe -m ml.train_rf04
```

No se automatiza: publicar un modelo nuevo debe pasar por revisión de métricas
(ROC-AUC y Brier) antes de reemplazar el vigente.

## Notas

- La salida de los scripts se fuerza a UTF-8; no hace falta configurar la consola.
- Las dependencias están fijadas en `ml/requirements.txt`. Un cambio de versión
  mayor de `scikit-learn` obliga a reentrenar.
- Si el pooler de Supabase corta la conexión, el script reintenta 3 veces.
- Los datos actuales son sintéticos (perfil horario simulado). Las métricas son
  un techo optimista, no una promesa de producción.
