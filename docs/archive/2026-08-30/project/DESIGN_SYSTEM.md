# Traker Mini Design System

## Direccion visual

Traker ahora sigue una estetica cyber-minimal premium: fondo negro profundo, superficies graphite, bordes translucidos y acento verde neon. La referencia principal combina app nativa movil, GitHub Contributions, Linear y una lectura futurista limpia.

Principio rector: oscuro, compacto, tactil y premium. La UI debe sentirse como una app personal de alto foco, no como dashboard corporativo.

## Paleta

Base:
- Background: `#07090D`
- Background soft: `#0B0D10`
- Surface: `#111418`
- Surface 2: `#171A20`
- Border: `rgba(255,255,255,0.07)`
- Text: `#FFFFFF`
- Text soft: `rgba(255,255,255,0.66)`
- Text muted: `rgba(255,255,255,0.38)`

Accentos:
- Primary neon: `#C6FF00`
- Primary soft: `rgba(198,255,0,0.14)`
- Primary border: `rgba(198,255,0,0.65)`
- Primary glow: `rgba(198,255,0,0.28)`
- Info cyan: `#62D5FF`
- Danger: `#FF4757`

Contributions:
- 0: `var(--color-contribution-0)`
- 1: `var(--color-contribution-1)`
- 2: `var(--color-contribution-2)`
- 3: `var(--color-contribution-3)`
- 4: `var(--color-contribution-4)`

## Tipografia

Tokens:
- `--font-sans`: Inter / SF Pro Text / Segoe UI / system
- `--font-display`: Inter / SF Pro Display / system
- `--font-mono`: SFMono / JetBrains Mono

Escala:
- `--text-xs`: 12px
- `--text-sm`: 14px
- `--text-md`: 16px
- `--text-lg`: 18px
- `--text-xl`: 20px
- `--text-2xl`: 24px
- `--text-3xl`: 32px
- `--text-4xl`: 44px

Uso:
- Titulos de pagina: sans semibold, tracking `0`, line-height cerrado.
- Momentos editoriales o vacios emocionales: `ds-display`.
- Labels: uppercase pequeno con tracking positivo, nunca usado para parrafos.

## Spacing

Sistema de 4px:
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px
- `--space-16`: 64px

Guideline: pantallas principales usan 20px en mobile, 32px en tablet y max-width centrado en desktop. Componentes densos pueden bajar a 12-16px.

## Radios

- XS `6px`: contribution cells, chips pequenos.
- SM `8px`: controles compactos.
- MD `10px`: inputs pequenos.
- LG `12px`: botones e inputs.
- XL `16px`: cards.
- 2XL `20px`: cards protagonistas.
- 3XL `28px`: sheets y modales inferiores.
- Full: avatares, pills, icon buttons.

## Sombras

- `--shadow-hairline`: borde optico premium.
- `--shadow-soft`: elevacion sutil para cards activas.
- `--shadow-float`: sheets, popovers y FAB.
- `--shadow-glow`: momentos destacados con brand.

No usar sombras claras. La elevacion debe sentirse como vidrio oscuro, con glow neon solo en activos o acciones principales.

## Estados interactivos

Estados base:
- Hover: subir `-1px`, reforzar borde o surface.
- Active: `scale(0.985)` en botones/cards, `scale(0.94)` en icon buttons.
- Focus visible: outline brand de 2px con offset 3px.
- Disabled: opacidad `0.44`, sin eventos.
- Selected: surface clara sobre contenedor raised, shadow hairline.

Los estados se definen en `.btn`, `.card-interactive`, `.input`, `.segmented-item`, `.btn-icon`.

## Movimiento

Tokens:
- Fast: `120ms`
- Base: `180ms`
- Slow: `320ms`
- Standard: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- Emphasis: `cubic-bezier(0.32, 0.72, 0, 1)`

Uso:
- Page transitions: 150-220ms, translate maximo 6px.
- Sheets: 320-380ms con emphasis.
- Barras de progreso: 600-700ms.
- No animar grandes layouts sin necesidad.

## Tokens de CSS

Los tokens viven en `src/assets/main.css` dentro de `:root` y `.dark`. Usar primero variables semanticas:
- `--color-bg`
- `--color-surface`
- `--color-surface-raised`
- `--color-border`
- `--color-text`
- `--color-text-muted`
- `--color-brand`
- `--radius-*`
- `--shadow-*`
- `--duration-*`
- `--ease-*`

Evitar hardcodear `gray-*` o `slate-*` en nuevos componentes.

## Componentes base

Disponibles en `src/components/ui`:
- `BaseButton`: variantes `primary`, `secondary`, `ghost`, `danger`; tamanos `sm`, `md`, `lg`.
- `BaseCard`: variantes por props `interactive`, `elevated`, `padding`.
- `BaseInput`: label, hint y `v-model`.
- `BaseBadge`: tonos `brand`, `neutral`, `danger`, `warning`.
- `BaseSegmentedControl`: tabs/selector compacto con `v-model`.

Clases globales utiles:
- `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- `.btn-icon`
- `.card`, `.card-elevated`, `.card-interactive`
- `.input`
- `.badge`, `.badge-neutral`
- `.sheet`
- `.segmented`, `.segmented-item`
- `.contribution-cell`
- `.surface-glass`
- `.neon-pill`
- `.motion-soft`

## Guidelines visuales

- Mantener fondo negro profundo con degradados sutiles; nunca estirar contenido al ancho completo en desktop.
- Usar verde neon como accion/seleccion/progreso; no llenar toda la UI de neon.
- La grilla de contribuciones es un objeto visual central: compacta, silenciosa, tactil.
- Los iconos deben ser lineales, 1.75px-2px, con botones circulares cuando sean acciones sueltas.
- Evitar cards dentro de cards.
- Evitar layouts de tabla o corporativos.
- Usar texto breve, compacto y humano. La interfaz debe acompañar, no explicar demasiado.
- En mobile, priorizar tactilidad: minimo 40px de alto en controles.
- En tablet usar 2 columnas cuando mejore lectura; en desktop usar max-width `5xl` a `7xl`.
