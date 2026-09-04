# Evaluación UI/UX de la página principal

## Alcance

| Campo | Valor |
|---|---|
| Proyecto | Sistema de Losas Deportivas UNHEVAL |
| Página evaluada | Página principal pública `/` |
| Implementación | `app/features/losas/_public._index.tsx` |
| Guía aplicada | `GUIA_UI_UX.md` |
| Tipo de evaluación | Revisión estática de código, compilación y detector visual |

## Veredicto

**Cumple en la revisión técnica.** Los incumplimientos detectados fueron corregidos. Quedan pendientes las comprobaciones que requieren usuarios, dispositivos físicos o condiciones reales de conexión.

| Resultado | Cantidad |
|---|---:|
| Cumple | 50 |
| No cumple | 0 |
| Requiere prueba manual | 3 |
| No aplica | 14 |
| Total | 67 |

La evaluación técnica está aprobada. La evaluación completa se cierra al ejecutar las tres pruebas manuales pendientes.

## Correcciones realizadas

### 1. VIS-03 — Contraste del texto legal del footer

- **Resultado:** Cumple.
- **Corrección:** se reemplazó `text-slate-500` por `text-blue-100` sobre el fondo institucional `#003366`.
- **Efecto:** el texto legal ahora es claramente visible y mantiene la paleta del footer.

### 2. VIS-01 — Altura de la franja institucional

- **Resultado:** Cumple.
- **Corrección:** se eliminó la combinación contradictoria `h-8 py-8` y se usa `min-h-10 py-2`.
- **Efecto:** la altura del header es estable y predecible.

### Ajustes responsive adicionales

- Header compacto de `64px` en móvil y `80px` desde `sm`.
- Tipografía reducida en pantallas menores de `400px`.
- Prevención de desbordamiento horizontal en la página.
- Elementos interactivos principales con altura táctil mínima de `44px`.
- Pestañas con desplazamiento horizontal y ajuste por puntos en móvil.
- Panel de normativa sin altura mínima forzada en móvil.
- Enlaces del footer con áreas táctiles ampliadas.
- Navegación de pestañas mediante flechas horizontales y verticales.
- Enlace de salto al contenido principal para navegación por teclado.
- Animación principal desactivada cuando el usuario solicita movimiento reducido.

## Pruebas manuales pendientes

### UX-03 — Percepción clara y satisfactoria

Debe comprobarse con usuarios o mediante observación directa del flujo. La estructura y el contenido son claros en código, pero la percepción del usuario no puede determinarse únicamente mediante revisión estática.

### ACC-03 — Comportamiento en monitores y navegadores

La revisión estática y una captura compacta en Edge fueron correctas. Todavía debe abrirse la página en dispositivos iPhone y Android reales para comprobar:

- ausencia de desbordamiento horizontal;
- legibilidad de títulos y párrafos;
- funcionamiento del header sticky;
- distribución de las tres etapas;
- desplazamiento de las pestañas en pantallas pequeñas;
- estabilidad del footer.

### ACC-04 — Comportamiento bajo diferentes conexiones

Debe probarse la carga con una conexión limitada para revisar:

- tiempo de aparición de la imagen principal;
- disponibilidad del contenido textual durante la carga;
- carga de la tipografía externa;
- continuidad de la navegación aunque un recurso visual tarde en responder.

## Criterios que cumplen

### Arquitectura y propósito

| ID | Resultado | Evidencia |
|---|---|---|
| ARQ-01 | Cumple | La autenticación se resuelve en el `loader`; el componente mantiene únicamente estado de interfaz. |
| ARQ-02 | Cumple | Presentación, navegación, interacción de pestañas y acceso al servicio están diferenciados. |
| UX-01 | Cumple | La página responde a la necesidad de conocer y acceder al sistema de reservas. |
| UX-02 | Cumple | El título principal y el botón “Iniciar sesión” hacen visible el objetivo. |
| GAR-01 | Cumple | Se identifican el servicio institucional y las necesidades de reserva. |
| GAR-02 | Cumple | El contenido explica funciones reales del sistema. |
| GAR-03 | Cumple | La página enlaza sus secciones y el acceso al login. |
| GAR-04 | Cumple | Títulos, imagen, proceso y condiciones siguen un orden de lectura claro. |
| GAR-05 | Cumple | La superficie utiliza la identidad visual institucional. |

### Estructura y navegación

