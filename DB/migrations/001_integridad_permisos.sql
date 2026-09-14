ALTER TABLE permisos
    ADD COLUMN id_t_decision INT NULL AFTER id_t,
    ADD CONSTRAINT permisos_fk_id_t_decision
        FOREIGN KEY (id_t_decision) REFERENCES trabajadores(id_t),
    ADD CONSTRAINT permisos_duracion_t_positiva CHECK (duracion_t > 0);

ALTER TABLE detalle_permisos
    ADD CONSTRAINT detalle_permisos_duracion_positiva CHECK (duracion > 0),
    ADD CONSTRAINT detalle_permisos_horario_valido CHECK (hora_fin > hora_inicio),
    ADD INDEX idx_detalle_conflicto (id_l, fecha, hora_inicio, hora_fin);
