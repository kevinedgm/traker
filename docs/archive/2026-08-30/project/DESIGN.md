---
name: "Traker — Aurora 2"
description: "Una interfaz serena para avanzar, adaptar y regresar sin castigo."
colors:
  charcoal-blue: "#0D1220"
  charcoal-raised: "#131A2B"
  surface-primary: "#182135"
  surface-secondary: "#212B45"
  mist-primary: "#F0F1F7"
  mist-secondary: "#A8B0C6"
  mist-muted: "#8C95AD"
  electric-blue: "#6C8CFF"
  electric-blue-hover: "#93AAFF"
  electric-blue-pressed: "#4E6FE8"
  aurora-violet: "#A66CFF"
  focus-cyan: "#56D6F0"
  return-coral: "#F58C6E"
  pause-amber: "#E8B96A"
  destructive-rose: "#E5707F"
  paper-blue: "#F5F5FA"
  paper-raised: "#FCFCFF"
  light-text: "#131728"
  light-action: "#3557D8"
typography:
  display:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.006em"
  body:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.01em"
  editorial:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.28
    letterSpacing: "-0.01em"
  numeric:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  cell: "6px"
  tag: "8px"
  control: "12px"
  card: "16px"
  featured: "20px"
  modal: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "20px"
  xl: "24px"
  section: "32px"
  section-wide: "48px"
  max: "64px"
components:
  button-primary:
    backgroundColor: "{colors.electric-blue}"
    textColor: "{colors.charcoal-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.mist-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "48px"
  input:
    backgroundColor: "{colors.charcoal-raised}"
    textColor: "{colors.mist-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.surface-primary}"
    textColor: "{colors.mist-primary}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-featured:
    backgroundColor: "{colors.surface-primary}"
    textColor: "{colors.mist-primary}"
    rounded: "{rounded.featured}"
    padding: "24px"
---

# Design System: Traker — Aurora 2

## Overview

**Creative North Star: "La trayectoria que vuelve a unirse"**

Aurora 2 convierte la filosofía «Regresar también es avanzar» en una interfaz serena, humana y atmosférica. El sistema no representa el progreso como una cadena que puede romperse: lo muestra como un trazo orgánico que puede separarse, adaptarse y volver a conectarse. La aplicación se siente contemporánea y premium, pero cercana; optimista, nunca infantil.

La experiencia está diseñada para operar con poca carga cognitiva. Cada vista presenta una acción primaria, revela información progresivamente y conserva el contexto de pausas, versiones mínimas y retornos. Aurora 2 sustituye por completo el cyber-minimal neón: evita la estética de rendimiento, alarma y racha sin cambiar las funciones ni la nomenclatura de Traker.

**Key Characteristics:**

- Base azul carbón con iluminación ambiental fría y un único contrapunto cálido para regresar.
- Trayectorias orgánicas y estados con forma propia, nunca comunicados sólo por color.
- Una acción primaria por pantalla y divulgación progresiva de contenido.
- Outfit para operar; Instrument Serif sólo cuando la interfaz habla emocionalmente.
- Profundidad contenida, glass reservado y ausencia de glow decorativo.
- Dos temas diseñados por separado: oscuro principal y claro de papel azulado.

## Colors

La paleta combina una base azul profunda con acentos de función inequívoca; no es una colección decorativa y nunca deben aparecer todos los acentos en la misma vista.

### Primary

- **Azul eléctrico:** acción primaria, avance y estado completado. En claro se utiliza su variante oscurecida para mantener contraste.
- **Azul carbón:** fondo principal oscuro. Nunca sustituir por negro puro.

### Secondary

- **Cian de foco:** información, enfoque y anillo de foco.
- **Violeta de adaptación:** reflexión, bienestar y acciones adaptadas.

### Tertiary

- **Coral de regreso:** energía y retorno. Se combina con ámbar únicamente en la superficie de regreso.
- **Ámbar de pausa:** pausas, recordatorios y estados offline que no implican pérdida.
- **Rosa destructivo:** reservado para borrar datos; jamás representa un día sin completar.

### Neutral

- **Niebla primaria:** texto principal en oscuro.
- **Niebla secundaria:** texto de apoyo y contenido secundario.
- **Niebla muted:** metadatos y estados discretos; conserva contraste AA.
- **Papel azulado:** fondo del tema claro. El claro no invierte el tema oscuro: conserva profundidad suave y acentos más oscuros.

### Named Rules

**The Functional Accent Rule.** Cada acento conserva una función; una vista utiliza sólo los que necesita.

**The Neutral Absence Rule.** «Sin registro» y «Omitido» son neutrales. Nunca usan rojo, una X ni lenguaje de error.

**The Screen Light Rule.** La iluminación ambiental y el grano se aplican una vez a la pantalla, no a cada tarjeta.

## Typography

**Display Font:** Outfit, con fallback sans-serif del sistema.  
**Body Font:** Outfit, con fallback sans-serif del sistema.  
**Editorial Font:** Instrument Serif, con Georgia como fallback.

