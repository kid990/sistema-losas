BEGIN;

CREATE TABLE IF NOT EXISTS prediccion_ocupacion (
    fecha DATE NOT NULL,
    hora SMALLINT NOT NULL,
    id_l INT NOT NULL REFERENCES losas(id_l) ON DELETE CASCADE,
    probabilidad NUMERIC(4, 3) NOT NULL,
    modelo_version VARCHAR(60) NOT NULL,
    generado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (fecha, hora, id_l),
    CONSTRAINT prediccion_hora_valida CHECK (hora BETWEEN 0 AND 23),
    CONSTRAINT prediccion_probabilidad_valida CHECK (probabilidad BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS prediccion_ocupacion_idx_fecha
    ON prediccion_ocupacion (fecha);

COMMIT;
