# Guía para diseñar y evaluar interfaces UI/UX

> Documento elaborado únicamente a partir de los conceptos proporcionados de las PPT 2 y 3. No incorpora criterios externos.

## Propósito

Esta guía sirve para:

- diseñar una interfaz frontend separada de la lógica de la aplicación;
- organizar el sitio, las páginas y el contenido;
- mejorar la experiencia del usuario, la usabilidad y la accesibilidad;
- evaluar una interfaz mediante criterios verificables;
- registrar evidencias, incumplimientos y correcciones.

## 1. Fundamento de la interfaz

### 1.1 Independencia entre interfaz y aplicación

La interfaz debe estar separada de la lógica computacional:

```text
Usuario
   ↕
Componente de diálogo / Interfaz
   ↕
Componente de cómputos / Aplicación
```

La interfaz administra:

- representación;
- comunicación;
- interacción;
- consultas o búsquedas;
- secuencia de interacción;
- sesión y navegación.

La aplicación administra la transformación funcional o algorítmica de las entradas en salidas.

Esta separación debe favorecer:

- modularización;
- modificabilidad;
- extensión;
- estandarización;
- calidad de uso;
- usabilidad;
- accesibilidad;
- consideración de factores humanos.

### 1.2 Capas de la UI

La interfaz debe organizarse desde los elementos físicos o básicos hasta la funcionalidad de la aplicación:

```text
Dispositivos de entrada y salida
        ↓
Elementos de interacción
        ↓
Interfaz
        ↓
Aplicación
```

### 1.3 Arquitecturas aplicables

#### Modelo de Albert Green

- **Presentación:** dispositivos de entrada, ventanas y objetos de interacción.
- **Control del diálogo:** lógica, secuencia de interacción, sesión y navegación.
- **UI-aplicación:** comunicación entre la interfaz y la funcionalidad.

#### MVC

- **Modelo:** datos y funciones que trabajan con ellos.
- **Vista:** presenta o solicita datos y constituye la parte visible.
- **Controlador:** recibe acciones del usuario, procesa y coordina operaciones.

#### PAC

Organiza la interfaz mediante agentes jerárquicos con:

- presentación;
- abstracción;
- control.

#### Arquitectura de tres niveles

La interfaz debe ocupar una capa diferenciada dentro de la arquitectura general de la aplicación.

## 2. Experiencia del usuario

La UX debe considerar las emociones y percepciones del usuario antes, durante y después de la interacción. Una interfaz no debe limitarse a combinar funcionalidad y estética; también debe diseñar una experiencia de uso satisfactoria.

La interfaz debe:

- explicar su propósito;
- permitir que el usuario encuentre lo que necesita;
- ofrecer interacciones comprensibles;
- mostrar respuestas claras ante las acciones;
- reducir el esfuerzo cognitivo;
- mantener al usuario orientado.

## 3. Diseño mediante los cinco planos de Garrett

### 3.1 Estrategia

Antes de diseñar, definir:

- objetivos del sitio;
- necesidades del usuario;
- qué quiere hacer el usuario;
- qué espera encontrar.

### 3.2 Alcance

Definir:

- funcionalidades disponibles;
- características necesarias;
- responsabilidad de cada función;
- contenido que debe mostrarse.

### 3.3 Estructura

Definir:

- navegación;
- relación entre páginas;
- forma de llegar de una página a otra;
- orden de navegación;
- estructura secuencial, jerárquica, estrella, no lineal o basada en búsqueda.

### 3.4 Esqueleto

Definir la ubicación de:

- botones;
- imágenes y fotografías;
- textos;
- bloques;
- controles;
- elementos de interfaz.

La ubicación debe mejorar la eficiencia de la interacción.

### 3.5 Superficie

Definir la apariencia de:

- imágenes;
- textos;
- colores;
- tipografía;
- elementos visuales;
- presentación general.

## 4. Objetivos del diseño web

Toda interfaz debe procurar:

- **Legibilidad:** información fácil de leer y entender.
- **Expresividad:** escritura y expresión correctas.
- **Localización:** facilidad para encontrar información y funciones.
- **Navegabilidad:** desplazamiento sencillo dentro del sitio.
- **Visibilidad:** patrones visuales que hagan reconocibles las opciones.
- **Interacción:** diálogo claro entre usuario y sistema.
- **Progresividad:** posibilidad de crecer sin perder claridad.
- **Adecuación a Internet:** consideración del entorno web y sus condiciones.

## 5. Diseño a nivel de sitio

### 5.1 Estructura usable

