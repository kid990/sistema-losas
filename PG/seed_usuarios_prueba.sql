-- Cuentas locales de prueba: una por rol. Contraseña: 12345678.
-- Los códigos coinciden con los datos de ejemplo del padrón UNHEVAL.
-- No modifica cuentas que ya existan. Ejecutar conectado a losa.
BEGIN;
INSERT INTO users (codigo, password, rol, estado) VALUES
('20241001','$2b$10$Jv.usvsYNHeBKUCnPzGMkuGOazPnxpvnMcGaznxE/b/4JjSpwt/QO','Alumno','Activo'),
('20240001','$2b$10$XgtIz0GiqvE6OeZVjC7nGuK5CHFcevTBj9tLnRTN8qEb6p3y/OayO','Docente','Activo'),
('20242001','$2b$10$8KWHgsGaFRWWcf8/HkXqqeKMUargusMMtQchuykZYjamSa2zcsNWy','PersonalAdministrativo','Activo')
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO trabajadores (dni, nombres, apellido_p, apellido_m, rol, email, password, estado) VALUES
('90000001','Admin','Prueba','Local','Administrador','admin.prueba@example.com','$2b$10$AnKeM0Mt/E4pf508uSVot.ECGZAWZgni.7njS5MqDBwn0YSzDe9r.','Activo'),
('90000002','Seguridad','Prueba','Local','Seguridad','seguridad.prueba@example.com','$2b$10$0YCdudX75NTapB4OyHFPruXm5Dh/uh/mEm9vDyeQ9vU0aHP9YJBfO','Activo')
ON CONFLICT DO NOTHING;
COMMIT;
