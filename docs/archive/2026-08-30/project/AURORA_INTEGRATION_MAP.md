# Traker Aurora — mapa de integración para Metas

## Fuente de verdad

Paquete de referencia: `/Users/datateamconsulting/Downloads/Traker Design System — Aurora`.

El paquete contiene CSS, assets y componentes React de referencia. La aplicación productiva seguirá en Vue 3.

## Mapeo de tokens

| Actual | Aurora | Estrategia |
|---|---|---|
| `--color-canvas` | `--background-base` | Alias temporal |
| `--color-surface` | `--surface-primary` | Alias temporal |
| `--color-surface-raised` | `--surface-secondary` | Alias temporal |
| `--color-text` | `--text-primary` | Alias temporal |
| `--color-text-muted` | `--text-secondary` o `--text-muted` según intención | Revisión por uso |
| `--color-brand` | `--action-primary` | Sustitución semántica |
| `--color-danger` | `--status-destructive` | Sustitución semántica |
| `--color-warning` | `--status-warning` | Sustitución semántica |
| `--shadow-*` | `--elev-*` | Migración por nivel |
| `--duration-*` | `--dur-*` | Alias temporal |
| radios actuales | `--radius-xs`…`--radius-2xl` | Migración por jerarquía |

No se mapeará el lima neón directamente a otro color en cada componente. Los usos se reclasificarán como acción, foco, regreso, adaptación, pausa o destructivo.

## Componentes de Metas

| Necesidad | Referencia Aurora | Componente Vue propuesto | MVP |
|---|---|---|---|
| Siguiente acción | `NextStepCard` | `GoalNextStepCard.vue` | Sí |
| Regreso | `ReturnCard` | `GoalReturnCard.vue` | Sí |
| Evidencia | `ProgressCard` | `GoalProgressCard.vue` | Sí |
| Esfuerzo/energía | `EffortSelector` | `EffortSelector.vue` | Sí |
| Versión mínima | `MinimalVersionSelector` | `MinimalVersionSelector.vue` | Sí |
| Estado | `StatusTag` | `BaseStatusTag.vue` | Sí |
| Adaptación móvil | `BottomSheet` | ampliar modal/sheet existente | Sí |
| Cierre irreversible | `ConfirmDialog` | `BaseConfirmDialog.vue` | Sí |
| Confirmación breve | `Toast` | `BaseToast.vue` | Sí |
| Sin conexión | `OfflineState` | `OfflineState.vue` | Sí |
| Trayectoria de etapas | `WeeklyPath`/`NonLinearProgress` sólo como lenguaje | `GoalJourney.vue` | No, experimento |

## Composición por pantalla

### Lista de metas

- Fondo `aurora-ambient`.
- Top bar y navegación según tokens Aurora.
- Una zona “En foco” y otra “Pausadas/otras”.
- No envolver cada sección en glass.
- Estado vacío mediante `EmptyState` con una sola acción.

### Detalle

- Una `GoalNextStepCard` protagonista.
- Motivo y contexto en flujo tipográfico, no otra tarjeta obligatoria.
- `GoalProgressCard` como evidencia reciente.
- En escritorio: siguiente acción, contexto y evidencia en columnas; no ensanchar la lista móvil.

### Regreso

- `GoalReturnCard` con `--aurora-return`.
- Instrument Serif sólo en “Qué bueno que volviste”.
- Opciones en Outfit: retomar, reducir, reformular, pausar o cerrar.
- Ninguna cifra de ausencia como reproche.

### Sesión

- Cifra tabular Outfit.
- Cian para foco, no glow intenso.
- Controles con targets de 44 px.
- Al finalizar, `Toast` informativo y registro de evidencia.

## Responsive

- Mobile: 4 columnas, margen 20 px, navegación inferior y bottom sheets.
- Tablet: 8 columnas, margen 32 px.
- Desktop: 12 columnas, margen 48 px, máximo 1120 px.
- Columna de lectura/formulario: máximo 640 px.
- Safe areas y `--nav-clearance` obligatorios.

## Accesibilidad

- WCAG AA mínimo en temas oscuro y claro.
- Foco cian de 2 px con offset.
- Texto y forma acompañan todo estado.
- Modales y sheets: focus trap, `Esc`, retorno de foco y título accesible.
- Cambios de sesión/guardado anunciados mediante live region.
- Sin alturas fijas para tarjetas con texto.
- Movimiento reducido elimina respiración y reduce duración a 1 ms.

## Secuencia de adopción

1. Tokens y fuentes con fallback.
2. Primitivas compartidas necesarias.
3. Componentes de Metas.
4. Pantallas de Metas.
5. Auditoría visual y accesible.
6. Migración independiente de Hábitos.

## Criterios de fidelidad

- No aparecen nuevos valores hexadecimales en componentes.
- No se carga React.
- No hay más de una tarjeta protagonista por vista.
- Los cinco acentos no compiten en una misma pantalla.
- Glass y gradientes aparecen sólo en contextos permitidos.
- Tema claro no es una inversión automática.
- La aplicación sigue siendo completamente operable sin fuentes remotas.

