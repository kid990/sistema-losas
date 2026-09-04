# Especificación inversa: Sistema de Losas Deportivas UNHEVAL

## 1. Alcance y método

Este documento describe el comportamiento observado en el código del repositorio `SISTEMA_LOSA`. La revisión cubrió:

- entrada y configuración de `backend`, `backend_api` y `frontend`;
- rutas HTTP, controladores, servicios, middlewares y esquema MySQL;
- rutas, layouts, loaders, actions, servicios SSR y componentes del frontend;
- autenticación, autorización, validación, manejo de errores e integraciones;
- flujos de usuario, administrador y personal de seguridad;
- comprobación estática mediante `pnpm typecheck` en el frontend y `node --check` en el backend.

No se ejecutaron flujos contra una base de datos o servicios externos reales. Por eso se distingue entre comportamiento observado en código e inferencias de producto.

## 2. Resumen ejecutivo

El sistema gestiona el uso de losas deportivas de la UNHEVAL. Sus actores son:

1. **Alumno, docente o usuario institucional**: inicia sesión con código, consulta losas y horarios, solicita permisos y revisa su historial.
2. **Administrador**: gestiona el padrón, trabajadores, disciplinas, losas, imágenes, configuración y decisiones sobre permisos.
3. **Seguridad**: consulta permisos aceptados para controlar el ingreso físico.

Existen dos flujos de reserva:

- **Normal**: se solicita para el día actual y un bloque de una hora desde el frontend. El backend lo acepta automáticamente si supera restricciones académicas y no hay choque.
- **Especial**: permite fecha futura y varios bloques, exige documento, se guarda como `Pendiente` y luego el administrador lo acepta, rechaza o cancela.

La solución se divide en cuatro piezas:

```text
Navegador
   ↓ HTTP
Frontend React Router 8 SSR (puerto 5173)
   ↓ REST / cookies reenviadas
Backend Express 5 (puerto 3000)
   ├── MySQL: sistema_losa
   ├── API padrón UNHEVAL (puerto 3001)
   ├── API RENIEC
   ├── Storage S3 compatible
   └── SMTP o registro local de correo

API UNHEVAL Express (puerto 3001)
   ↓
MySQL: api_unheval / vista VistaUsuario
```

## 3. Stack y estructura

### Backend principal

- Node.js 22+ y CommonJS.
- Express 5.
- MySQL 8 mediante `mysql2/promise`.
- Cookies firmadas con `cookie-parser`.
- JWT de acceso y refresh con `jsonwebtoken`.
- Contraseñas con `bcryptjs` y costo 10.
- Helmet, CORS y `express-rate-limit`.
- Multer en memoria para archivos.
- S3 compatible mediante AWS SDK.
- Nodemailer para correo.
- Zod, actualmente aplicado solo a autenticación/recuperación.

Estructura de cada dominio:

```text
backend/src/modules/<dominio>/
├── *.routes.js       # superficie HTTP
├── *.controller.js   # request/response
├── *.service.js      # SQL y reglas
└── *.validator.js    # solo existe en auth
```

### Frontend

- React 19.
- React Router 8 en modo framework con SSR.
- TypeScript 5 en modo estricto.
- Vite 8 y Tailwind CSS 4.
- `react-data-table-component` para tablas.
- SweetAlert2 para confirmaciones y feedback.
- `react-icons` para iconografía.
- No usa Redux, Zustand, React Query ni otra tienda global.

Estructura:

```text
frontend/app/
├── root.tsx                 # documento HTML y ErrorBoundary
├── routes.ts                # árbol completo de rutas
├── features/                # páginas por dominio y rol
├── layouts/                 # User, Admin y Security
├── services/
│   ├── auth.server.ts       # cookie de sesión SSR y guards
│   └── api.server.ts        # cliente REST y refresh reactivo
├── shared/components/       # navegación, tablas y UI
├── shared/types/            # roles
├── shared/utils/            # formato de fecha
└── lib/                     # constantes e interfaces
```

