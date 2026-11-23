# 🔑 Credenciales locales de demostración — Sistema LOSA UNHEVAL

> [!WARNING]
> Estas cuentas son exclusivamente para desarrollo local. No deben crearse ni habilitarse en producción.

Las siguientes credenciales están configuradas en el script de semillas
[`PG/seed_usuarios_prueba.sql`](../PG/seed_usuarios_prueba.sql) y se cargan únicamente cuando el
desarrollador ejecuta esas semillas en su base local:

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
> En la base local preparada por las semillas, los permisos (`permisos`), detalles
> (`detalle_permisos`), notificaciones e imágenes comienzan vacíos para facilitar las pruebas.