- Colocar primero los servicios y contenidos importantes.
- Dar alternativas para llegar a la información cuando sean necesarias.
- Permitir alcanzar los objetivos en pocos pasos.
- Hacer evidente la estructura.
- Mantener el mismo estilo de interacción.

### 5.2 Navegación

La navegación debe evitar:

- pérdida de contexto;
- dependencia innecesaria entre navegador y aplicación;
- demoras evitables;
- pérdida u orientación incorrecta del usuario.

El usuario debe saber:

- dónde está;
- cómo regresar;
- qué estaba haciendo.

Para conservar el contexto pueden utilizarse:

- nombre de la página;
- logotipo;
- banners;
- iconos;
- elementos visuales consistentes;
- breadcrumb.

### 5.3 Tipos de navegación

- **Cross-referencing:** enlaces a contenidos relacionados.
- **Structural navigation:** acceso a páginas padre o hermanas.
- **Cross-navigation:** movimiento hacia adelante y atrás.
- **Interactive navigation:** ayuda según las intenciones del usuario.
- **Contextual navigation:** conservación de ubicación y contexto.
- **Custom navigation:** adaptación de la navegación al usuario.

### 5.4 Guías de navegación

- Usar los tipos de navegación que requiera la tarea.
- Mostrar feedback navegacional.
- Ubicar estratégicamente los controles.
- Ofrecer accesos directos a funciones importantes.
- Buscar eficiencia y recorridos cortos.
- Considerar la regla de los tres clics.
- Utilizar carga asincrónica cuando corresponda.
- Mostrar el recorrido cuando ayude al usuario.
- Considerar historial y recomendaciones cuando formen parte del sistema.

### 5.5 Hipervínculos

Cada enlace debe:

- anticipar a dónde conduce;
- tener texto significativo y no ambiguo;
- poseer una longitud adecuada;
- ubicarse sin interrumpir innecesariamente el contenido;
- ser visualmente identificable;
- diferenciar destinos internos y externos;
- usar un nombre coherente con el contenido de destino;
- apuntar a un destino existente.

## 6. Diseño a nivel de página

### 6.1 Clasificación del contenido

- **Primario:** título, subtítulos, objetivos y descripción.
- **Secundario:** servicios e información detallada.
- **Contextual:** sugerencias y elementos relacionados.
- **Adicional:** ayuda, salida, impresión o contacto.

### 6.2 Sectorización

La página debe distinguir claramente las zonas de:

- títulos;
- funciones;
- contenido;
- asistencia;
- navegación;
- mensajes.

### 6.3 Homogeneidad

#### Homogeneidad visual

Mantener consistencia en:

- tipografía;
- colores;
- logotipo;
- fondos;
- formatos.

#### Homogeneidad conceptual

Mantener la misma terminología y definición de conceptos en toda la interfaz.

### 6.4 Jerarquía visual

- Usar el color para mostrar importancia, relaciones, atención o categorías.
- Usar contraste suficiente para distinguir información y controles.
- Usar tamaños mayores para elementos de mayor importancia.
- Ubicar elementos según su importancia y secuencia.
- Facilitar la lectura de izquierda a derecha y de arriba hacia abajo.
- Agrupar elementos relacionados por secuencia, frecuencia, función, importancia o tamaño.
- Combinar estética con una utilización mínima de recursos.

### 6.5 Texto, tipografía e iconos

- Elegir una tipografía adecuada al contenido.
- Utilizar tipografía sans serif para la visualización estándar.
- Mantener alineación izquierda cuando corresponda a la lectura normal.
- Escribir párrafos breves.
- Mantener una idea principal por párrafo.
- Acompañar los iconos con texto alternativo o representación textual.
- Utilizar metáforas y conceptos familiares para reducir el esfuerzo cognitivo.

### 6.6 Página inicial

La página inicial debe:

- explicar qué ofrece el sitio;
- ser clara y sintética;
- mostrar sus objetivos;
- presentar los temas principales;
- organizar las funciones;
- destacar las áreas prioritarias;
- ofrecer ayudas cuando sean necesarias;
- permitir regresar fácilmente a ella.

## 7. Diseño a nivel de contenido

El contenido debe ser:

- **Llamativo:** destacar lo importante.
- **Coherente:** relacionarse con el objetivo de la página.
- **Progresivo:** agregar detalle a medida que se avanza.
- **Entendible:** poder comprenderse sin depender de otra página.
- **Fragmentado:** distribuirse en frases, párrafos y sectores breves.

El lenguaje debe ser:

