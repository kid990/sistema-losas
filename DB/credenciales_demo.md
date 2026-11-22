# 🔑 Credenciales Iniciales de Prueba — Sistema LOSA UNHEVAL

Las siguientes credenciales están configuradas en los scripts de semillas iniciales ([PG/seed_usuarios_prueba.sql](PG/seed_usuarios_prueba.sql)) y cargadas en la base de datos activa (Supabase):

---

### 🛡️ 1. Rol Administrador
- **Email**: `admin.prueba@example.com` *(o `davidchipaco@gmail.com`)*
- **Contraseña**: `12345678`
- **Estado**: ✅ **EXITOSO** — Sesión iniciada con rol Administrador.
- **Acceso**: Panel completo `/dashboard/inicio` (Gestión de usuarios, losas, disciplinas, permisos, imágenes S3/B2 y configuración).

---

### 🔒 2. Rol Personal de Seguridad
- **Email**: `seguridad.prueba@example.com` *(o `seguridad@unheval.edu`)*
- **Contraseña**: `12345678`
- **Acceso**: Módulo de vigilancia `/seguridad/modulo` (Control de acceso físico con listado de permisos del día, losas y horarios).

---

### 👤 3. Rol Alumno / Usuario
- **Código Universitario**: `20241001`
- **Contraseña**: `12345678`
- **Estado**: ✅ **EXITOSO** — Sesión iniciada con rol Alumno.
- **Otros alumnos de prueba**: `20241002`, Docente: `20240001`, Administrativo: `20242001` (todos con clave `12345678`).
- **Acceso**: Módulo de usuario `/permiso` y reservación pública `/losas`.

---

> [!NOTE]
> Todos los permisos (`permisos`), detalles de permisos (`detalle_permisos`), notificaciones e imágenes han sido **limpiados a 0** para que puedas registrar reservaciones y subir archivos reales a S3/B2 desde el sistema.
