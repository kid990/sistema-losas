BEGIN;

ALTER TABLE permisos
    ADD COLUMN IF NOT EXISTS id_t_decision INT NULL REFERENCES trabajadores(id_t);

ALTER TABLE permisos
    DROP CONSTRAINT IF EXISTS permisos_duracion_t_positiva,
    ADD CONSTRAINT permisos_duracion_t_positiva CHECK (duracion_t > 0);

ALTER TABLE detalle_permisos
    DROP CONSTRAINT IF EXISTS detalle_permisos_duracion_positiva,
    ADD CONSTRAINT detalle_permisos_duracion_positiva CHECK (duracion > 0),
    DROP CONSTRAINT IF EXISTS detalle_permisos_horario_valido,
    ADD CONSTRAINT detalle_permisos_horario_valido CHECK (hora_fin > hora_inicio);

CREATE INDEX IF NOT EXISTS permisos_idx_id_t_decision ON permisos (id_t_decision);
CREATE INDEX IF NOT EXISTS detalle_permisos_idx_conflicto
    ON detalle_permisos (id_l, fecha, hora_inicio, hora_fin);

COMMIT;
