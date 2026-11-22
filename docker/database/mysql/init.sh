#!/bin/sh
set -eu

echo "Inicializando esquema MySQL del padrón UNHEVAL"
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --default-character-set=utf8mb4 "$MYSQL_DATABASE" \
  < /sql/api_unheval_schema.sql
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --default-character-set=utf8mb4 "$MYSQL_DATABASE" \
  < /sql/api_unheval_data.sql

for migration in /sql/migrations/*.sql; do
  [ -f "$migration" ] || continue
  echo "Aplicando migración: $migration"
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root "$MYSQL_DATABASE" \
    < "$migration"
done
