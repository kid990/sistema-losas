# Docker de SIRLOD

Esta carpeta centraliza la infraestructura sin mover el código de `frontend/`,
`backend_fastapi/`, `backend_api/`, `PG/` ni `DB/`.

## Servicios

| Servicio | Función | Puerto local |
|---|---|---:|
| `frontend` | React Router SSR | 5173 |
| `backend-fastapi` | API principal | 3000 |
| `backend-api` | Padrón UNHEVAL | 3001 |
| `postgres` | Base local opcional (`--profile local-db`) | 5432 |
| `mysql` | Base del padrón `api_unheval` | 3306 |
| `redis` | Broker y resultados temporales de Celery | 6379 |
| `celery-worker` | Reportes, documentos, correos y sincronización | — |

`celery-beat`, `flower` y PostgreSQL local son perfiles opcionales. FastAPI y
Celery utilizan por defecto la `DATABASE_URL` de Supabase definida en
`backend_fastapi/.env.docker`. MySQL continúa siendo local para `backend_api`.
MySQL y Redis persisten en volúmenes Docker; MySQL carga `DB/` únicamente cuando
su volumen está vacío.

## Preparación

Docker debe ejecutarse desde WSL. Para evitar problemas con bind mounts, se
recomienda mantener el repositorio en el sistema de archivos Linux de WSL, por
ejemplo `/home/usuario/SISTEMA_LOSA`.

```bash
cp docker/.env.example docker/.env
cp backend_fastapi/.env.docker.example backend_fastapi/.env.docker
cp backend_api/.env.docker.example backend_api/.env.docker
cp frontend/.env.docker.example frontend/.env.docker
```

Los cuatro archivos resultantes están ignorados por Git:

- `docker/.env` contiene únicamente puertos y credenciales de PostgreSQL,
  MySQL, Redis y Flower compartidas por la infraestructura.
- Cada `.env.docker` contiene las variables de su aplicación cuando se ejecuta
  dentro de Docker. Los `.env` existentes continúan siendo exclusivos de la
  ejecución local fuera de Docker.

Edita los `.env.docker` y completa las credenciales externas que necesite cada
aplicación. En particular, las claves de IA, S3, correo y RENIEC pertenecen a
`backend_fastapi/.env.docker`. Las expresiones `${VARIABLE:-valor}` de estos
archivos toman las credenciales compartidas desde `docker/.env` al ejecutar
Docker Compose.

En `backend_fastapi/.env.docker`, pega la URL Direct o Session pooler obtenida
desde **Supabase > Connect**, cambia `postgresql://` por
`postgresql+asyncpg://` y conserva el puerto `5432`. La conexión usa SSL y un
pool pequeño para dejar capacidad a los servicios internos de Supabase. No
guardes esa URL en Git.

El frontend copia `frontend/.env.docker` solamente en la etapa de compilación
para que Vite pueda leer `VITE_*`; el archivo no se copia a la imagen final.

## Inicio

```bash
docker compose --env-file docker/.env -f docker/compose.yml up --build -d
docker compose --env-file docker/.env -f docker/compose.yml ps
```

Abre `http://localhost:5173`. Swagger queda en `http://localhost:3000/docs`.

Para activar también el planificador y el monitor de Celery:

```bash
docker compose --env-file docker/.env -f docker/compose.yml \
  --profile scheduler --profile monitoring up --build -d
```

Flower queda en `http://localhost:5555` y usa `FLOWER_USER` y
`FLOWER_PASSWORD`.

Si temporalmente necesitas PostgreSQL local, cambia `DATABASE_URL` para apuntar
a `postgres:5432` e inicia el perfil correspondiente:

```bash
docker compose --env-file docker/.env -f docker/compose.yml \
  --profile local-db up --build -d
```

## Entrada Nginx para producción

El Compose local no inicia Nginx. Para probar la topología de producción usa
los dos archivos Compose:

```bash
docker compose --env-file docker/.env \
  -f docker/compose.yml \
  -f docker/compose.production.yml \
  up --build -d
```

Con los valores locales incluidos, la aplicación queda disponible en
`http://localhost:8080`. El overlay elimina todos los puertos publicados de
frontend, APIs, bases de datos, Redis y Flower; únicamente Nginx queda expuesto.

Antes de desplegar en un servidor cambia `PUBLIC_URL`, `NGINX_HTTP_PORT`, las
contraseñas de infraestructura y las claves de los `.env.docker`. El frontend
se compila con `/api` como URL pública y Nginx dirige esa ruta hacia FastAPI.
El backend Express continúa accesible únicamente desde la red interna.

Esta configuración recibe HTTP en Nginx. En producción, HTTPS debe terminar en
el balanceador o plataforma de alojamiento. Si Nginx se expone directamente a
Internet, se deben montar el certificado y la clave TLS antes del despliegue.

## Colas disponibles

- `reports`: generación o regeneración de reportes PDF.
- `documents`: revisión automática de permisos especiales.
- `emails`: recuperación de contraseña y notificaciones.
- `sync`: sincronización del padrón UNHEVAL.
- `default`: trabajos generales.

Los endpoints asíncronos devuelven `202 Accepted`, un `task_id` y una URL de
estado:

- `POST /api/reportes/regenerar-async`
- `POST /api/permisos/revision-automatica-async`
- `POST /api/users/cargar-async`
- `GET /api/jobs/{task_id}`

Los endpoints síncronos anteriores se conservan para no romper el frontend.

## Operación

```bash
docker compose --env-file docker/.env -f docker/compose.yml logs -f celery-worker
docker compose --env-file docker/.env -f docker/compose.yml down
```

`down` conserva los datos. Para eliminar también los volúmenes se requiere
`down --volumes`; esa operación borra las bases y la cola persistida.

## Cambios de variables

Después de modificar un `.env.docker`, recrea únicamente los servicios que lo
utilizan. No se necesita reconstruir la imagen, excepto para variables
`VITE_*` del frontend:

```bash
docker compose --env-file docker/.env -f docker/compose.yml up -d --force-recreate backend-fastapi celery-worker
docker compose --env-file docker/.env -f docker/compose.yml up -d --build frontend
```
