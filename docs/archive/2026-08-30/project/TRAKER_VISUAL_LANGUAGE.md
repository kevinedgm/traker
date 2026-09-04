# Traker — Lenguaje visual

## Dirección: Aurora 2, madurada

**[Evidencia del proyecto · Positivo]** Aurora 2 ya tiene suficiente carácter para ser el mundo visual oficial. No se recomienda rediseñar la identidad desde cero.

La evolución debe sentirse como una interfaz editorial nocturna con luz útil: profunda, humana, calmada y ocasionalmente juguetona. La luz señala estado o dirección; no convierte cada tarjeta en vidrio brillante.

## Tokens que se conservan

- Fondo profundo cercano a `#0D1220`.
- Superficies azul-negro con contraste medido.
- Verde para avance/energía, coral para presencia humana/retorno, violeta para foco/horizonte; nunca como único canal.
- Outfit para interfaz e Instrument Serif para momentos de narrativa.
- Bordes finos, radios moderados y sombras de profundidad contenida.
- Temas claro/oscuro con tokens semánticos.

**[Recomendación técnica · Medio]** Consolidar `aurora.css`, `DESIGN.md` y Tailwind. La paleta cyber/neon heredada no debe coexistir como segundo sistema.

## Composición

La metáfora estructural es una **trayectoria desplegable**:

- En compacto, hoy muestra el siguiente pliegue/decisión.
- En amplio, se ve la relación entre foco, agenda y tres horizontes.
- Los estados usados/cerrados permanecen como evidencia tenue; no desaparecen mágicamente.
- El color se concentra en bordes/nodos de trayectoria, mientras el campo de lectura permanece sobrio.

Esto es una regla de jerarquía, no una decoración literal de origami.

## Personaje/acompañante

**[Evidencia del proyecto · Medio]** La mascota bitmap actual es amable, pero pequeña, infantil y de una sola expresión.

Recomendación:

1. Conservarla como legado temporal en Ayuda y estados vacíos.
2. No mantenerla flotando de forma persistente sobre tareas.
3. Diseñar un sistema vectorial o WebP de 6 estados antes del piloto visual: apertura, foco, parcial, suficiente, regreso y error neutral.
4. Mantener silueta reconocible y reducir rasgos infantiles; actitud cómplice, no terapeuta ni mascota que exige atención.
5. Nunca hablar en nombre de un profesional ni interpretar emociones.

**[Decisión que requiere validación · Alto]** Elegir entre evolucionar el personaje actual o sustituirlo por un motivo abstracto de “luz/guía”. No producir decenas de activos antes de esa aprobación.

## Logo

**[Recomendación técnica · Alto]** Usar el activo Traker y corregir nombres/títulos accesibles. Retirar la referencia visible/interna a Koto durante la migración, manteniendo los archivos antiguos solo si alguna ruta los requiere temporalmente.

## Iconos

- Lucide como sistema funcional único.
- Tamaños base 18/20/24 px; trazo consistente.
- Iconos decorativos `aria-hidden`.
- Iconos sin texto solo cuando el significado sea universal y haya nombre accesible.
- No usar emoji/Unicode como icono de hábito en notificaciones si el sistema principal exige Lucide; el push puede usar icono de app y texto.
- Estados: forma + icono + texto, nunca solo color.

## Ilustraciones

Familias propuestas:

- **Apertura:** horizonte/luz emergente, composición aireada.
- **Regreso:** camino que reaparece, no “personaje triste”.
- **Foco:** haz acotado sobre una acción.
- **Suficiente:** círculo/camino cerrado con espacio, no trofeo.
- **Offline:** continuidad local, no nube rota dramática.
- **Error:** interrupción reparable, no alarma roja.
- **Hábitos piloto:** escenas de conducta, no pictogramas genéricos.

Formato:

- SVG para geometría/tokens y animación mínima.
- WebP/AVIF para escenas raster; dimensiones explícitas.
- Variantes claras/oscuras solo si contraste lo exige.
- Presupuesto inicial: seis estados globales + un hábito piloto.
- Carga diferida fuera del primer viewport; apertura crítica menor de ~80 KiB cuando sea raster.

## Estados visuales

| Estado | Forma | Color secundario | Texto obligatorio |
|---|---|---|---|
| Pendiente | contorno abierto | neutro | “Pendiente” o próxima ventana |
| En foco | borde/nodo marcado | violeta/verde | “En foco” |
| Sí | marca completa | verde | “Hecho” |
| A medias | semicírculo/segmento | ámbar/coral | “A medias” |
| No | raya/punto cerrado | neutro/coral tenue | “No realizado” |
| Omitido | pausa/guion | gris | “Omitido hoy” |
| Pausado | doble barra | neutro | “Pausado” |
| Sincronizando | indicador estático + opcional giro | azul | “Guardado aquí” |
| Error | rombo/signo | rojo moderado | problema y recuperación |

