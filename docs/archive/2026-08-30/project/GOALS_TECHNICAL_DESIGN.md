# Traker Metas — diseño técnico

## Objetivo

Añadir Metas sin duplicar Hábitos ni reemplazar Vue, Pinia, Supabase o la arquitectura PWA. La interfaz adopta Traker Aurora como sistema visual oficial y mantiene uso anónimo/offline y sincronización opcional desde el MVP.

## Arquitectura propuesta

```text
src/
  components/goals/
  pages/goals/
  stores/goals.js
  services/goals.repository.js
  services/local/goals.storage.js
  services/supabase/goals.service.js
```

El store contiene estado reactivo y selectores. El repositorio ejecuta operaciones, persistencia y sincronización. Las vistas no llaman directamente a Supabase ni a `localStorage`.

## Integración de Traker Aurora

El paquete Aurora está implementado como referencia React/HTML, mientras Traker productivo usa Vue. No se añadirá React al bundle. La integración seguirá este orden:

1. Copiar y versionar los assets autorizados (`logo.svg` y `logo-mono.svg`).
2. Adaptar los tokens de `tokens/*.css` al punto de entrada CSS de Vue.
3. Mantener tokens semánticos como API; los componentes no consumirán colores primitivos.
4. Crear componentes Vue equivalentes sólo cuando sean necesarios.
5. Migrar usos existentes gradualmente con aliases de compatibilidad.

Componentes Vue iniciales para Metas:

- `GoalNextStepCard`, basado en `NextStepCard`.
- `GoalReturnCard`, basado en `ReturnCard`.
- `GoalProgressCard`, basado en `ProgressCard`.
- `EffortSelector` y `MinimalVersionSelector`.
- `StatusTag`, `BottomSheet`, `ConfirmDialog`, `OfflineState` y `Toast` compartidos.

Contratos visuales:

- Outfit es la fuente funcional; Instrument Serif sólo se permite mediante una variante editorial explícita.
- `aurora-ambient` se aplica al shell/pantalla, no por componente.
- `aurora-glass` se restringe a navegación y paneles temporales.
- Foco de 2 px cian con offset de 2 px.
- Movimiento usa tokens y cae a 1 ms con `prefers-reduced-motion`.
- Los diez estados se exponen mediante texto, forma y color.

`NonLinearProgress` no se copiará literalmente para metas: sus segmentos representan días. El MVP reutilizará su gramática de estados y `ProgressCard`; una trayectoria de etapas necesitará un componente semántico propio después de validación.

## Entidades

### `goals`

| Campo | Tipo | Regla |
|---|---|---|
| `id` | uuid | PK, generado en cliente |
| `user_id` | uuid | Requerido en nube, nulo localmente sin cuenta |
| `title` | varchar(120) | 1–120 caracteres |
| `personal_why` | text | Opcional y sensible |
| `desired_outcome` | text | Opcional |
| `done_definition` | text | Requerido al activar; puede faltar en borrador |
| `status` | enum | `draft`, `active`, `paused`, `completed`, `reformulated`, `abandoned`, `archived` |
| `focus_rank` | smallint | Nulo si está fuera de foco |
| `current_action_id` | uuid | Acción no eliminada de la misma meta |
| `reformulated_from_goal_id` | uuid | FK opcional a la meta original |
| `created_at`, `updated_at` | timestamptz | UTC |
| `closed_at`, `archived_at`, `deleted_at` | timestamptz | Opcionales |
| `version` | integer | Control optimista |

Índices: `(user_id,status,focus_rank,updated_at desc)`, `reformulated_from_goal_id` y parcial sobre registros no eliminados.

### `goal_stages`

`id`, `goal_id`, `title`, `done_definition`, `position_key`, `status`, timestamps, `deleted_at`, `version`.

Las etapas son opcionales. `position_key` debe evitar renumerar toda la lista durante cambios offline.

### `goal_actions`

`id`, `goal_id`, `stage_id nullable`, `title`, `minimum_version`, `energy_level nullable`, `estimate_bucket nullable`, `status`, `position_key`, `blocked_reason nullable`, timestamps, `deleted_at`, `version`.

Rangos de estimación: `lt_5`, `5_15`, `15_30`, `30_60`, `gt_60`. Energía: `low`, `medium`, `high`; ambos opcionales.

### `work_sessions`

`id`, `goal_id`, `action_id nullable`, `started_at`, `ended_at nullable`, `planned_minutes nullable`, `actual_seconds nullable`, `outcome`, `device_id`, timestamps, `version`.

Persistir `started_at` inmediatamente permite reconstruir una sesión tras cierre o recarga. El temporizador visual no es la fuente de verdad.

### `progress_entries`

`id`, `goal_id`, `action_id nullable`, `kind`, `note`, `evidence_text`, `occurred_at`, `client_id`, timestamps.

Tipos iniciales: `started`, `partial`, `blocked`, `action_completed`, `stage_completed`, `adjusted`, `help_requested`.

### `goal_events`

Registro append-only para pausa, regreso, feedback mostrado y cierre:

`id`, `goal_id`, `type`, `payload jsonb`, `occurred_at`, `client_id`, `actor`.

Esto evita crear tablas separadas para recompensas, pausas, regresos y cierres antes de que sus consultas justifiquen entidades propias.

## Reglas de integridad