### API de padrón UNHEVAL

`backend_api/index.js` expone:

- `GET /api/usuarios`: todos los registros de `VistaUsuario`;
- `GET /api/usuario/:codigo`: un registro por código;
- `GET /api/test`: comprobación de salud.

El backend principal depende de esta API para sincronizar usuarios, completar nombres/perfil y aplicar restricciones grupales a alumnos.

## 4. Modelo de datos

| Tabla | Responsabilidad | Relaciones principales |
|---|---|---|
| `users` | Alumnos, docentes y personal administrativo institucional | `permisos.id_u` |
| `trabajadores` | Administradores y seguridad | `permisos.id_t` |
| `disciplinas` | Catálogo deportivo | `losas.id_d` |
| `losas` | Campos físicos y estado operativo | disciplina, imágenes y detalles |
| `imagenes` | Galería de cada losa | `imagenes.id_l` |
| `archivos` | Metadatos de documentos subidos a S3 | `permisos.id_arch` |
| `permisos` | Cabecera de una solicitud | usuario/trabajador, archivo y detalles |
| `detalle_permisos` | Losa, fecha y bloque horario | permiso y losa |
| `notificacion` | Eventos de estado de un permiso | `notificacion.id_p` |
| `configuracion_global` | Horarios y límites globales | fila única `id = 1` |
| `dias_bloqueados` | Fechas sin nuevas solicitudes | fecha única |
| `user_sessions` | Refresh tokens rotativos y sesión única | usuario o trabajador lógico |
| `password_reset_tokens` | Recuperación de contraseña | usuario o trabajador lógico |
| `cola_notificaciones` | Cola prevista para email/push/SMS | no usada por el código actual |

Estados observados:

- usuario/trabajador: `Activo`, `Inactivo`;
- disciplina: `Activo`, `Inactivo`;
- losa: `Disponible`, `Mantenimiento`, `Inactiva`;
- permiso: `Pendiente`, `Aceptado`, `Rechazado`, `Cancelado`;
- notificación: `Pendiente`, `Aceptado`, `Rechazado`, `Cancelado`.

## 5. Lógica funcional del sistema

### 5.1 Sincronización del padrón

1. El administrador pulsa **Sincronizar Padrón**.
2. El frontend ejecuta `POST /api/users/cargar`.
3. El backend consulta `http://localhost:3001/api/usuarios`.
4. Agrupa registros por rol y procesa lotes de 10.
5. Si un código no existe localmente, crea `users` con:
   - código recibido;
   - rol recibido o `Alumno`;
   - contraseña inicial igual al código, almacenada con bcrypt.
6. Los usuarios existentes no se actualizan: solo se contabilizan como existentes.

Al listar usuarios, el sistema combina la tabla local con `VistaUsuario` para mostrar nombre y escuela. Si la API externa falla, conserva el listado local y muestra `-` en esos campos.

### 5.2 Inicio de sesión y sesión

El login es unificado en `/login`:

- si el identificador contiene `@`, usa `POST /api/auth/login/trabajador`;
- en caso contrario usa `POST /api/auth/login/usuario`.

El backend verifica contraseña y estado `Activo`. Antes de crear una nueva sesión, revoca todas las sesiones activas del mismo usuario y tipo; por diseño, el último inicio de sesión desplaza al dispositivo anterior.

Se generan:

- access token de 15 minutos;
- refresh token de 7 días;
- cookie de frontend `_session` que contiene solo los datos mínimos del usuario y dura 5 horas.

Las cookies JWT son `httpOnly`, firmadas, `sameSite=lax` en desarrollo y `strict` en producción; `secure` se activa en producción. El refresh token queda limitado al path `/api/auth`.

Redirecciones después del login:

| Identidad | Destino |
|---|---|
| trabajador + Administrador | `/dashboard/inicio` |
| trabajador + Seguridad | `/seguridad/modulo` |
| usuario institucional | `/horario` |

