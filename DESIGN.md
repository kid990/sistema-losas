---
name: SISTEMA LOSA - UNHEVAL
description: Sistema integral de gestión de permisos de losas deportivas UNHEVAL
colors:
  primary: "#1B6EB6"
  primary-dark: "#165b8e"
  primary-light: "#e8f0fe"
  accent: "#EC5252"
  security: "#003366"
  sidebar: "#1e1e2d"
  bg-body: "#f0f2f5"
  bg-card: "#ffffff"
  text-primary: "#1f2937"
  text-secondary: "#6b7280"
  border: "#e5e7eb"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
    lineHeight: "1.2"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: "1.5"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  2xl: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg-card}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  card-theme:
    backgroundColor: "{colors.bg-card}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: SISTEMA LOSA UNHEVAL

## Overview

**Creative North Star: "The Campus Athletic Hub"**

El sistema visual del Sistema de Losas UNHEVAL combina la sobriedad y profesionalismo de la identidad institucional universitaria con la frescura y dinamismo del deporte universitario. Su arquitectura visual destaca por una interfaz limpia, contrastante y fácil de operar tanto en dispositivos móviles (alumnos y personal de seguridad) como en consolas de administración en escritorio.

El lenguaje estético utiliza superficies suaves con esquinas redondeadas (`16px`), glassmorphism estratégico para tarjetas de login y modales, y una paleta azul institucional respaldada por acentos rojos y verdes tácticos para estados de permisos.

**Key Characteristics:**
- Azul institucional UNHEVAL como eje principal y acentos semánticos de alto contraste.
- Glassmorphism con desenfoque de fondo (`blur(20px)`) para elementos superpuestos y logins.
- Transiciones fluidas en microinteracciones con curvas bézier suaves (`cubic-bezier(.21,.98,.35,1)`).
- Bordes limpios con sombras multinivel sutiles sin saturación.

## Colors

