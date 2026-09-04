# Traker Metas — contrato del dominio

## Propósito

Definir estados, transiciones e invariantes antes de implementar stores, UI o SQL. Los nombres internos están en inglés; el copy de interfaz permanece en español de México.

## Agregados

- `Goal`: raíz del agregado y resultado finito.
- `GoalStage`: hito opcional dentro de una meta.
- `GoalAction`: resultado ejecutable; una puede ser la siguiente acción.
- `WorkSession`: intervalo dedicado a una acción o meta.
- `ProgressEntry`: evidencia de movimiento.
- `GoalEvent`: decisión de ciclo de vida o feedback auditable.

## Estados de Goal

| Estado | Significado | Puede modificarse |
|---|---|---|
| `draft` | Aún no tiene contrato mínimo | Sí |
| `active` | Está disponible para actuar | Sí |
| `paused` | Conserva contexto, fuera del trabajo actual | Sólo pausa/regreso/cierre |
| `completed` | Cumplió su definición de terminada | No |
| `reformulated` | Fue cerrada y continuada en otra meta | No |
| `abandoned` | Fue cerrada conscientemente | No |
| `archived` | Oculta de vistas ordinarias | Sólo metadatos de archivo |

## Estados de Stage

`pending`, `active`, `completed`, `skipped`, `removed`.

Una meta puede no tener etapas. Sólo una etapa puede estar marcada `active` por meta, pero puede no haber ninguna.

## Estados de Action

`pending`, `ready`, `in_progress`, `blocked`, `completed`, `postponed`, `adapted`, `cancelled`.

Sólo una acción no cerrada puede ser `current_action_id`. `adapted` indica que la acción original fue sustituida por una versión vinculada; no es una calificación inferior.

## Estados de WorkSession

`running`, `paused`, `finished`, `discarded`.

Una instalación sólo puede tener una sesión `running` a la vez. Una sesión puede finalizar como `partial`, `action_completed`, `blocked` o `stopped_intentionally`.

## Contrato mínimo para activar una meta

- Título no vacío.
- Definición de terminada observable.
- Una acción `ready` o una decisión explícita de crearla después.
- `personal_why` es recomendado, nunca obligatorio.
- Energía y tiempo son opcionales.

## Transiciones de Goal

```text
draft → active | archived
active → paused | completed | reformulated | abandoned | archived
paused → active | reformulated | abandoned | archived
completed → archived
reformulated → archived
abandoned → archived
```

No existe transición de cierre a `active`. Reformular crea otra meta.

## Comandos

### `CreateGoalDraft`

Crea una meta local con UUID y estado `draft`.

### `ActivateGoal`

Valida el contrato mínimo y emite `goal.activated`.

### `SetNextAction`

Selecciona una acción `ready`; desmarca la anterior sin completarla automáticamente.

### `StartWorkSession`

Requiere meta activa y ninguna sesión local corriendo. Cambia la acción `ready` a `in_progress`.

### `FinishWorkSession`

Registra resultado y duración; una sesión parcial conserva o redefine el siguiente punto de entrada.

### `PauseGoal`

Finaliza primero cualquier sesión corriendo mediante una decisión explícita. Emite `goal.paused`.

### `ReturnToGoal`

Requiere meta pausada. Recoge relevancia actual, cambios y nueva acción mínima. Emite `goal.returned` y activa la meta.

### `CompleteGoal`

Confirma la definición de terminada, cierra la meta y emite `goal.completed`.

### `AbandonGoal`

Cierra conscientemente y emite `goal.abandoned`; el motivo es opcional.

### `ReformulateGoal`

Cierra la original como `reformulated` y crea una nueva meta vinculada en una transacción.

## Eventos de dominio

- `goal.created`
- `goal.activated`
- `goal.paused`
- `goal.returned`
- `goal.completed`
- `goal.abandoned`
- `goal.reformulated`
- `action.created`
- `action.selected`
- `action.adapted`
- `action.completed`
- `session.started`
- `session.finished`
- `progress.recorded`

Cada evento tiene `event_id`, `goal_id`, `occurred_at`, `client_id`, `actor` y payload versionado.

## Invariantes

- Todas las entidades hijas pertenecen al mismo usuario que la meta.
- Una meta cerrada no recibe acciones, sesiones o progreso nuevos.
- Los eventos append-only no se editan; una corrección se registra como otro evento.
- Una acción completada no vuelve a `ready`.
- El límite de foco es una preferencia de UI, no una regla del dominio.
- Ausencia de actividad no cambia estados automáticamente.
- Fallar una sincronización no revierte un commit local válido.
- Ningún estado significa fracaso personal ni pérdida de progreso.

## Errores de dominio

- `GOAL_NOT_FOUND`
- `GOAL_ALREADY_CLOSED`
- `GOAL_ACTIVATION_INCOMPLETE`
- `ACTION_NOT_OWNED_BY_GOAL`
- `SESSION_ALREADY_RUNNING`
- `INVALID_STATE_TRANSITION`
- `VERSION_CONFLICT`
- `REFORMULATION_CYCLE`

La UI traduce estos códigos a mensajes accionables y sin culpa; no muestra trazas ni detalles SQL.