- acorde al objetivo;
- adecuado al perfil del usuario;
- relacionado con la información mostrada;
- ortográfica y gramaticalmente correcto;
- libre de expresiones confusas o innecesariamente complejas;
- libre de abreviaciones y truncamientos que dificulten la comprensión.

## 8. Interacción y objetos de interfaz

### 8.1 Formas de interacción

La interfaz puede recibir entradas mediante:

- teclado;
- mouse;
- touch;
- voz;
- gestos;
- movimiento;
- escritura;
- otras entradas admitidas por el dispositivo.

Puede entregar salidas mediante:

- texto;
- recursos visuales;
- audio o voz;
- multimedia;
- vibración;
- animación;
- Braille;
- combinaciones de sonido, luz y vibración.

Cuando se combinen varios modos, la interacción es multimodal.

### 8.2 Interfaz gráfica e icónica

La interfaz gráfica puede utilizar:

- barras de iconos;
- cuadros de diálogo;
- formularios;
- grillas;
- carruseles;
- galerías;
- widgets;
- ventanas;
- pestañas;
- animaciones limitadas.

Los recursos icónicos o metafóricos deben:

- representar acciones reconocibles;
- utilizar metáforas familiares;
- favorecer el reconocimiento;
- trasladar el modelo mental del usuario al sistema;
- reducir el esfuerzo cognitivo.

### 8.3 Formularios

Los formularios deben:

- permitir un orden de llenado flexible;
- admitir navegación mediante `Tab`;
- distinguir campos obligatorios, opcionales e importantes;
- validar los datos asociados a cada campo;
- mostrar mensajes, ayudas, ejemplos y valores permitidos;
- permitir suspender, reanudar, guardar o imprimir cuando la tarea lo requiera.

### 8.4 Mensajes de error

Los errores deben ser:

- claros;
- no ambiguos;
- acompañados por alternativas de solución.

### 8.5 Controles

#### Radio buttons

- No presentar más de cinco opciones.

#### Checkboxes

- Incluir una etiqueta.
- Proporcionar un espacio claramente seleccionable.

#### Campos de entrada

- Tener tamaño adecuado.
- Mostrar claramente su contenido.
- Diferenciar el estado de edición.
- Evitar truncar información.

#### Combo box

- Diferenciar estado editable y no editable.
- Incluir una opción por defecto cuando corresponda.
- Mantener un orden comprensible de opciones.

#### Menús

- No superar diez opciones.
- No superar tres niveles de jerarquía.
- Identificar la selección actual.
- Diferenciar opciones habilitadas y deshabilitadas.
- Mostrar los elementos seleccionados.

#### Pestañas

- Mostrar claramente cuál está activa.
- Mantener un orden lógico.

#### Listados y tablas

- Indicar si sus elementos son seleccionables o editables.
- Incorporar ordenamiento, filtrado o selección cuando la tarea lo requiera.

#### Áreas de texto

- Distinguir entre estado editable y solo lectura.

## 9. Adaptabilidad y accesibilidad

La interfaz debe poder adaptar, según las necesidades del sistema:

- contenido;
- presentación;
- opciones de accesibilidad.

También debe considerar:

- diferentes monitores;
- navegadores;
- tipos y velocidades de conexión;
- tamaños de página;
- volumen de información;
- imágenes y multimedia;
- internacionalización;
- salida mediante monitor o Braille;
- interacción visual, auditiva, táctil o gestual.

## 10. Prueba de cumplimiento UI/UX

### 10.1 Forma de uso

Evaluar cada criterio con uno de estos resultados:

- **Cumple:** existe evidencia verificable de cumplimiento.
- **No cumple:** el criterio es aplicable, pero la interfaz no lo satisface.
- **No aplica:** el criterio no corresponde al alcance evaluado.

Para cada resultado debe registrarse una evidencia, como una ruta, pantalla, componente, interacción o mensaje visible.

La interfaz cumple esta guía cuando todos los criterios aplicables están marcados como **Cumple**. Todo resultado **No cumple** debe generar una corrección y una nueva evaluación.

### 10.2 Datos de la evaluación

| Campo | Valor |
|---|---|
| Proyecto | |
| Página o flujo | |
| Evaluador | |
| Fecha | |
| Dispositivo | |
| Navegador | |

### 10.3 Lista de comprobación