El refresh rota el refresh token: invalida la sesión anterior y crea otra. El logout revoca el refresh token y elimina las cookies.

### 5.3 Permiso normal

Flujo pretendido y mayormente implementado:

1. El usuario entra a `/horario` o `/losas`.
2. Selecciona una losa disponible y un bloque de una hora para hoy.
3. El frontend envía `tipo=Normal`, `id_u`, duración total y detalles.
4. El backend comprueba que hoy no figure en `dias_bloqueados`.
5. Consulta la API UNHEVAL para identificar año académico y escuela del alumno.
6. Forma el grupo de alumnos del mismo año y escuela.
7. Rechaza si el grupo ya tiene un permiso normal aceptado creado hoy.
8. Suma las horas normales aceptadas creadas durante la semana y las compara con `max_horas_semana`.
9. Si ya hubo un permiso anterior en la semana, rechaza nuevas solicitudes antes de `restriccion_hoy`.
10. Valida que la losa exista y esté `Disponible`.
11. Rechaza cualquier solapamiento con detalles de permisos `Pendiente` o `Aceptado` mediante la condición:

```text
inicio_existente < fin_nuevo AND fin_existente > inicio_nuevo
```

12. Inserta permiso y detalles dentro de una transacción.
13. El permiso queda `Aceptado` inmediatamente.
14. Crea una notificación y trata de enviar un correo con los bloques asignados.

Observación importante: los límites grupales usan `fecha_creacion` del permiso, no la fecha de uso del detalle.

### 5.4 Permiso especial

1. En `/horario`, el usuario elige **Especial**.
2. Puede seleccionar una fecha desde hoy hacia adelante y varios bloques/losas.
3. Debe adjuntar un documento desde el modal.
4. El frontend envía `multipart/form-data`.
5. El backend exige un archivo, lo sube al storage S3 compatible y registra metadatos en `archivos`.
6. Inserta permiso y detalles con estado `Pendiente`.
7. Intenta enviar un correo de recepción.
8. El administrador revisa la solicitud en `/dashboard/permisos` y decide su estado.

En el código actual no se ejecuta `checkConflicts` para permisos especiales y tampoco se vuelve a comprobar el choque cuando un administrador los acepta.

### 5.5 Decisión administrativa

El administrador filtra solicitudes por estado, abre detalles y envía:

```text
PUT /api/permisos/:id/estado
{ estado, id_t }
```

El servicio exige un `id_t` válido. Sin embargo, la implementación actual de la pantalla no agrega `id_t` al `FormData`; la action lo transforma en `0`, por lo que el backend responde 400. El código del navegador tampoco revisa `response.ok` y puede mostrar una confirmación de éxito aunque el estado no haya cambiado.

El backend:

- actualiza `estado`, el trabajador decisor y `fecha_decision`;
- crea una notificación;
- obtiene los detalles;
- intenta enviar correo al solicitante;
- devuelve si el permiso fue encontrado.

No existe una máquina de estados estricta: el endpoint acepta cualquier valor que MySQL permita y no verifica una transición como `Pendiente → Aceptado`.

### 5.6 Control de seguridad

El módulo `/seguridad/modulo` carga `GET /api/permisos/aceptado-detalle`, muestra los bloques aceptados y permite buscar por permiso, losa, disciplina, fecha u horario. También abre los detalles y, para especiales, intenta abrir el documento.

La consulta de backend devuelve **todos** los detalles aceptados sin restringirlos al día actual. Por tanto, la interfaz dice “vigentes/en garita”, pero puede mostrar registros pasados y futuros.

### 5.7 Notificaciones

- Un permiso normal crea una notificación `Aceptado`.
- Cada cambio administrativo crea una nueva notificación con el nuevo estado.
- El usuario ve lista y contador en la barra superior.
- Puede marcar una o todas como leídas.
- El administrador posee una pantalla de consulta global.