**Character:** Outfit aporta claridad geométrica y una presencia contemporánea sin sentirse clínica. Instrument Serif introduce humanidad únicamente en bienvenida, onboarding, regreso y estados vacíos significativos; nunca aparece en navegación, formularios o controles.

### Hierarchy

- **Display** (600, 44 px, 1.04): momentos de apertura y mensajes principales.
- **Headline** (600, 32 px, 1.12): títulos principales de pantalla.
- **H2** (600, 24 px, 1.2): secciones importantes.
- **H3** (600, 20 px, 1.3): títulos de tarjeta y diálogo.
- **Title** (600, 17 px, 1.35): filas, elementos de lista y títulos compactos.
- **Body** (400, 16 px, 1.55): contenido funcional; máximo recomendado de 65 caracteres por línea.
- **Body small** (400, 14 px, 1.5): explicación secundaria.
- **Label** (600, 13 px, 1.2): etiquetas y controles.
- **Caption** (600, 12 px, tracking 0.06 em): categorías breves en mayúsculas.
- **Numeric** (500, 40 px, 1): cifras importantes con números tabulares.
- **Editorial** (400, 28 px, 1.28): voz emocional en superficies excepcionales.

### Named Rules

**The Emotional Serif Rule.** Instrument Serif habla; nunca opera. Si el texto activa, configura o navega, usa Outfit.

**The Hierarchy Rule.** La jerarquía se construye con tamaño y peso, nunca sólo con color.

## Layout

Aurora 2 es mobile-first. Usa una escala de 4 px, márgenes de pantalla de 20 px en móvil, 32 px en tablet y 48 px en escritorio. Las secciones se separan por 32 px en móvil y 48 px en escritorio. La columna de lectura alcanza 640 px y un dashboard completo llega hasta 1120 px.

La cuadrícula crece de 4 columnas con gutter de 16 px a 8 columnas con 20 px y 12 columnas con 24 px. Las áreas seguras se respetan en la parte superior e inferior; el contenido móvil reserva espacio para la navegación flotante.

Inicio muestra como máximo tres Hábitos y ofrece «Ver más» para el resto. En escritorio no se estira la lista móvil: siguiente paso, lista y trayectoria se reorganizan en dos o tres columnas. Los formularios y flujos de una decisión mantienen una columna estrecha.

## Elevation & Depth

La profundidad combina capas tonales y sombras ambientales. El sistema tiene cinco niveles: fondo, superficie integrada, superficie elevada, flotante y modal. Las sombras oscuras son frías y profundas; las claras son cálidas y suaves.

### Shadow Vocabulary

- **Nivel 0:** sin sombra; fondo de pantalla.
- **Nivel 1:** línea interior mínima para superficies integradas.
- **Nivel 2:** doble sombra corta y difusa para tarjetas elevadas.
- **Nivel 3:** sombra flotante para navegación, toast y menús.
- **Nivel 4:** sombra modal para sheets y diálogos.

El glass usa blur de 18 px y saturación de 140 %, siempre con fondo opaco de respaldo. Sólo se permite en navegación flotante, toast, menú contextual y controles superpuestos. El velo azul-cian-violeta pertenece a un único momento destacado; el velo coral-ámbar pertenece exclusivamente al regreso.

### Named Rules

**The Reserved Glass Rule.** Si una superficie no flota ni es temporal, no usa glass.

**The No Glow Rule.** El mark y la luz ambiental pueden resplandecer; los componentes no.

**The Space Before Card Rule.** Antes de crear una tarjeta, resolver con espacio, tipografía o divisor.

## Shapes

Los radios aumentan con la escala y relevancia de la superficie: 6 px para celdas, 8 px para tags, 12 px para inputs y controles, 16 px para tarjetas, 20 px para protagonistas y 28 px para sheets y modales. Pill se reserva para chips, botones de acción, avatares y controles de icono.

Los bordes son hairline de 1 px; el borde de énfasis es 1.5 px. El borde de acento aparece sólo en selección o foco protagonista. Los iconos de Hábito son la única iconografía del sistema que vive dentro de un contenedor coloreado.

La trayectoria semanal es el gesto distintivo: segmentos Bézier de grosor constante que se separan y vuelven a conectarse. Los tramos sin registro permanecen punteados; no se representan como una rotura.

## Components

### Buttons

- **Shape:** pill para acciones; 40, 48 y 56 px de altura según densidad.
- **Primary:** azul eléctrico con texto carbón; sólo uno por pantalla.
- **Secondary:** superficie secundaria y borde sutil; alternativa visible sin competir.
- **Ghost:** transparente para acciones terciarias.
- **Danger:** transparente o tinte rosa; sólo para pérdida de datos.
- **Hover / Focus:** hover refuerza fondo o borde; pressed escala a 0.985; foco usa anillo cian de 2 px con offset de 2 px.
- **Loading / Disabled:** el loading mantiene la etiqueta contextual; disabled usa 0.45 de opacidad y no responde.

### Chips and Status Tags

- Los chips sirven para filtros y selección múltiple; el seleccionado combina tinte, borde, texto y estado accesible.
- Los diez Status Tags usan etiqueta y forma: relleno, media celda, anillo, barra, punteado o contorno. Nunca dependen sólo del color.
- Badge comunica metadatos; nunca sustituye un estado de progreso.