- Stage y action deben pertenecer a la misma meta.
- `current_action_id` apunta a una acción vigente de esa meta.
- Una meta cerrada no recibe acciones nuevas.
- Una meta cerrada no se reabre: reformular crea otra meta y asigna `reformulated_from_goal_id`.
- `completed`, `reformulated` y `abandoned` requieren `closed_at` y evento de cierre.
- Las eliminaciones son lógicas primero; la purga física ocurre después de un periodo definido.
- El límite de metas en foco es una preferencia, no una restricción SQL.
- Todas las tablas remotas aplican RLS por propietario.

## Estado Pinia

Estado normalizado sugerido:

```js
{
  goalsById: {},
  stagesById: {},
  actionsById: {},
  sessionsById: {},
  progressById: {},
  orderedGoalIds: [],
  sync: { status, pendingCount, conflicts: [] }
}
```

Las transiciones de estado se implementarán como funciones puras comprobables. El store no compondrá SQL ni resolverá directamente conflictos.

## Offline y almacenamiento

### MVP

- UUID generados en cliente.
- Escritura local inmediata.
- Outbox durable con `operation_id` único.
- Reintentos idempotentes.
- Estado de sincronización visible pero discreto.
- Cuenta opcional; el uso anónimo nunca queda bloqueado por Supabase.

### Decisión de almacenamiento

IndexedDB es el destino recomendado para Metas por volumen, transacciones y múltiples colecciones. Para reducir riesgo, se introduce detrás de `goals.repository.js`; Hábitos puede seguir temporalmente en `localStorage`. Migrar toda la aplicación simultáneamente no es requisito del MVP.

## Sincronización y conflictos

- Cada operación incluye `operation_id`, `client_id`, `entity_id`, `base_version` y timestamp.
- El servidor incrementa `version` y rechaza bases obsoletas.
- Sesiones, progreso y eventos se agregan de forma append-only.
- Cambios concurrentes de texto producen conflicto visible si ambos lados partieron de la misma versión.
- Cambios no solapados pueden fusionarse por campo.
- Reordenamientos usan claves estables.
- Eliminaciones generan tombstone sincronizable.
- El servidor devuelve un cursor para `GET changes since cursor`.

Last-write-wins sólo podrá utilizarse en preferencias triviales. No debe decidir silenciosamente entre dos definiciones de meta o dos cierres.

## API lógica

- `listGoals(filters, cursor)`
- `createGoal(payload)`
- `updateGoal(id, patch, baseVersion)`
- `createAction(goalId, payload)`
- `startSession(goalId, actionId, plan)`
- `finishSession(sessionId, outcome)`
- `recordProgress(goalId, payload)`
- `pauseGoal(goalId, payload)`
- `returnToGoal(goalId, payload)`
- `closeGoal(goalId, closure)`
- `reformulateGoal(goalId, newGoal)`
- `pullChanges(cursor)`
- `pushBatch(operations)`

Supabase puede comenzar con consultas directas. `reformulateGoal` y operaciones multientidad deben ejecutarse mediante RPC/transacción para que cierre y nueva meta sean atómicos.

## Notificaciones

No forman parte del primer MVP experimental. Cuando se añadan:

- Reutilizar suscripciones, permisos, zona horaria, ledger y diagnóstico actuales.
- Introducir tipos de recordatorio específicos de meta.
- No inferir recurrencia desde hábitos.
- Permitir posponer, silenciar y elegir lenguaje.
- No mencionar días perdidos ni pendientes acumulados.

## Seguridad y privacidad

- TLS, RLS y validación de propietario en todas las operaciones.
- Consentimiento de sincronización separado de analítica.
- Consentimiento granular, informado, revocable y versionado.
- Motivo personal, notas y evidencia textual excluidos de eventos analíticos.
- Exportación, eliminación y retención documentadas.
- No usar datos para publicidad o entrenamiento sin consentimiento independiente.
- El PIN local sigue siendo bloqueo de conveniencia; no debe proteger secretos.

## Migraciones

1. Crear enums, tablas, FKs, índices y RLS de forma aditiva.
2. Crear RPC transaccional para reformulación.
3. Introducir almacenamiento local versionado y repositorio.
4. Activar dominio tras feature flag.
5. Probar sincronización en cuentas internas.
6. Añadir recordatorios sólo tras validación del núcleo.

Rollback: desactivar feature flag sin eliminar tablas. Las migraciones destructivas se posponen hasta después del piloto.

## Estrategia de pruebas

- Unitarias: transiciones, selectores, versión mínima, cierre y reformulación.
- Contratos: repositorio local/remoto y serialización.
- Integración: outbox, reconexión, idempotencia, tombstones y dos dispositivos.
- SQL: RLS, FKs, índices y RPC atómica.
- Componentes: creación, sesión, regreso, cierre y errores.
- E2E: crear → iniciar → parcial → offline → pausar → regresar → reformular/cerrar.
- Accesibilidad: axe, teclado, lector de pantalla, zoom 200/400 %, contraste y movimiento reducido.
- PWA: actualización del service worker, restauración de sesión y persistencia del temporizador.

## Observabilidad

Registrar identificadores técnicos, códigos de error, latencia y estados de sincronización. No registrar contenido de metas. Los eventos de producto deben ser minimizados y estar vinculados a la versión de consentimiento.