Los correos se envían fuera de la transacción principal y sus errores normalmente se ignoran para no revertir el permiso. Sin SMTP configurado se usa un transporte de stream y se registra un resumen en el archivo configurado.

### 5.8 Configuración global

El administrador modifica:

- hora mínima/máxima de solicitud;
- hora mínima/máxima de apertura;
- hora de restricción para grupos que ya reservaron esa semana;
- máximo de horas semanales;
- días bloqueados y sus motivos.

Uso real observado:

- apertura/cierre genera los bloques visuales del frontend;
- `restriccion_hoy` y `max_horas_semana` participan en la regla grupal;
- días bloqueados impiden crear solicitudes el día bloqueado;
- las horas mínima/máxima de **solicitud** se almacenan y muestran, pero no se aplican al registrar permisos.

## 6. Cómo está armado el frontend

### 6.1 Modelo SSR de React Router

Cada página puede exportar:

- `loader`: corre en el servidor antes de renderizar y carga datos;
- `action`: corre en el servidor al enviar formularios o mutaciones;
- componente React: renderiza y mantiene estado de interfaz.

Flujo típico:

```text
Navegador solicita /horario
  → UserLayout.loader valida la cookie _session
  → horario.loader llama al backend con api.server.ts
  → React Router renderiza HTML en el servidor
  → React hidrata la página en el navegador
  → el usuario selecciona bloques con useState
  → POST a la action de la misma ruta
  → action llama a Express
  → React Router revalida loaders y actualiza la pantalla
```

El estado de negocio persistente vive en MySQL. El estado temporal de pantalla —modal abierto, filtros, losa elegida, bloques elegidos, carga— vive en `useState`/`useMemo`. No hay caché global del cliente.

### 6.2 Árbol de rutas

#### Públicas

| Ruta | Uso |
|---|---|
| `/` | landing institucional; redirige si ya existe sesión |
| `/login` | acceso unificado |
| `/forgot-password` | solicitud de recuperación |
| `/reset-password` | cambio mediante token |
| `/logout` | cierre por loader o action |

#### Usuario institucional

Protegidas por `UserLayout`:

| Ruta | Pantalla |
|---|---|
| `/losas` | explorar disciplinas, losas, galería y reserva rápida |
| `/horario` | cuadrícula completa de disponibilidad y permiso normal/especial |
| `/perfil` | datos UNHEVAL y cambio de contraseña |
| `/permiso` | historial y detalle de solicitudes |
| `/user/notifs` | action para marcar notificaciones |

#### Administrador

Protegidas por `AdminLayout`:

| Ruta | Pantalla |
|---|---|
| `/dashboard/inicio` | métricas rápidas |
| `/dashboard/usuarios` | padrón y activación/desactivación |
| `/dashboard/permisos` | solicitudes por estado y decisión |
| `/dashboard/detalle-permisos` | bloques aceptados |
| `/dashboard/trabajadores` | CRUD de administradores/seguridad |
| `/dashboard/losas` | CRUD de losas y estado operativo |
| `/dashboard/disciplinas` | CRUD y activación de disciplinas |
| `/dashboard/imagenes` | carga y eliminación de imágenes |
| `/dashboard/configuracion` | parámetros y días bloqueados |
| `/dashboard/notificacion` | listado global |
| `/dashboard/perfil` | perfil y contraseña |

#### Seguridad

Protegidas por `SecurityLayout`:

| Ruta | Pantalla |
|---|---|
| `/seguridad/modulo` | control de permisos aceptados |
| `/seguridad/perfil` | perfil y contraseña |

### 6.3 Layouts y navegación