| ID | Criterio | Resultado | Evidencia u observación | Corrección necesaria |
|---|---|---|---|---|
| ARQ-01 | La interfaz está separada de la lógica computacional. | | | |
| ARQ-02 | La presentación, el diálogo y la comunicación con la aplicación tienen responsabilidades distinguibles. | | | |
| UX-01 | La página responde a una necesidad concreta del usuario. | | | |
| UX-02 | El objetivo principal puede identificarse con facilidad. | | | |
| UX-03 | La interacción produce una percepción clara y satisfactoria. | | | |
| GAR-01 | Están definidos los objetivos del sitio y las necesidades del usuario. | | | |
| GAR-02 | Las funciones y contenidos corresponden al alcance definido. | | | |
| GAR-03 | La relación y el recorrido entre páginas son comprensibles. | | | |
| GAR-04 | La ubicación de botones, imágenes, textos y bloques facilita la tarea. | | | |
| GAR-05 | La apariencia visual es coherente con el propósito de la página. | | | |
| SIT-01 | Los servicios y contenidos importantes aparecen primero. | | | |
| SIT-02 | El usuario puede completar su objetivo en pocos pasos. | | | |
| SIT-03 | La estructura del sitio es visible y consistente. | | | |
| NAV-01 | El usuario sabe dónde está. | | | |
| NAV-02 | El usuario sabe cómo regresar. | | | |
| NAV-03 | La navegación conserva el contexto de la tarea. | | | |
| NAV-04 | Los controles de navegación están ubicados estratégicamente. | | | |
| NAV-05 | Existe feedback al cambiar de página o sección. | | | |
| LNK-01 | Cada enlace indica claramente a dónde conduce. | | | |
| LNK-02 | Los enlaces son visualmente identificables. | | | |
| LNK-03 | Se distinguen enlaces internos y externos. | | | |
| LNK-04 | El texto del enlace coincide con su destino. | | | |
| LNK-05 | Todos los enlaces conducen a destinos existentes. | | | |
| PAG-01 | El contenido primario se distingue del secundario, contextual y adicional. | | | |
| PAG-02 | Las zonas de títulos, funciones, contenido, ayuda, navegación y mensajes son distinguibles. | | | |
| PAG-03 | Tipografía, colores, logotipo, fondos y formatos son homogéneos. | | | |
| PAG-04 | La terminología mantiene el mismo significado en toda la interfaz. | | | |
| VIS-01 | El tamaño y la ubicación reflejan la importancia de los elementos. | | | |
| VIS-02 | Los colores muestran importancia, relaciones o categorías de manera consistente. | | | |
| VIS-03 | Existe contraste suficiente para distinguir textos y controles. | | | |
| VIS-04 | Los elementos relacionados están agrupados. | | | |
| VIS-05 | El diseño combina estética con uso mínimo de recursos. | | | |
| TXT-01 | Cada párrafo comunica una idea principal. | | | |
| TXT-02 | Los párrafos son breves y entendibles. | | | |
| TXT-03 | El lenguaje corresponde al objetivo y al perfil del usuario. | | | |
| TXT-04 | No existen errores ortográficos, ambigüedades, truncamientos o expresiones confusas. | | | |
| ICO-01 | Cada icono tiene texto alternativo o representación textual. | | | |
| ICO-02 | Los iconos y metáforas representan conceptos familiares. | | | |
| INI-01 | La página inicial explica qué ofrece el sitio. | | | |
| INI-02 | La página inicial es clara y sintética. | | | |
| INI-03 | La página inicial destaca objetivos, temas y funciones prioritarias. | | | |
| INI-04 | Es posible regresar fácilmente a la página inicial. | | | |
| FRM-01 | El formulario permite recorrer los campos mediante `Tab`. | | | |
| FRM-02 | Se distinguen campos obligatorios, opcionales e importantes. | | | |
| FRM-03 | Cada campo valida los datos que recibe. | | | |
| FRM-04 | Los campos muestran ayudas, ejemplos o valores permitidos cuando son necesarios. | | | |
| ERR-01 | Los mensajes de error son claros y no ambiguos. | | | |
| ERR-02 | Los mensajes de error indican una alternativa de solución. | | | |
| CTL-01 | Los radio buttons presentan como máximo cinco opciones. | | | |
| CTL-02 | Cada checkbox tiene etiqueta y un área claramente seleccionable. | | | |
| CTL-03 | Los campos no truncan información y muestran su estado de edición. | | | |
| CTL-04 | Los combo box diferencian sus estados y mantienen opciones ordenadas. | | | |
| CTL-05 | Los menús no superan diez opciones ni tres niveles. | | | |
| CTL-06 | Los menús identifican opciones activas, habilitadas y seleccionadas. | | | |
| CTL-07 | Las pestañas muestran claramente cuál está activa y conservan un orden lógico. | | | |
| CTL-08 | Las tablas y listas indican si permiten selección o edición. | | | |
| CTL-09 | Las áreas de texto distinguen edición y solo lectura. | | | |
| ACC-01 | La interfaz puede utilizarse mediante teclado cuando corresponde. | | | |
| ACC-02 | La presentación y el contenido consideran opciones de accesibilidad. | | | |
| ACC-03 | La interfaz conserva claridad en diferentes monitores y navegadores. | | | |
| ACC-04 | El contenido considera diferentes conexiones y velocidades de carga. | | | |
| ACC-05 | Imágenes, multimedia y animaciones se utilizan de forma limitada y coherente. | | | |
| CON-01 | El contenido importante está destacado. | | | |
| CON-02 | El contenido es coherente con el objetivo de la página. | | | |
| CON-03 | El detalle se presenta de manera progresiva. | | | |
| CON-04 | Cada sección puede entenderse sin depender innecesariamente de otra página. | | | |
| CON-05 | La información está fragmentada en frases, párrafos y sectores comprensibles. | | | |