## Movimiento: presupuesto y propósito

El movimiento debe responder una pregunta: ¿qué cambió, de dónde vino o adónde fue? Si no, se elimina.

### Candidatos aprobables

| Evento | Frecuencia | Propiedades | Curva/duración | Interrupción/reduced motion |
|---|---|---|---|---|
| Registro cambia de estado | ocasional | `transform`, `opacity`, color token | 180–220 ms, ease-out | reversible; cambio instantáneo + texto |
| Sheet/modal entra/sale | ocasional | `transform`, `opacity` | 240 ms entrada / 180 ms salida | apertura/cierre sin transición |
| Tarjeta de regreso aparece | rara | `opacity`, translateY 6 px | 220 ms | aparece completa |
| Recompensa desbloqueada | rara | escala 0.98→1 + opacity | 220/140 ms | mensaje estático |
| Cambio de foco/horizonte | ocasional | crossfade + 4 px | 200–220 ms | sustituye contenido sin movimiento |

### Candidatos rechazados

| Candidato | Razón |
|---|---|
| Mascota flotando/brillando indefinidamente | alta frecuencia, roba atención y batería |
| Camino semanal dibujándose en cada montaje | el dato debe leerse inmediatamente |
| Rueda con cuatro vueltas/confeti | mecánica de casino y latencia artificial |
| Respiración continua de CTA | urgencia permanente, distractora |
| Stagger de todas las filas al abrir | penaliza una pantalla diaria |
| Transición de ruta global | ralentiza navegación recurrente |
| Animar `height` | layout thrash; usar grid/transform o instantáneo |

**[Evidencia del proyecto · Alto]** Los candidatos rechazados están presentes parcial o totalmente hoy; esta es una dirección de retiro, no una implementación realizada.

### Interrupción

- Una nueva acción lleva el componente directamente al nuevo estado; no encola animaciones.
- Deshacer invierte desde el valor visual actual.
- No bloquear input durante celebraciones.
- Máximo una animación focal simultánea en Hoy.

### Reduced motion

- Eliminar desplazamiento, rotación, parallax y autoanimación.
- Mantener cambios de color/forma instantáneos y mensajes de estado.
- No reducir todo a 0.01 ms indiscriminadamente si eso rompe eventos o foco.
- Cualquier contenido rotatorio tiene pausa y alternativa estática.

## Componentes reutilizables propuestos

- `TodayOpening`
- `FocusGoalCard`
- `EssentialAgenda`
- `AgendaItem`
- `FlexibleGroupPicker`
- `QuickLogControl`
- `NearbyReward`
- `HorizonJourney`
- `ReturnCard`
- `DayCloseSheet`
- `OptionalCheckIn`
- `SyncStatus`
- `SensitiveContextNotice`
- `ContextIllustration`

No crear tarjetas dentro de tarjetas. Cada componente debe definir estados vacío, carga local, error, offline y disabled.

## Tipografía y densidad

- Cuerpo base 16 px; interfaz secundaria 13–14 px.
- Evitar 9–11 px existentes.
- Titulares editoriales pueden usar serif, pero controles y números operativos permanecen en sans.
- Longitud móvil: frases de apertura ≤ 2 líneas a 375 px.
- Números tabulares para tiempo/series cuando ayuden comparación.
- Texto al 200 % mantiene acciones y no solapa navegación.

## Rendimiento

- Animar solo `transform`/`opacity` salvo excepción medida.
- Lazy-load de páginas e ilustraciones no críticas.
- Un solo activo visual crítico en Hoy.
- Evitar filtros/backdrop costosos en listas largas y dispositivos modestos.
- No cachear recursos de usuario autenticados en runtime Cache Storage.
- Medir LCP/INP/CLS en PWA instalada y navegador, con throttling móvil.
- Presupuesto MVP sugerido: shell crítico < 250 KiB gzip adicional al framework actual; ningún activo visual individual > 150 KiB sin justificación.

## Accesibilidad visual

- AA para texto e iconografía funcional.
- Contraste verificado en ambos temas y estados disabled.
- El verde/coral nunca son el único canal.
- Ilustración decorativa oculta a lector.
- Contenido informativo de ilustración también aparece como texto.
- Focus ring no se recorta por `overflow`/backdrop.
- Touch targets 44×44 px y separación suficiente.

## Validaciones antes de producir activos

1. Aprobar evolución o reemplazo de mascota.
2. Aprobar composición de trayectoria.
3. Probar una pantalla Hoy en 375, 768 y 1280 con personas usuarias.
4. Validar contraste y legibilidad en claro/oscuro.
5. Elegir un único hábito visual piloto.
6. Solo después producir los seis estados globales.

