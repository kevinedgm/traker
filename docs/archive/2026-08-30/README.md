# Archivo de documentación — 30 de agosto de 2026

Esta carpeta conserva la documentación anterior al plan operativo vigente. Los
archivos son evidencia histórica: pueden describir fases como pendientes aunque
posteriormente hayan sido ejecutadas.

La fuente actual para continuar el trabajo es
[TRAKER_PENDING_EXECUTION_PLAN.md](../../../TRAKER_PENDING_EXECUTION_PLAN.md).

## Organización

### Proyecto, análisis y diseño

La carpeta [project](project/) reúne:

- dirección y estado del producto;
- investigación, visión y contratos de metas;
- sistema visual, comunicación y experiencia companion;
- modelo de datos y planes de implementación anteriores;
- validación de Fase 0 e integración Aurora.

### Evidencia de fases

La carpeta [phases](phases/) conserva los runbooks y resultados de Sync v2 y
de la limpieza de contrato de Fase 6.

### Decisiones arquitectónicas

La carpeta [adr](adr/) conserva las cinco decisiones arquitectónicas sobre
persistencia, sincronización, reformulación, integración Aurora y consentimiento.

### Especificaciones de páginas

La carpeta [pages](pages/) conserva las especificaciones de metas, hábitos,
progreso, ajustes y componentes asociados.

## Regla de uso

- No tomar un checkbox histórico como estado actual sin contrastarlo con el
  plan vigente.
- No borrar estos archivos durante la ejecución por bloques.
- Si una decisión histórica vuelve a ser vigente, enlazarla desde el plan
  actual en lugar de duplicarla.
