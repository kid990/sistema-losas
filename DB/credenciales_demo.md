# 🔑 Credenciales Iniciales de Prueba — Sistema LOSA UNHEVAL

Las siguientes credenciales están configuradas en el script de semillas iniciales ([sistema_losa_data.sql](DB/sistema_losa_data.sql)) para realizar pruebas tras recrear la base de datos limpia:

---

### 🛡️ 1. Rol Administrador
- **Email**: `davidchipaco@gmail.com`
- **Contraseña**: `12345678`
- **Acceso**: Panel completo `/dashboard/inicio` (Gestión de usuarios, losas, disciplinas, permisos, imágenes S3/B2 y configuración).

---

### 🔒 2. Rol Personal de Seguridad
- **Email**: `seguridad@unheval.edu`
- **Contraseña**: `12345678`
- **Acceso**: Módulo de vigilancia `/seguridad/modulo` (Control de acceso físico con listado de permisos del día, losas y horarios).

---

### 👤 3. Rol Alumno / Usuario
- **Código Universitario**: `20241001`
- **Contraseña**: `12345678`
- **Acceso**: Módulo de usuario `/permiso` y reservación pública `/losas`.

---

> [!NOTE]
> Todos los permisos (`permisos`), detalles de permisos (`detalle_permisos`), notificaciones e imágenes han sido **limpiados a 0** para que puedas registrar reservaciones y subir archivos reales a S3/B2 desde el sistema.