## 11. Casos de prueba manuales

### PR-01 — Comprensión inicial

**Objetivo:** comprobar que la página inicial comunica su propósito.

1. Abrir la página inicial.
2. Identificar qué ofrece el sitio.
3. Identificar la función principal.
4. Localizar el acceso a dicha función.

**Resultado esperado:** el propósito, los temas principales y la acción prioritaria se comprenden sin depender de otra página.

### PR-02 — Orientación y navegación

**Objetivo:** comprobar que el usuario conserva el contexto.

1. Entrar en una sección secundaria.
2. Identificar la página actual.
3. Navegar a una página relacionada.
4. Regresar a la página anterior o inicial.

**Resultado esperado:** el usuario sabe dónde está, cómo continuar y cómo regresar.

### PR-03 — Enlaces

**Objetivo:** comprobar claridad y correctitud de los enlaces.

1. Revisar el texto de cada enlace.
2. Distinguir enlaces internos y externos.
3. Activar cada enlace.
4. Comparar el destino con el texto mostrado.

**Resultado esperado:** todos los enlaces son reconocibles, significativos y conducen al destino anunciado.

### PR-04 — Navegación por teclado

**Objetivo:** comprobar el uso mediante teclado.

1. Recargar la página.
2. Navegar únicamente mediante `Tab`.
3. Activar enlaces, botones, pestañas y campos mediante teclado.
4. Verificar el orden del foco.

**Resultado esperado:** todos los controles necesarios son alcanzables y utilizables en un orden lógico.

### PR-05 — Formularios y validación

**Objetivo:** comprobar claridad de campos, validaciones y mensajes.

1. Identificar campos obligatorios y opcionales.
2. Enviar datos vacíos o no permitidos.
3. Revisar los mensajes obtenidos.
4. Corregir los datos siguiendo las indicaciones.

**Resultado esperado:** los campos están diferenciados, las validaciones corresponden a cada dato y los errores explican cómo corregir el problema.

### PR-06 — Controles de selección

**Objetivo:** comprobar menús, pestañas, listas y tablas.

1. Abrir cada menú o combo box.
2. Cambiar entre pestañas.
3. Interactuar con listas o tablas seleccionables y editables.
4. Revisar estados activos, habilitados y seleccionados.

**Resultado esperado:** cada control comunica su estado, mantiene un orden lógico y no presenta más opciones o niveles de los recomendados.

### PR-07 — Consistencia visual y conceptual

**Objetivo:** comprobar la homogeneidad entre páginas.

1. Comparar tipografía, colores, logotipo, fondos y formatos.
2. Comparar nombres de acciones y conceptos repetidos.
3. Revisar la jerarquía de títulos, contenido y controles.

**Resultado esperado:** las páginas mantienen el mismo lenguaje visual y conceptual.

### PR-08 — Adaptación al entorno web

**Objetivo:** comprobar el comportamiento en diferentes condiciones.

1. Abrir la interfaz en diferentes tamaños de monitor.
2. Probarla en los navegadores considerados por el proyecto.
3. Revisar páginas con mayor volumen de información.
4. Revisar la carga de imágenes, multimedia y animaciones.

**Resultado esperado:** la interfaz conserva legibilidad, navegación, estructura y acceso a las funciones.

## 12. Resultado final

| Resultado | Cantidad |
|---|---:|
| Cumple | |
| No cumple | |
| No aplica | |

### Veredicto

- [ ] La interfaz cumple todos los criterios aplicables.
- [ ] La interfaz no cumple y requiere correcciones.

### Correcciones prioritarias

| Prioridad | ID del criterio | Problema | Acción correctiva | Responsable |
|---|---|---|---|---|
| | | | | |