La paleta se estructura alrededor del azul representativo de la UNHEVAL (#1B6EB6), complementado con tonos oscuros para navegación lateral y azul marino profundo para el módulo de seguridad.

### Primary
- **UNHEVAL Blue** (#1B6EB6): Utilizado en botones principales, acentos de selección de losa, enlaces y barras de navegación.
- **Deep Blue Navy** (#165b8e): Tono de interacción hover para botones primarios.
- **Soft Ice Blue** (#e8f0fe): Fondo sutil para elementos activos o seleccionados.

### Accent
- **Coral Red** (#EC5252): Utilizado para estados de alerta, rechazo, desincorporaciones e indicadores de estado crítico.
- **Security Navy** (#003366): Fondo representativo del módulo de seguridad y control de acceso.

### Neutral
- **Body Canvas** (#f0f2f5): Fondo general neutro de la aplicación.
- **Card Surface** (#ffffff): Superficie limpia de contenido y módulos.
- **Text Primary** (#1f2937): Texto principal de alta legibilidad.
- **Text Secondary** (#6b7280): Subtítulos, descripciones e instrucciones secundarias.
- **Border Neutral** (#e5e7eb): Delimitación sutil entre contenedores.

### Named Rules
**The 10% Accent Rule.** El color rojo de acento (#EC5252) se reserva exclusivamente para acciones destructivas, errores o badges de alerta, manteniendo la calma visual del resto de la pantalla.

## Typography

**Display Font:** Inter (Inter, ui-sans-serif, system-ui, sans-serif)
**Body Font:** Inter (Inter, ui-sans-serif, system-ui, sans-serif)

**Character:** Tipografía sans-serif moderna, accesible y highly legible bajo luz solar intensa en exteriores.

### Hierarchy
- **Display** (Bold 700, 2rem/2.5rem, 1.2): Encabezados de página y títulos principales.
- **Headline** (SemiBold 600, 1.25rem/1.5rem, 1.3): Títulos de módulos y tarjetas principales.
- **Title** (Medium 500, 1rem/1.25rem, 1.4): Nombre de losas y encabezados de tablas.
- **Body** (Regular 400, 0.875rem/1.25rem, 1.5): Texto narrativo, formulación e instrucciones.
- **Label** (Medium/Bold 500/700, 0.75rem, 1.1): Badges, etiquetas de estado y subtítulos de tabla.

## Layout

La distribución se basa en un grid receptivo con contenedor de ancho máximo de `1400px` centrado. 

- **Sidebar Admin:** Fijo a la izquierda con un ancho constante de `260px` y transición de desplazamiento en móviles.
- **Navbar Superior:** Fijado (`sticky top-0`) con sombra sutil y gradientes de color según el rol (Azul Usuario, Verde-Azul Seguridad, Blanco Admin).
- **Densidad de Spacing:** Escala de 8px (8px, 16px, 24px, 32px) para ritmo vertical armónico.

## Elevation & Depth

El sistema utiliza sombras multinivel limpias y tonalidades suaves en lugar de sombras pesadas o negras.

### Shadow Vocabulary
- **Shadow Small** (`0 1px 3px rgba(0,0,0,0.05)`): Tarjetas en reposo e inputs.
- **Shadow Medium** (`0 4px 12px rgba(0,0,0,0.07)`): Tarjetas al hacer hover y menús desplegables.
- **Shadow Large** (`0 10px 30px rgba(0,0,0,0.07)`): Modales y tarjetas flotantes.
- **Glow Blue** (`0 0 20px rgba(27, 110, 182, 0.15)`): Indicador de foco activo e interacción primaria.

### Named Rules
**The Lift-On-Hover Rule.** Las tarjetas interactivas se elevan `-4px` en el eje Y y aumentan su sombra al pasar el cursor para dar retroalimentación háptica visual.

## Shapes

- **Bordes de Tarjeta y Módulos:** Redondeados pronunciados (`16px` / `var(--radius-lg)`).
- **Inputs y Botones:** Esquinas redondeadas medianas (`10px` / `var(--radius-md)`).
- **Badges:** Pill redondeada completa (`rounded-full`).

## Components

### Buttons
- **Shape:** Esquinas redondeadas de `10px`.
- **Primary:** Fondo `#1B6EB6`, texto blanco `#ffffff`, padding `12px 24px`, transición `0.2s`.
- **Hover / Focus:** Transición a `#165b8e` con escala activa `0.97`.

### Cards / Containers
- **Corner Style:** `16px` (`rounded-2xl`).
- **Background:** Blanco `#ffffff` o Glassmorphic `rgba(255, 255, 255, 0.88)`.
- **Border:** `1px solid #e5e7eb`.

### Inputs / Fields
- **Style:** Fondo `#ffffff`, borde `1px solid #e5e7eb`, esquinas `10px`.
- **Focus:** Borde `#1B6EB6` y anillo de enfoque `3px rgba(27, 110, 182, 0.10)`.

### Badges de Estado
- **Disponible / Aprobado:** Fondo verde suave `rgba(16, 185, 129, 0.1)`, texto `#059669`.
- **Pendiente / Warning:** Fondo amarillo suave `rgba(245, 158, 11, 0.1)`, texto `#d97706`.
- **Rechazado / Ocupado:** Fondo rojo suave `rgba(239, 68, 68, 0.1)`, texto `#dc2626`.

## Do's and Don'ts

### Do:
- **Do** Mantener una jerarquía clara en las tablas de horario utilizando verde para disponible y rojo para ocupado.
- **Do** Utilizar modales con backdrop de desenfoque (`backdrop-blur-md`) para confirmaciones importantes.
- **Do** Asegurar que todos los botones tengan estados de `active:scale-[0.97]` para buena respuesta táctil.

### Don't:
- **Don't** Usar sombras opacas de color negro puro sin transparencia.
- **Don't** Alterar el tono azul primario `#1B6EB6` por tonos saturados no institucionales.
- **Don't** Saturation de íconos en listas; mantener un tamaño máximo consistente de `16px-20px`.