- `UserLayout`: navbar horizontal, notificaciones, breadcrumb y contenido centrado de hasta 1400 px.
- `AdminLayout`: sidebar fijo de 260 px en escritorio, drawer con overlay en móvil, navbar superior y contenido.
- `SecurityLayout`: navbar azul marino, breadcrumb y módulo de control.
- `Sidebar`: diez entradas administrativas.
- `TablaGenerica`: wrapper de tabla reutilizable con acciones y estados vacíos.
- `shared/components/ui/index.tsx`: botones, campos, select, modal, badge y spinner reutilizables.

### 6.4 Cliente de API

`api.server.ts`:

- concatena `API_BASE_URL` con la ruta;
- reenvía la cabecera `Cookie` del navegador al backend;
- serializa JSON salvo para `FormData`;
- convierte fallos en `ApiError`;
- si recibe `401` con `TOKEN_EXPIRED`, llama a `/auth/refresh` y reintenta una vez;
- define helpers `get`, `post`, `put`, `patch` y `delete`.

Los uploads especiales e imágenes usan `fetch` manual desde una action SSR para conservar `multipart/form-data`.

### 6.5 Diseño visual

- Paleta institucional basada en `#1B6EB6`, sidebar oscuro y módulo seguridad `#003366`.
- Variables CSS y utilidades Tailwind.
- Tipografía Inter/Plus Jakarta Sans cargada desde Google Fonts.
- Tarjetas redondeadas, badges semánticos y SweetAlert2.
- Breakpoints móviles y tablas con scroll horizontal.
- Hay clases `dark:*` en algunas vistas, pero no se encontró controlador de tema ni persistencia en `localStorage`; el “modo oscuro con persistencia” descrito en README no está implementado de extremo a extremo.

## 7. Manual de uso

### 7.1 Arranque local

1. Crear las bases con `DB/sistema_losa_schema.sql` y `DB/sistema_losa_data.sql`.
2. Opcionalmente crear `api_unheval` con sus scripts si se usarán padrón y restricciones grupales.
3. Configurar `backend/.env` y ejecutar en `backend`: `pnpm install` y `pnpm dev`.
4. Ejecutar `backend_api` en puerto 3001 si se necesita la integración UNHEVAL.
5. Configurar `frontend/.env` y ejecutar en `frontend`: `pnpm install` y `pnpm dev`.
6. Abrir `http://localhost:5173`.

Para permisos especiales se necesita storage S3 configurado. Para correo real se necesita SMTP; RENIEC requiere URL y token.

### 7.2 Usuario

1. Ingresar con código universitario y contraseña.
2. Usar **Losas** para ver ficha, galería y reservar rápidamente hoy.
3. Usar **Horario** para ver la cuadrícula:
   - verde: disponible;
   - rojo: ocupado;
   - gris: expirado;
   - azul: seleccionado.
4. Para normal, elegir un bloque de hoy y confirmar.
5. Para especial, elegir fecha/bloques, adjuntar documento y enviar.
6. Revisar **Mis permisos** y la campana de notificaciones.
7. Cambiar contraseña desde **Perfil**.

### 7.3 Administrador

1. Ingresar con correo.
2. Sincronizar el padrón desde **Usuarios**.
3. Mantener disciplinas, losas, imágenes y trabajadores.
4. Configurar apertura, restricciones, límite semanal y días bloqueados.
5. Abrir **Permisos**, filtrar por estado y revisar cada solicitud.
6. Aceptar, rechazar o cancelar. En la versión actual este paso está afectado por el defecto de `id_t=0` descrito en Hallazgos.
7. Consultar bloques aceptados y notificaciones.

### 7.4 Seguridad

1. Ingresar con correo de seguridad.
2. Abrir **Permisos**.
3. Buscar por ID, fecha, horario, losa o disciplina.
4. Revisar bloques y documento especial antes de permitir el acceso.
5. Gestionar su contraseña desde **Perfil**.

## 8. Requisitos observados en formato EARS

### Autenticación

**OBS-AUTH-001.** Cuando el identificador de login contiene `@`, el frontend deberá autenticar contra el endpoint de trabajadores; en caso contrario deberá usar el endpoint de usuarios.

