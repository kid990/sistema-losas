#!/bin/sh
set -eu

echo "Inicializando esquema PostgreSQL de SIRLOD"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --file /sql/sistema_losa_schema.sql

for migration in /sql/migrations/*.sql; do
  [ -f "$migration" ] || continue
  echo "Aplicando migración: $migration"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --file "$migration"
done

if [ "${LOAD_DEMO_DATA:-false}" = "true" ] && [ -f /sql/seed_usuarios_prueba.sql ]; then
  echo "Cargando datos de demostración de PostgreSQL"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --file /sql/seed_usuarios_prueba.sql
fi
