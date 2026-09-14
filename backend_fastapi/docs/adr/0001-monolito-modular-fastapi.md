# ADR-0001: Migrar a un monolito modular FastAPI/PostgreSQL

## Estado

Aceptado.

## Contexto

El backend original es una aplicación Express desplegada como una sola unidad. Está dividido por dominios;
cada dominio contiene rutas, controlador y servicio, y los servicios ejecutan SQL directamente con MySQL2.
El frontend depende de los prefijos y formatos de respuesta actuales. La nueva base relacional ya existe en
PostgreSQL con el nombre `losa`.

## Decisión

Mantener un monolito modular y el contrato HTTP existente. Cada dominio tendrá `router.py`, `schemas.py` y
`service.py`. Se usará FastAPI, Pydantic v2, SQLAlchemy 2 asíncrono y asyncpg. Las integraciones externas se
centralizan en `app/integrations` y la seguridad/configuración en `app/core`.

## Consecuencias

### Positivas

- Migración gradual y contrato compatible con el frontend.
- Validación y documentación OpenAPI automáticas.
- Consultas PostgreSQL parametrizadas y operaciones asíncronas.
- Límites de dominio claros sin complejidad operativa distribuida.

### Negativas

- Los módulos se despliegan y escalan juntos.
- La aplicación sigue dependiendo de la API UNHEVAL para enriquecer datos de usuarios.
- Los trabajos de correo en segundo plano son locales; para alta disponibilidad futura conviene una cola.

### Riesgos y mitigaciones

- Fallo de PostgreSQL: `/ready` comprueba la conexión y el pool usa `pre_ping`.
- Fallo de APIs externas: timeouts y respuestas degradadas donde el flujo lo permite.
- Doble reserva concurrente: las comprobaciones se ejecutan dentro de la transacción; para concurrencia alta
  se recomienda una restricción de exclusión PostgreSQL en los rangos horarios.
- Secretos débiles: se configuran por `.env` y no se versiona el archivo real.

## Alternativas consideradas

- Microservicios: descartados por complejidad de despliegue innecesaria para el alcance actual.
- Un único archivo FastAPI: descartado porque perdería los límites de dominio ya presentes.
- Repository genérico: descartado porque añadiría indirección sin resolver una necesidad actual.