| ID | Resultado | Evidencia |
|---|---|---|
| SIT-01 | Cumple | La reserva y el acceso al sistema aparecen en el primer bloque. |
| SIT-02 | Cumple | El acceso al login requiere una sola acción. |
| SIT-03 | Cumple | `header`, `main`, secciones y `footer` forman una estructura reconocible. |
| NAV-01 | Cumple | El encabezado y el `h1` identifican el sistema y la página. |
| NAV-02 | Cumple | El logotipo enlaza a `/` y el footer incluye “Inicio”. |
| NAV-03 | Cumple | Los enlaces internos apuntan a secciones identificadas. |
| NAV-04 | Cumple | El login se mantiene visible en el header sticky. |
| NAV-05 | Cumple | Los enlaces internos llevan directamente al contenido correspondiente. |
| LNK-01 | Cumple | Los textos describen el destino de cada enlace. |
| LNK-02 | Cumple | Los enlaces tienen estilos de interacción y foco. |
| LNK-03 | Cumple | El portal externo utiliza el símbolo o icono de enlace externo. |
| LNK-04 | Cumple | Los nombres coinciden con las secciones o rutas de destino. |
| LNK-05 | Cumple | Las rutas internas y los identificadores de sección existen. |

### Página, contenido y lenguaje

| ID | Resultado | Evidencia |
|---|---|---|
| PAG-01 | Cumple | El propósito principal se diferencia del proceso, servicios y condiciones. |
| PAG-02 | Cumple | Las zonas de contenido, navegación y acceso están sectorizadas. |
| PAG-03 | Cumple | Se mantiene la misma tipografía, paleta, logotipo y formato general. |
| PAG-04 | Cumple | Se usan consistentemente los términos permiso, reserva, losa e ingreso. |
| VIS-02 | Cumple | Azul institucional, verde de confirmación y fondos neutros conservan funciones consistentes. |
| VIS-04 | Cumple | Proceso, servicios y condiciones están agrupados por función. |
| VIS-05 | Cumple | La página evita controles innecesarios y mantiene una acción principal. |
| TXT-01 | Cumple | Los párrafos desarrollan una idea principal. |
| TXT-02 | Cumple | Los textos son breves y comprensibles. |
| TXT-03 | Cumple | El lenguaje corresponde a estudiantes, docentes y personal institucional. |
| TXT-04 | Cumple | No se observaron abreviaciones ambiguas ni textos truncados en el código. |
| CON-01 | Cumple | El acceso, proceso y requisitos reciben la mayor jerarquía. |
| CON-02 | Cumple | El contenido se relaciona con permisos y uso de losas. |
| CON-03 | Cumple | La información avanza desde propósito hasta proceso, servicios y condiciones. |
| CON-04 | Cumple | Cada sección contiene contexto suficiente para comprenderse. |
| CON-05 | Cumple | La información está dividida en títulos, párrafos, listas y sectores. |

### Iconografía y página inicial

| ID | Resultado | Evidencia |
|---|---|---|
| ICO-01 | Cumple | Los iconos decorativos usan `aria-hidden`; las acciones conservan texto visible. |
| ICO-02 | Cumple | Se utilizan iconos familiares para usuario, calendario, identificación y seguridad. |
| INI-01 | Cumple | El hero explica que el sitio permite consultar horarios y solicitar permisos. |
| INI-02 | Cumple | El mensaje principal es directo y está acompañado por una acción clara. |
| INI-03 | Cumple | Se destacan reserva, disponibilidad, permiso digital y condiciones de uso. |
| INI-04 | Cumple | El logotipo y el enlace del footer permiten regresar a `/`. |

### Interacción y accesibilidad

| ID | Resultado | Evidencia |
|---|---|---|
| CTL-07 | Cumple | Las pestañas muestran el estado activo y admiten flechas, `Home` y `End`. |
| ACC-01 | Cumple | Enlaces y pestañas son elementos nativos utilizables mediante teclado. |
| ACC-02 | Cumple | Hay etiquetas ARIA, estados de pestañas, foco visible y texto alternativo. |
| ACC-05 | Cumple | La página usa una sola animación breve y una imagen principal con dimensiones declaradas. |

## Criterios no aplicables

La página principal no contiene formularios, mensajes de validación, radio buttons, checkboxes, combo boxes, áreas de texto, tablas editables ni menús desplegables. Por ello se marcan como **No aplica**:

`FRM-01`, `FRM-02`, `FRM-03`, `FRM-04`, `ERR-01`, `ERR-02`, `CTL-01`, `CTL-02`, `CTL-03`, `CTL-04`, `CTL-05`, `CTL-06`, `CTL-08` y `CTL-09`.

## Verificaciones técnicas ejecutadas

| Verificación | Resultado |
|---|---|
| `pnpm typecheck` | Correcto |
| `pnpm build` | Correcto |
| Detector visual de Impeccable | Sin hallazgos automáticos |
| Ruta única a `/login` en la página | Correcto |
| Captura compacta en Edge headless | Correcto |

El proceso muestra advertencias por la opción obsoleta `envFile`, pero no afectan esta evaluación ni impiden la compilación.

## Correcciones prioritarias

| Prioridad | ID | Acción |
|---|---|---|
| Pendiente | UX-03 | Validar comprensión y percepción con una prueba manual. |
| Pendiente | ACC-03 | Confirmar el resultado en teléfonos iPhone y Android reales. |
| Pendiente | ACC-04 | Probar carga con conexión limitada. |