### Cards / Containers

- La tarjeta estándar usa superficie primaria, radio de 16 px, padding de 20 px y borde sutil.
- La tarjeta protagonista usa radio de 20 px, padding de 24 px, borde de acento y velo Aurora.
- Las filas de Hábitos prefieren divisor y fondo integrado; la variante con tarjeta se reserva para agrupaciones aisladas.
- No se anidan superficies del mismo nivel.

### Inputs / Fields

- Etiqueta persistente, pista opcional y error junto al campo.
- Fondo integrado, radio de 12 px y borde sutil.
- El foco combina borde de acento y anillo cian global.
- El error sustituye la pista, marca el campo y explica cómo recuperarse.
- Switch sólo se usa cuando el cambio es inmediato; si requiere guardar o confirmar, se usa botón.

### Navigation

- La navegación inferior es glass flotante, respeta safe area y mantiene objetivos táctiles de 44 px.
- Tabs usa subrayado azul de 2 px, nunca cápsulas.
- Top bar no lleva sombra fija; usa glass sólo cuando hay contenido desplazándose debajo.
- Menú contextual funciona en escritorio; más de cuatro acciones en móvil pasan a Bottom Sheet.

### Habit and Goal Patterns

- **Habit Card:** icono, nombre, contexto del día y registro rápido. Inicio muestra tres antes de revelar más.
- **Quick Log:** un toque registra; si está pausado cambia a una invitación de retorno.
- **Next Step:** única acción protagonista de Inicio; puede respirar lentamente mientras espera interacción.
- **Goal Focus:** muestra una Meta, un paso y una sola acción primaria; no convierte Inicio en otra lista.
- **Return Card:** única superficie cálida y editorial; dice que no es necesario recuperar días anteriores.
- **Progress:** Weekly Path, Non-Linear Progress y Flexible Calendar describen continuidad sin rachas.

### Reward Patterns

- **Reward Vault:** reúne únicamente recompensas ya desbloqueadas. Comunica que permanecen disponibles sin vencimiento y ofrece «Usar» como elección, nunca como tarea pendiente.
- **Reward Rules:** se presentan como acuerdos opcionales creados por la persona. Admiten hábito diario, frecuencia semanal o meta completada; pausar, editar y borrar no cambia el progreso de la fuente.
- **Reward Wheel:** es una elección secundaria y explícita dentro de la bóveda. Sólo aparece cuando existen recompensas disponibles, elige únicamente entre ellas y conserva una salida clara para guardarlas. Respeta movimiento reducido mostrando el resultado sin giro.
- El reconocimiento permanece sereno: sin confeti, trofeos, presión para cobrar ni lenguaje que convierta una recompensa guardada en deuda.

### Feedback and Overlays

- Skeleton reproduce la silueta del contenido conocido; Loading Screen usa el trazo Aurora sólo para carga inicial.
- Toast confirma sin exagerar y ofrece «Deshacer» cuando aplica; dura entre 4 y 6 segundos.
- Una recompensa recién desbloqueada usa un aviso global no modal con acceso a Recompensas y cierre explícito; no interrumpe la tarea actual ni abre la rueda automáticamente.
- Offline usa ámbar, permite seguir registrando y explica qué queda pendiente.
- Error usa rosa destructivo, afirma qué se conserva y ofrece una recuperación.
- Pausar, adaptar y posponer no requieren confirmación. Confirm Dialog se reserva para borrar datos y ofrece primero la alternativa de pausar.
- En móvil se prefiere Bottom Sheet; Modal se usa en tablet y escritorio. Ambos controlan el foco y cierran con Escape.

## Do's and Don'ts

### Do:

- **Do** mostrar una sola acción primaria por pantalla.
- **Do** describir el estado y ofrecer una acción: «En pausa desde el lunes» + «Retomar».
- **Do** considerar mínima, habitual y flexible como versiones válidas del progreso.
- **Do** utilizar el trazo orgánico como alternativa a la racha y a la barra lineal.
- **Do** conservar iconos Lucide con trazo de 1.75 px, `currentColor` y áreas táctiles de 44 px.
- **Do** respetar ambos temas y comprobar WCAG AA en cada superficie.
- **Do** reducir movimiento a 1 ms cuando la persona lo solicita.

### Don't:

- **Don't** usar cyber-neón, negro puro, glow intenso o lima como acción principal.
- **Don't** usar rachas, llamas, trofeos, medallas, confeti, rebotes ni celebración exagerada.
- **Don't** comunicar estado sólo con color ni usar rojo para «Sin registro».
- **Don't** envolver cada sección o icono en una tarjeta redondeada.
- **Don't** usar todos los acentos en la misma vista ni inventar degradados fuera de los tres definidos.
- **Don't** usar Instrument Serif en controles, navegación o contenido funcional.
- **Don't** usar emojis o caracteres Unicode como iconos del sistema.
- **Don't** pedir confirmación para pausar, adaptar, retomar o posponer.
- **Don't** escribir «Fallaste», «Perdiste tu racha», «Llevas retraso» o «Recupera el tiempo perdido».
