import asyncio
from collections import defaultdict

from sqlalchemy import text

from app.core.database import engine
from app.models import Base


async def check_database() -> None:
    expected = {
        table.name: set(table.columns.keys())
        for table in Base.metadata.sorted_tables
    }
    async with engine.connect() as connection:
        rows = (
            await connection.execute(
                text(
                    """
                    SELECT table_name, column_name
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                    ORDER BY table_name, ordinal_position
                    """
                )
            )
        ).all()
        actual: dict[str, set[str]] = defaultdict(set)
        for table_name, column_name in rows:
            actual[str(table_name)].add(str(column_name))

        missing_tables = sorted(set(expected) - set(actual))
        missing_columns = {
            table: sorted(columns - actual.get(table, set()))
            for table, columns in expected.items()
            if columns - actual.get(table, set())
        }
        if missing_tables or missing_columns:
            if missing_tables:
                print(f"Tablas faltantes: {', '.join(missing_tables)}")
            for table, columns in missing_columns.items():
                print(f"Columnas faltantes en {table}: {', '.join(columns)}")
            raise SystemExit(1)

        counts: dict[str, int] = {}
        for table in ("configuracion_global", "disciplinas", "losas", "users", "trabajadores"):
            result = await connection.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
            counts[table] = int(result.scalar_one())

    await engine.dispose()
    print(f"Esquema completo: {len(expected)} tablas de aplicación verificadas")
    for table, count in counts.items():
        print(f"- {table}: {count} registros")


if __name__ == "__main__":
    asyncio.run(check_database())
