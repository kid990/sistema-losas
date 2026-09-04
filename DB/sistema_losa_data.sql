-- ============================================================
-- DATOS SEMILLA BÁSICOS - SISTEMA DE PERMISOS DEPORTIVOS UNHEVAL
-- Ejecutar DESPUÉS de sistema_losa_schema.sql (esquema)
-- ============================================================

USE sistema_losa;

-- 1. CONFIGURACIÓN GLOBAL (valores por defecto)
INSERT IGNORE INTO configuracion_global (id) VALUES (1);

-- 2. DISCIPLINAS DEPORTIVAS
INSERT IGNORE INTO disciplinas (id_d, nombre, estado) VALUES
    (1, 'Fútbol', 'Activo'),
    (2, 'Vóley', 'Activo'),
    (3, 'Básquet', 'Activo'),
    (4, 'Tenis', 'Activo'),
    (5, 'Natación', 'Activo');

-- 3. USUARIOS (Alumno demo inicial)
-- Password: "12345678" (bcrypt hash)
INSERT IGNORE INTO users (codigo, password, rol, estado) VALUES
    ('20241001', '$2b$10$ad55/Q0N/fytcEFn3kD23e8GVUPIMtyiLdb5ZakYiaJHLOIP.7ij.', 'Alumno', 'Activo'),
    ('20241002', '$2b$10$ad55/Q0N/fytcEFn3kD23e8GVUPIMtyiLdb5ZakYiaJHLOIP.7ij.', 'Alumno', 'Activo'),
    ('20240001', '$2b$10$ad55/Q0N/fytcEFn3kD23e8GVUPIMtyiLdb5ZakYiaJHLOIP.7ij.', 'Docente', 'Activo');

-- 4. TRABAJADORES (Administrador y Seguridad)
-- Password: "12345678" (bcrypt hash)
INSERT IGNORE INTO trabajadores (dni, nombres, apellido_p, apellido_m, rol, email, password, telefono, estado) VALUES
    ('12345678', 'Juan Carlos', 'García', 'López', 'Administrador', 'davidchipaco@gmail.com', '$2b$10$ad55/Q0N/fytcEFn3kD23e8GVUPIMtyiLdb5ZakYiaJHLOIP.7ij.', '987654321', 'Activo'),
    ('87654321', 'María Elena', 'Rodríguez', 'Martínez', 'Seguridad', 'seguridad@unheval.edu', '$2b$10$ad55/Q0N/fytcEFn3kD23e8GVUPIMtyiLdb5ZakYiaJHLOIP.7ij.', '987654322', 'Activo');

-- 5. LOSAS DEPORTIVAS (Limpias para registrar imágenes reales)
INSERT IGNORE INTO losas (id_d, nombre, numero_l, ubicacion, dimensiones, superficie, iluminacion, estado) VALUES
    (1, 'Losa 01', '01', 'Complejo Deportivo Norte', '28m x 15m', 'Cemento Pulido', 'Led 500W', 'Disponible'),
    (1, 'Losa 02', '02', 'Complejo Deportivo Norte', '28m x 15m', 'Cemento Pulido', 'Led 500W', 'Disponible'),
    (2, 'Losa 03', '03', 'Coliseo Techado', '18m x 9m', 'Parquet', 'Led 800W', 'Disponible'),
    (3, 'Losa 04', '04', 'Complejo Deportivo Sur', '28m x 15m', 'Asfalto', 'Led 400W', 'Disponible'),
    (4, 'Losa 05', '05', 'Club de Tenis UNHEVAL', '23.77m x 10.97m', 'Arcilla', 'Led 600W', 'Disponible');
