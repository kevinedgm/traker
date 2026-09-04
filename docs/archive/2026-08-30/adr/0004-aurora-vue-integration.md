# ADR-0004: integración de Traker Aurora en Vue

- Estado: Aceptada
- Fecha: 2026-08-25

## Contexto

El sistema Traker Aurora contiene tokens CSS, assets y componentes de referencia en React. La aplicación productiva usa Vue 3 y componentes propios. Añadir React duplicaría runtime, patrones y mantenimiento.

## Decisión

Aurora será la fuente visual oficial. Se adaptarán sus tokens y contratos a Vue sin incluir React ni reutilizar JSX en producción.

Orden de integración:

1. Versionar assets Aurora autorizados dentro de `src/assets` o `public` según su uso.
2. Incorporar tokens primitivos y semánticos mediante archivos CSS dedicados.
3. Crear aliases temporales para consumidores cyber-neón existentes.
4. Adaptar componentes requeridos por Metas.
5. Migrar Hábitos en una iniciativa visual separada.

Primeros componentes:

- `GoalNextStepCard` ← `NextStepCard`
- `GoalReturnCard` ← `ReturnCard`
- `GoalProgressCard` ← `ProgressCard`
- `EffortSelector`
- `MinimalVersionSelector`
- `StatusTag`
- `BottomSheet`, `ConfirmDialog`, `Toast`, `OfflineState`

## Reglas no negociables

- Outfit para interfaz y cifras.
- Instrument Serif sólo en bienvenida, regreso o cierre reflexivo.
- El ambiente Aurora vive en la pantalla, no en cada tarjeta.
- Glass sólo en navegación o superficies temporales.
- Los estados usan texto y forma además de color.
- Foco cian de 2 px; target táctil mínimo de 44 px.
- `prefers-reduced-motion` reduce transiciones a 1 ms.
- No confeti, rebotes, rachas, glow por componente ni gradientes arbitrarios.

## Progreso de Metas

`WeeklyPath` y `NonLinearProgress` representan tiempo en Hábitos y no se copiarán literalmente. El MVP utilizará estado, evidencia y `ProgressCard`. Una trayectoria de etapas para Metas será un experimento posterior con semántica y alternativa textual propias.

## Consecuencias

- Durante la transición podrán coexistir Aurora y vistas heredadas.
- Los tests visuales deben cubrir tema oscuro, claro y movimiento reducido.
- La carga de fuentes debe funcionar con la PWA; se evaluará autoalojarlas para no depender de red.

