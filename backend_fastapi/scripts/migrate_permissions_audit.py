import asyncio

from sqlalchemy import text

from app.core.database import engine

STATEMENTS = (
    "ALTER TABLE permisos ADD COLUMN IF NOT EXISTS id_t_decision INT NULL",
    "ALTER TABLE permisos ADD COLUMN IF NOT EXISTS fecha_decision TIMESTAMP NULL",
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'permisos_id_t_decision_fkey'
        ) THEN
            ALTER TABLE permisos
            ADD CONSTRAINT permisos_id_t_decision_fkey
            FOREIGN KEY (id_t_decision) REFERENCES trabajadores(id_t);
        END IF;
    END $$
    """,
)


async def migrate() -> None:
    async with engine.begin() as connection:
        for statement in STATEMENTS:
            await connection.execute(text(statement))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())
    print("Migración de auditoría de permisos aplicada correctamente")
