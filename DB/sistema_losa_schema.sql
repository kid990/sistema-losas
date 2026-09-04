-- ============================================================
-- SISTEMA DE GESTIÓN DE PERMISOS DEPORTIVOS - UNHEVAL
-- Esquema completo de base de datos (sistema_losa)
-- ============================================================
-- 2. Crear la base de datos limpia de nuevo
CREATE DATABASE sistema_losa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 3. Seleccionar la base de datos para trabajar
USE sistema_losa;

-- 1. DISCIPLINAS DEPORTIVAS
CREATE TABLE disciplinas (
    id_d INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo'
) ENGINE=InnoDB;

-- 2. USUARIOS (alumnos, docentes, personal administrativo)
CREATE TABLE users (
    id_u INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(15) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    rol ENUM('Alumno','Docente','PersonalAdministrativo') NOT NULL,
    estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. TRABAJADORES (administradores, seguridad)
CREATE TABLE trabajadores (
    id_t INT AUTO_INCREMENT PRIMARY KEY,
    dni VARCHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(30) NOT NULL,
    apellido_p VARCHAR(30) NOT NULL,
    apellido_m VARCHAR(30) NOT NULL,
    rol ENUM('Administrador','Seguridad') NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    telefono VARCHAR(15),
    estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. LOSAS DEPORTIVAS
CREATE TABLE losas (
    id_l INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    numero_l VARCHAR(2) NOT NULL UNIQUE,
    ubicacion VARCHAR(100) NOT NULL,
    dimensiones VARCHAR(100),
    superficie VARCHAR(100),
    iluminacion VARCHAR(100),
    id_d INT NOT NULL,
    estado ENUM('Disponible','Mantenimiento','Inactiva') NOT NULL DEFAULT 'Disponible',
    FOREIGN KEY (id_d) REFERENCES disciplinas(id_d)
) ENGINE=InnoDB;

-- 5. IMÁGENES DE LOSAS
CREATE TABLE imagenes (
    id_img INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL,
    id_l INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_l) REFERENCES losas(id_l)
) ENGINE=InnoDB;

-- 5.5 ARCHIVOS ADJUNTOS (S3/B2)
CREATE TABLE archivos (
    id_arch INT AUTO_INCREMENT PRIMARY KEY,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_unico VARCHAR(255) NOT NULL UNIQUE,
    mimetype VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL,
    tamanio INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. PERMISOS (solicitudes de reserva)
CREATE TABLE permisos (
    id_p INT AUTO_INCREMENT PRIMARY KEY,
    id_u INT NULL,
    id_t INT NULL,
    autor ENUM('Usuario','Administrador') NOT NULL DEFAULT 'Usuario',
    tipo ENUM('Normal','Especial') NOT NULL,
    id_arch INT NULL,
    duracion_t INT NOT NULL,
    estado ENUM('Pendiente','Aceptado','Rechazado','Cancelado') DEFAULT 'Pendiente',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_decision DATETIME NULL,
    FOREIGN KEY (id_u) REFERENCES users(id_u),
    FOREIGN KEY (id_t) REFERENCES trabajadores(id_t),
    FOREIGN KEY (id_arch) REFERENCES archivos(id_arch) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 7. DETALLE DE PERMISOS (reservas por losa, fecha y hora)
CREATE TABLE detalle_permisos (
    id_d INT AUTO_INCREMENT PRIMARY KEY,
    id_p INT NOT NULL,
    id_l INT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    duracion INT NOT NULL,
    FOREIGN KEY (id_p) REFERENCES permisos(id_p),
    FOREIGN KEY (id_l) REFERENCES losas(id_l)
) ENGINE=InnoDB;

-- 8. NOTIFICACIONES
CREATE TABLE notificacion (
    id_n INT AUTO_INCREMENT PRIMARY KEY,
    mensaje TEXT,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo ENUM('Aceptado', 'Rechazado', 'Cancelado','Pendiente') NOT NULL,
    id_p INT,
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (id_p) REFERENCES permisos(id_p)
) ENGINE=InnoDB;

-- 8.5 COLA DE ENVÍO DE NOTIFICACIONES (Email, SMS, Push en segundo plano)
CREATE TABLE cola_notificaciones (
    id_cola INT AUTO_INCREMENT PRIMARY KEY,
    tipo_canal ENUM('Email', 'Push', 'SMS') NOT NULL DEFAULT 'Email',
    destinatario VARCHAR(255) NOT NULL,
    asunto VARCHAR(255) NULL,
    cuerpo TEXT NOT NULL,
    estado ENUM('Pendiente', 'EnProceso', 'Enviado', 'Fallido') NOT NULL DEFAULT 'Pendiente',
    intentos INT NOT NULL DEFAULT 0,
    ultimo_error TEXT NULL,
    fecha_envio DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_estado_intentos (estado, intentos)
) ENGINE=InnoDB;

-- 9. CONFIGURACIÓN GLOBAL DEL SISTEMA
CREATE TABLE configuracion_global (
    id TINYINT PRIMARY KEY DEFAULT 1,
    hora_min_solicitud TIME NOT NULL DEFAULT '07:00:00',
    hora_max_solicitud TIME NOT NULL DEFAULT '19:00:00',
    hora_min_apertura TIME NOT NULL DEFAULT '07:00:00',
    hora_max_apertura TIME NOT NULL DEFAULT '19:00:00',
    restriccion_hoy TIME NOT NULL DEFAULT '09:00:00',
    max_horas_semana DECIMAL(4,2) NOT NULL DEFAULT 3.00
) ENGINE=InnoDB;

-- 10. DÍAS BLOQUEADOS
CREATE TABLE dias_bloqueados (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha DATE NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_fecha (fecha)
) ENGINE=InnoDB;

-- 11. SESIONES DE USUARIO (refresh tokens + single-device)
CREATE TABLE user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_type ENUM('usuario', 'trabajador') NOT NULL,
    refresh_token_hash CHAR(64) NOT NULL UNIQUE,
    device_name VARCHAR(150),
    browser VARCHAR(80),
    operating_system VARCHAR(80),
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_active (user_id, user_type, revoked_at),
    INDEX idx_token_hash (refresh_token_hash),
    INDEX idx_expiry (expires_at)
) ENGINE=InnoDB;

-- 12. TOKENS DE RECUPERACIÓN DE CONTRASEÑA
CREATE TABLE password_reset_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_type ENUM('usuario', 'trabajador') NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id, user_type),
    INDEX idx_expiry (expires_at, used_at)
) ENGINE=InnoDB;

