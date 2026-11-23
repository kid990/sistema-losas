# Diagramas de secuencia — modelo RF-04

Dos diagramas cubren el ciclo completo: entrenamiento offline y consumo desde
la vista del alumno o docente.

Los diagramas están en Mermaid; GitHub, GitLab y VS Code los renderizan sin
instalar nada.

---

## 1. Entrenamiento del modelo (offline)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Desarrollador
    participant CLI as train_rf04.py
    participant DB as PostgreSQL (Supabase)
    participant ETL as etl.py
    participant FEAT as features.py
    participant ML as Pipeline sklearn
    participant REG as registry.py
    participant FS as ml/models

    Dev->>CLI: python -m ml.train_rf04
    CLI->>DB: conectar (psycopg, DATABASE_URL)
    CLI->>ETL: load(conn)
    ETL->>DB: SELECT permisos, detalle_permisos, losas,<br/>disciplinas, dias_bloqueados
    DB-->>ETL: 34.577 detalles · 806 días hábiles
    ETL-->>CLI: grilla losa×fecha×franja (51.540 filas)
    CLI->>FEAT: add_history(frame, fechas, losas)
    FEAT-->>CLI: lag_1w/2w/4w, hist_losa_hora,<br/>hist_dow_hora, carga_día_anterior
    CLI->>CLI: split temporal (2022–2025 train / 2026 test)
    loop RandomForest y HistGradientBoosting
        CLI->>ML: fit(train)
        ML-->>CLI: modelo entrenado
        CLI->>ML: predict_proba(test)
        ML-->>CLI: probabilidades
    end
    CLI->>CLI: ROC-AUC, PR-AUC, Brier,<br/>validación expansiva (3 cortes)
    CLI->>ML: CalibratedClassifierCV(isotonic)
    ML-->>CLI: modelo calibrado (mejor Brier)
    CLI->>REG: build_version + save
    REG->>FS: rf04-AAAAMMDD-hash.joblib
    REG->>FS: rf04-AAAAMMDD-hash.json
    REG->>FS: rf04_ocupacion.joblib (alias)
    REG->>FS: calibracion_*.png
    CLI-->>Dev: reporte de métricas + modelo_version
```

El reentrenamiento es **manual**: se ejecuta el comando de arriba cuando se
decide actualizar el modelo (recomendado: mensual + inicio de semestre).

---

## 2. Cómo funciona todo (consumo)

Alumno y Docente comparten el mismo acceso: en el frontend ambos tienen
`tipo = "usuario"` (aunque `rol` sea `Alumno` o `Docente`), usan `UserLayout`
y la misma ruta `/predicciones`. Administrador y Seguridad quedan fuera.

| Rol | `tipo` | Acceso a `/predicciones` |
|---|---|---|
| Alumno | `usuario` | Sí |
| Docente | `usuario` | Sí |
| Administrador | `trabajador` | No (dashboard) |
| Seguridad | `trabajador` | No (módulo de garita) |

```mermaid
sequenceDiagram
    autonumber
    actor Job as ml-cron (06:00 Lima)
    participant PRED as predict_ocupacion.py
    participant FS as ml/models
    participant DB as PostgreSQL
    actor A as Alumno
    actor D as Docente
    participant FE as Frontend /predicciones
    participant API as FastAPI

    Note over A,D: Mismo acceso: tipo="usuario"<br/>(rol Alumno o Docente)

    rect rgb(235, 245, 255)
        Note over Job,DB: Fase 1 — predicción batch (06:00)
        Job->>PRED: python -m ml.predict_ocupacion --dias 14
        PRED->>FS: cargar rf04_ocupacion.joblib
        FS-->>PRED: pipeline + features + modelo_version
        PRED->>DB: leer histórico (permisos + detalles)
        PRED->>PRED: próximos 14 días hábiles + predict_proba
        PRED->>DB: DELETE + INSERT prediccion_ocupacion
        Note over DB: fecha, hora, id_l,<br/>probabilidad, modelo_version
        PRED->>DB: purga predicciones con más de 30 días
    end

    rect rgb(240, 250, 240)
        Note over A,API: Fase 2 — consulta del alumno o docente
        A->>FE: iniciar sesión (código)
        FE->>API: POST /api/auth/login/usuario
        API-->>FE: cookies httpOnly (access + refresh)
        Note over FE: UserLayout exige tipo="usuario";<br/>admin y seguridad se redirigen
        D->>FE: mismo login y mismo layout
    end

    rect rgb(255, 248, 235)
        Note over A,API: Fase 3 — vista de predicciones
        A->>FE: abrir /predicciones (fecha por defecto)
        D->>FE: abrir /predicciones
        FE->>API: GET /api/ml/ocupacion?desde&hasta
        API->>API: validar JWT (401 si falta)
        API->>DB: SELECT prediccion_ocupacion<br/>WHERE fecha BETWEEN
        DB-->>API: 840 filas
        API-->>FE: JSON [{fecha, hora, id_l, probabilidad}]
        FE->>FE: filtrar el día y las horas desde la actual
        FE-->>A: grilla por losa/hora (Baja / Media / Alta)
        FE-->>D: grilla por losa/hora (Baja / Media / Alta)
        A->>FE: "Ir a reservar"
        FE-->>A: redirige a /horario
    end
```

---

## Operación del servicio

- `ml-cron` corre dentro de Docker con `restart: unless-stopped`.
- A las 06:00 (America/Lima) verifica si ya hay predicción generada hoy.
- Si Docker estaba apagado y arranca después de las 06:00, la ejecuta al
  iniciar (catch-up).
- Si ya existe la corrida del día, la omite.
- Predice 14 días hábiles (lunes a viernes, sin feriados) y purga lo anterior
  a 30 días.

## Cómo exportarlos

- **GitHub / GitLab:** pegar el bloque en un `.md`; se renderiza solo.
- **VS Code:** extensión *Markdown Preview Mermaid Support*.
- **PDF / informe:** exportar desde [mermaid.live](https://mermaid.live) a PNG
  con escala 2x.

## Recomendación de uso en el informe

| Sección | Diagrama |
|---|---|
| Metodología / modelo | 1. Entrenamiento |
| Arquitectura / funcionamiento | 2. Consumo |
