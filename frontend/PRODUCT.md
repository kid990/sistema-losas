# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Estudiantes y Docentes (UNHEVAL):** Usuarios finales que necesitan reservar campos y losas deportivas universitarias de forma autónoma (permisos normales) o con documentación respaldatoria (permisos especiales).
- **Personal de Seguridad:** Encargados en garitas/accesos de verificar la validez de los permisos aprobados y comprobar la identidad de los usuarios en tiempo real.
- **Administradores del Sistema:** Gestores de la infraestructura deportiva encargados de aprobar/rechazar solicitudes especiales, gestionar losas, disciplinas, usuarios, trabajadores y configurar parámetros globales del sistema.

## Product Purpose
Proporcionar una plataforma web integral, moderna y transparente para la gestión y reserva de losas deportivas en la Universidad Nacional Hermilio Valdizán (UNHEVAL), eliminando el cruce de horarios y automatizando la fiscalización de accesos.

## Positioning
Sistema web institucional centralizado con integración al padrón UNHEVAL y consulta RENIEC por DNI, que ofrece reserva instantánea para uso regular y flujo guiado para solicitudes especiales de eventos.

## Operating Context
- Uso receptivo prioritario en dispositivos móviles (estudiantes reservando desde el campus y personal de seguridad verificando permisos en puerta).
- Panel administrativo en escritorio para monitoreo de estadísticas, aprobación de reservas y gestión de losas/disciplinas.
- Sistema de reservas por bloques de hora según horario de apertura y días bloqueados (mantenimiento/feriados).

## Capabilities and Constraints
- **Tipos de Permiso:** Permisos Normales (aprobación instantánea) y Permisos Especiales (adjunto de PDF/imagen y revisión manual por administrador).
- **Gestión de Infraestructura:** Registro y control de estado de losas deportivas y disciplinas asociadas.
- **Seguridad e Identidad:** Autenticación JWT dual-token (Access Token 15m + Refresh Token 7d en cookies HttpOnly), validación de estudiantes/docentes vía API UNHEVAL y consulta DNI vía RENIEC.
- **Notificaciones:** Sistema interno de alertas sobre estados de permisos y comunicaciones.

## Brand Commitments
- Identidad gráfica oficial de la Universidad Nacional Hermilio Valdizán (colores institucionales azul/marino y acentos dorados/azules, logotipo UNHEVAL).
- Estética limpia, confiable y de alta calidad visual.

## Evidence on Hand
- Código fuente frontend en React Router 8 + Tailwind CSS 4 (`frontend/app`).
- Backend modular en Express 5 (`backend/src/modules`).
- Base de datos MySQL configurada con esquemas y seeds de prueba (`DB/`).

## Product Principles
1. **Agilidad en la Reserva:** Flujo directo para seleccionar losa, fecha y horario en pocos toques.
2. **Cero Conflictos de Horario:** Impedimento estricto y visual de reservas duplicadas o en días no laborables.
3. **Fiscalización Eficiente:** Vista optimizada para que el personal de seguridad verifique permisos al instante.

## Accessibility & Inclusion
- Diseño responsive adaptativo a pantallas móviles, tablets y escritorios.
- Alto contraste y tamaño legible pensado para uso en exteriores con luz solar.
