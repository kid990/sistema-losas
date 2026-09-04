-- ============================================================
-- BASE DE DATOS: api_unheval
-- Esquema completo de la API UNHEVAL (api_unheval_schema.sql)
-- ============================================================

-- Tabla de Facultad
CREATE TABLE facultad (
    id_fac INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

-- Tabla de Escuela Profesional
CREATE TABLE escuela_profesional (
    id_esc INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(15) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    id_fac INT NOT NULL,
    FOREIGN KEY (id_fac) REFERENCES facultad(id_fac)
);

-- Tabla de Alumnos
CREATE TABLE alumno (
    id_al INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(15) NOT NULL UNIQUE,
    dni VARCHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellido_p VARCHAR(100) NOT NULL,
    apellido_m VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(15),
    año_academico INT,
    id_esc INT NOT NULL,
    FOREIGN KEY (id_esc) REFERENCES escuela_profesional(id_esc)
);

-- Tabla de Docentes
CREATE TABLE docente (
    id_doc INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(15) NOT NULL UNIQUE,
    dni VARCHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellido_p VARCHAR(100) NOT NULL,
    apellido_m VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(15),
    id_esc INT NOT NULL,
    FOREIGN KEY (id_esc) REFERENCES escuela_profesional(id_esc)
);

-- Tabla de Personal Administrativo
CREATE TABLE personal_administrativo (
    id_pa INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(15) NOT NULL UNIQUE,
    dni VARCHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellido_p VARCHAR(100) NOT NULL,
    apellido_m VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(15),
    id_esc INT NOT NULL,
    FOREIGN KEY (id_esc) REFERENCES escuela_profesional(id_esc)
);

-- Vista unificada de usuarios
CREATE VIEW VistaUsuario AS
SELECT
    a.codigo, a.dni, a.nombres, a.apellido_p, a.apellido_m,
    CONCAT(a.apellido_p, ' ', a.apellido_m) AS apellidos,
    CONCAT(a.nombres, ' ', a.apellido_p, ' ', a.apellido_m) AS nombre_completo,
    a.email, a.telefono,
    ep.nombre AS escuela, f.nombre AS facultad,
    a.año_academico, 'Alumno' AS rol
FROM alumno a
    JOIN escuela_profesional ep ON a.id_esc = ep.id_esc
    JOIN facultad f ON ep.id_fac = f.id_fac
UNION ALL
SELECT
    d.codigo, d.dni, d.nombres, d.apellido_p, d.apellido_m,
    CONCAT(d.apellido_p, ' ', d.apellido_m) AS apellidos,
    CONCAT(d.nombres, ' ', d.apellido_p, ' ', d.apellido_m) AS nombre_completo,
    d.email, d.telefono,
    ep.nombre AS escuela, f.nombre AS facultad,
    NULL AS año_academico, 'Docente' AS rol
FROM docente d
    JOIN escuela_profesional ep ON d.id_esc = ep.id_esc
    JOIN facultad f ON ep.id_fac = f.id_fac
UNION ALL
SELECT
    p.codigo, p.dni, p.nombres, p.apellido_p, p.apellido_m,
    CONCAT(p.apellido_p, ' ', p.apellido_m) AS apellidos,
    CONCAT(p.nombres, ' ', p.apellido_p, ' ', p.apellido_m) AS nombre_completo,
    p.email, p.telefono,
    ep.nombre AS escuela, f.nombre AS facultad,
    NULL AS año_academico, 'Personal Administrativo' AS rol
FROM personal_administrativo p
    JOIN escuela_profesional ep ON p.id_esc = ep.id_esc
    JOIN facultad f ON ep.id_fac = f.id_fac;