**OBS-AUTH-002.** Cuando las credenciales son válidas y la cuenta está activa, el backend deberá emitir cookies firmadas httpOnly de acceso y refresh.

**OBS-AUTH-003.** Cuando una identidad inicia una nueva sesión, el backend deberá revocar sus sesiones activas anteriores.

**OBS-AUTH-004.** Cuando se rota un refresh token válido, el backend deberá revocar la sesión anterior y registrar una nueva.

### Reservas

**OBS-PERM-001.** Cuando un usuario registra un permiso normal sin conflictos ni restricciones, el sistema deberá guardarlo como `Aceptado`.

**OBS-PERM-002.** Cuando un usuario registra un permiso especial con archivo, el sistema deberá subir el documento y guardar la solicitud como `Pendiente`.

**OBS-PERM-003.** Cuando una losa está en estado distinto de `Disponible`, el backend deberá rechazar permisos normales sobre ella.

**OBS-PERM-004.** Cuando un bloque nuevo se solapa con un permiso pendiente o aceptado, el backend deberá rechazar el permiso normal.

**OBS-PERM-005.** Mientras el día actual esté bloqueado, el backend deberá rechazar nuevas solicitudes.

**OBS-PERM-006.** Mientras un grupo de alumno haya alcanzado el máximo semanal, el backend deberá rechazar nuevos permisos normales del grupo.

**OBS-PERM-007.** Cuando el administrador cambia el estado de un permiso, el sistema deberá registrar trabajador decisor, fecha de decisión, notificación y correo best-effort.

### Administración

**OBS-ADMIN-001.** Cuando se sincroniza el padrón, el sistema deberá crear localmente los códigos aún inexistentes con contraseña inicial igual al código.

**OBS-ADMIN-002.** Mientras una disciplina o losa esté inactiva/no disponible, el frontend de usuario deberá excluirla de las opciones reservables.

**OBS-ADMIN-003.** Cuando no exista la fila de configuración global, el backend deberá crear la fila `id=1` con valores por defecto.

### Seguridad y notificaciones

**OBS-SEC-001.** Mientras la sesión pertenezca al rol Seguridad, el frontend deberá permitir acceso al módulo de control y perfil.

**OBS-NOTIF-001.** Cuando se crea o cambia el estado de un permiso, el sistema deberá crear una notificación asociada.

**OBS-NOTIF-002.** Cuando el usuario marca sus notificaciones como leídas, el sistema deberá actualizar solo las notificaciones vinculadas a sus permisos.

## 9. Criterios de aceptación inferidos

### AC-001: permiso normal sin choque

**Dado** un alumno activo, una losa disponible, un día no bloqueado y un bloque libre de hoy,  
**cuando** confirma un permiso normal,  
**entonces** se crea permiso aceptado, detalle, notificación y respuesta exitosa.

### AC-002: permiso especial

**Dado** un usuario activo, una fecha no pasada y un documento válido,  
**cuando** selecciona varios bloques y envía un permiso especial,  
**entonces** se registra como pendiente y el administrador puede decidirlo.

### AC-003: choque

**Dado** un detalle pendiente o aceptado para la misma losa/fecha,  
**cuando** se intenta reservar un intervalo que se solapa,  
**entonces** el backend responde 400 con detalle de conflictos.

### AC-004: separación de roles

**Dado** un usuario autenticado,  
**cuando** intenta entrar a un layout de otro rol,  
**entonces** el frontend lo redirige a su módulo autorizado.

## 10. Hallazgos y riesgos

### Críticos

