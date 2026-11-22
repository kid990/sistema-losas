# Sistema visual SIRLOD — UNHEVAL

<!-- impeccable:design-schema 1 -->

## Dirección

**Nombre:** Agenda Deportiva Institucional  
**Modo:** Operate  
**Autoridad visual:** adaptación del lenguaje de `reserva-losas-unheval` a los flujos y contratos existentes de SIRLOD.

La interfaz se comporta como una agenda operativa universitaria: primero hace visible el estado de las losas, los permisos y la acción siguiente. La identidad institucional vive en el escudo, el azul UNHEVAL, la tipografía condensada de títulos y una cuadrícula clara; no en gradientes decorativos ni en tarjetas de adorno.

## Contrato de dirección

- **THESIS:** la disponibilidad y el estado son el centro de la experiencia; se evita el dashboard genérico de mosaicos brillantes.
- **OWN-WORLD:** lienzo azul hielo, superficies blancas o azul tinta, líneas visibles, placas de cancha, títulos condensados y estados semánticos sólidos.
- **STORY:** cada rol reconoce su área, entiende qué requiere atención y llega a su tarea principal sin aprender otra interfaz.
- **FIRST VIEWPORT:** marca y rol en la navegación; contexto y acción principal en un encabezado azul; contenido operativo inmediatamente después.
- **FORM:** aplicación institucional responsive, densa donde hay datos y amplia donde se toman decisiones.

## Paleta

| Token | Claro | Oscuro | Uso |
|---|---:|---:|---|
| canvas | `#EEF4FB` | `#0C1626` | Fondo general |
| surface | `#FFFFFF` | `#14233A` | Paneles y formularios |
| ink | `#0F1F33` | `#E6EEFA` | Texto principal |
| muted | `#44566B` | `#A9B9CF` | Texto secundario |
| line | `#C3D2E6` | `#2A3D5A` | Divisores y bordes |
| primary | `#1757B8` | `#1D5FC0` | Acción e identidad |
| primary-strong | `#0F3D8C` | `#123F86` | Navegación y énfasis |
| focus | `#A87400` | `#F2C230` | Foco de teclado |

Estados: verde para disponible/aprobado, ámbar para revisión, rojo para ocupado/rechazado y gris azulado para cerrado o inactivo. El color nunca será el único indicador.

## Tipografía

- **Display:** `Barlow Condensed`, para títulos, cifras y placas de losa.
- **UI y lectura:** `Public Sans`, para navegación, formularios, tablas y textos.
- Los títulos usan jerarquía fuerte y medida corta; el cuerpo mantiene entre 65 y 75 caracteres cuando es narrativo.

## Forma y profundidad

- Radios de 8 px en controles y 12–16 px en superficies.
- Una superficie usa borde o sombra dominante, no ambos con la misma intensidad.
- Sombras con desplazamiento y desenfoque suave; no halos de color.
- Botones y controles táctiles con mínimo de 44 px.
- El foco visible usa el token `focus` y nunca se elimina.

## Layout por rol

- **Usuario:** portal de reservas con Inicio, Losas, Horarios, Permisos y Notificaciones.
- **Administrador:** navegación agrupada; contenido más ancho para tablas y revisión.
- **Seguridad:** búsqueda y permisos vigentes como acción central, con contraste apto para exteriores.
- **Público/Auth:** marca institucional clara, lectura lineal y acceso visible.

En escritorio la navegación lateral permanece fija. En móvil se convierte en panel accesible con overlay, bloqueo de scroll y cierre mediante Escape. El contenido no supera 1360 px y usa gutters de 16–32 px.

## Componentes

- `ThemeToggle`: tema del sistema con preferencia persistida localmente.
- Marca: escudo circular, rol como etiqueta y nombre del área en display.
- Hero operativo: contexto, título, explicación breve y una acción; las cifras viven dentro del mismo campo visual.
- Tarjetas de datos: solo para información que necesita comparación o acción.
- Tablas: encabezado sobrio, filas de 44 px o más, acciones con nombre accesible y alternativa móvil.
- Formularios: etiquetas persistentes, ayuda próxima al campo y error con recuperación explícita.
- Estados vacíos: explican la situación y ofrecen la siguiente acción válida.

## Movimiento

Una transición breve acompaña la apertura de navegación y el cambio de estado. Se respeta `prefers-reduced-motion`; no se escalonan entradas ni se anima cada tarjeta.

## Límites

- No modificar rutas, loaders, actions, autenticación, servicios HTTP ni contratos de backend por motivos visuales.
- No introducir métricas o capacidades que el backend no entregue.
- No usar texto con gradiente, glassmorphism decorativo, bordes laterales gruesos ni gradientes como sustituto de jerarquía.

