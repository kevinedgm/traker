# Decisiones de arquitectura de Traker Metas

Estado de la serie: propuesta aceptada para planificación. Ninguna decisión de esta carpeta implica que el módulo ya esté implementado.

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-goals-local-persistence.md) | IndexedDB detrás de un repositorio | Aceptada |
| [0002](0002-goals-sync-protocol.md) | Outbox idempotente, versiones y conflictos explícitos | Aceptada |
| [0003](0003-linked-goal-reformulation.md) | Cierre inmutable y reformulación vinculada | Aceptada |
| [0004](0004-aurora-vue-integration.md) | Adaptar Traker Aurora a Vue sin añadir React | Aceptada |
| [0005](0005-consent-and-product-analytics.md) | Consentimiento separado y minimización analítica | Aceptada |

## Convenciones

- Una ADR aceptada puede sustituirse mediante otra ADR, no editarse para ocultar una decisión histórica.
- Las decisiones irreversibles requieren feature flag, migración aditiva o rollback documentado.
- El código de Hábitos no se modifica como efecto secundario de implementar Metas.