1. **La autorización del backend no está aplicada.** Existe `verifyToken/requireRole`, pero ninguna ruta de negocio los importa o monta. Cualquier cliente que alcance Express puede listar, crear, editar o borrar recursos, cambiar estados y consultar datos sin autenticarse. Los guards SSR del frontend no protegen la API.
2. **Exposición de hashes de contraseña.** `listarTrabajadores` y `obtenerTrabajador` ejecutan `SELECT *`; sus respuestas incluyen `password`. Además de ser endpoints sin autenticación, el perfil SSR puede serializar ese hash al navegador.
3. **Integridad de reservas especiales.** No se comprueban conflictos al crear un especial ni al aceptarlo. Dos especiales pueden solaparse o un especial puede ser aceptado sobre una reserva existente.
4. **Propiedad de recursos no verificada.** Endpoints como `/permisos/usuario/:id_u`, cambio de contraseña por `:id`, notificaciones y documentos confían en el ID recibido; no comparan contra `req.user`.
5. **La decisión administrativa está rota y da un éxito falso.** La vista no envía `id_t`, la action manda `0`, el servicio rechaza la mutación y el navegador muestra éxito sin comprobar el estado HTTP.

### Altos

6. **La descarga de documento usa rutas incompatibles.** Backend define `/api/permisos/:id/documento`, pero las tres pantallas llaman `/api/permisos/documento/:id`; la función de abrir PDF falla.
7. **Refresh incompleto en SSR.** `api.server.ts` acumula las nuevas `Set-Cookie`, pero `responseHeadersWithCookies` no tiene consumidores. El reintento interno puede funcionar una vez, pero las cookies rotadas no se devuelven al navegador y la siguiente renovación puede terminar la sesión.
8. **Docentes bloqueados para permisos normales.** La regla grupal devuelve `permitido:false` cuando el registro no es `Alumno`, aunque el mensaje dice que solo alumnos están sujetos a la restricción. En la práctica, docentes/personal solo pueden pasar por el flujo especial.
9. **Campos y límites confiados al cliente.** `id_u`, `id_t`, `duracion_t`, horarios y detalles no se derivan del token ni se validan con Zod. El límite semanal suma `duracion_t`, que un cliente puede manipular.
10. **Horarios de configuración no se garantizan en backend.** La apertura se usa para dibujar el frontend, pero una petición directa puede reservar fuera del rango. `hora_min_solicitud` y `hora_max_solicitud` no se aplican.

### Medios

11. **Seguridad muestra todos los aceptados.** El endpoint de detalle aceptado no filtra fecha u hora, de modo que el control de garita contiene pasados y futuros.
12. **Disponibilidad visual inconsistente.** La cuadrícula carga solo aceptados; `checkConflicts` también considera pendientes. La página de reserva rápida ni siquiera carga ocupados y deja que el backend rechace al final.
13. **Carrera de concurrencia.** La comprobación de choque ocurre antes de insertar y no hay bloqueo ni restricción de base de datos que haga atómica la exclusión; dos solicitudes simultáneas podrían superar el chequeo.
14. **Uploads sin límites ni filtro de MIME.** Multer usa memoria sin `limits` y los servicios aceptan el archivo sin validar tipo/tamaño.
15. **Recuperación de alumno no operativa.** `forgotPassword` busca el usuario por código, pero no obtiene su correo desde la API UNHEVAL; `userEmail` queda vacío y la función termina sin enviar enlace.
16. **Fechas con UTC.** El bloqueo de “hoy” usa `toISOString()`, mientras el frontend usa fecha local; en la zona America/Lima pueden discrepar cerca del cambio de día UTC.
17. **Cola de notificaciones sin consumidor.** La tabla existe, pero no hay worker/cron. Los correos se disparan directamente y se ignoran varios fallos.
18. **Sin pruebas automatizadas.** No hay archivos marcados como test ni scripts de test en backend/frontend.
19. **Modo oscuro incompleto.** Existen estilos `dark:`, pero no toggle ni persistencia detectados.
20. **Desfase de sesión.** La cookie `_session` dura 5 horas y el refresh del backend 7 días; el comentario afirma que coinciden, pero no es así.

## 11. Manejo de errores y seguridad observada

