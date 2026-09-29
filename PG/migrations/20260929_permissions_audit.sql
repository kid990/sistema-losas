BEGIN;

ALTER TABLE permisos
    ADD COLUMN IF NOT EXISTS id_t_decision INT NULL,
    ADD COLUMN IF NOT EXISTS fecha_decision TIMESTAMP NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'permisos_id_t_decision_fkey'
    ) THEN
        ALTER TABLE permisos
            ADD CONSTRAINT permisos_id_t_decision_fkey
            FOREIGN KEY (id_t_decision) REFERENCES trabajadores(id_t);
    END IF;
END $$;

COMMIT;