- Rate limit global: 100 solicitudes por 15 minutos/IP.
- Auth: 50 solicitudes por 15 minutos; login: 3 fallos por 15 minutos.
- Helmet y CORS con credenciales.
- Error middleware central para `AppError`, JWT, JSON mal formado y error genérico.
- Auth usa Zod y devuelve errores por campo.
- La mayoría de módulos captura errores dentro del controlador y devuelve mensajes propios.
- En desarrollo, el error global puede devolver stack.

La presencia de estas medidas no compensa la falta de montaje de autenticación/autorización en las rutas de negocio.

## 12. Recomendaciones priorizadas

1. Montar `verifyToken` y `requireRole` en todas las rutas; dejar públicas solo salud, login, refresh y recuperación.
2. Derivar `id_u/id_t` exclusivamente de `req.user`, comprobar ownership y ocultar siempre `password`.
3. Unificar una función transaccional de validación de disponibilidad para normal, especial y aceptación administrativa.
4. Corregir la ruta de documento y usar una única constante/helper.
5. Propagar `Set-Cookie` desde cada loader/action o centralizar el refresh en una abstracción que realmente alcance al navegador.
6. Crear schemas Zod para params, query, body y detalles de todos los módulos.
7. Recalcular `duracion_t` en backend y validar fecha, rango de apertura, días bloqueados y máximo semanal incluyendo la nueva solicitud.
8. Añadir límites/tipos permitidos a Multer y, si corresponde, escaneo de archivos.
9. Filtrar control de seguridad por fecha/hora vigente y mostrar identidad del solicitante.
10. Implementar recuperación de alumnos obteniendo email desde API UNHEVAL.
11. Añadir pruebas de integración para login, roles, solapamientos, límites, especiales, refresh y ownership.
12. Decidir si se implementará realmente la cola de notificaciones y el modo oscuro; si no, retirar esas promesas del README.

## 13. Incertidumbres que requieren decisión de producto

- ¿Docentes y personal administrativo deben crear permisos normales o solo especiales?
- ¿El máximo semanal corresponde al alumno individual o al grupo año+escuela?
- ¿La fecha relevante para el límite semanal es creación o fecha de uso?
- ¿Un permiso pendiente debe bloquear visualmente el horario para todos?
- ¿Seguridad debe ver únicamente hoy, un rango de tolerancia o todo permiso futuro?
- ¿El administrador puede aceptar solicitudes con choque mediante excepción explícita?
- ¿Los usuarios pueden cancelar sus propios permisos?
- ¿Qué tipos y tamaños de documento/imagen son válidos?
- ¿El sistema debe mantener una sola sesión por identidad o permitir varios dispositivos?

## 14. Evidencia principal

- Entrada backend y montaje de módulos: `backend/src/index.js`.
- Autenticación no montada: `backend/src/shared/middlewares/auth.middleware.js` y `backend/src/modules/*/*.routes.js`.
- Reglas de permiso: `backend/src/modules/permisos/permiso.service.js`.
- Sesión y refresh backend: `backend/src/modules/auth/auth.service.js`.
- Modelo relacional: `DB/sistema_losa_schema.sql`.
- Árbol del frontend: `frontend/app/routes.ts`.
- Sesión SSR: `frontend/app/services/auth.server.ts`.
- Cliente REST/refresh: `frontend/app/services/api.server.ts`.
- Cuadrícula y reserva: `frontend/app/features/horarios/_public.horario.tsx`.
- Reserva rápida: `frontend/app/features/losas/_public.losas.tsx`.
- Administración: `frontend/app/features/**/_admin.*.tsx`.
- Control de seguridad: `frontend/app/features/permisos/_seguridad.modulo.tsx`.

## 15. Verificación estática realizada

- `frontend`: `pnpm typecheck` finalizó con código 0; mostró advertencias deprecadas de `envFile`.
- `backend/src`: todos los archivos JavaScript pasaron `node --check`.
- No se detectaron pruebas automatizadas en el índice del repositorio.
