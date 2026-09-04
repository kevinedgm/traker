# Traker — Modelo de datos propuesto

## Objetivo

Evolucionar el esquema actual sin perder hábitos, entradas, metas ni preferencias; permitir relaciones N:M, calendarios flexibles, parcialidad, cierre, recompensas agrupadas, privacidad y sincronización bidireccional.

No se creó ninguna migración en Etapa 1. Tras la aprobación para replantear la base local de prueba, Etapa 2 implementó el modelo como una migración aditiva integrada: `supabase/migrations/20260829053218_integrated_personal_model.sql`.

Estado local validado el 28 de agosto de 2026:

- 10 migraciones locales aplicadas y alineadas con el historial de PostgreSQL.
- 28 tablas públicas; las tablas principales permanecen vacías.
- 31 pruebas pgTAP aprobadas, incluidas relaciones, restricciones y aislamiento RLS entre usuarios.
- Advisors de seguridad y rendimiento de Supabase: sin hallazgos en nivel `warn`.
- No se ejecutó una migración destructiva ni se eliminó información.

## Principios

1. Expandir → backfill → dual read/write → verificar → cortar → contraer después.
2. Todo registro mutable tiene `updated_at`, versión y tombstone cuando sincroniza.
3. Toda operación de sync tiene UUID estable e idempotencia servidor.
4. Eventos/logs son append-first; ediciones crean nueva versión lógica.
5. Guardar UTC para instantes y también `local_date`/`timezone` para semántica diaria.
6. No persistir agenda derivable salvo excepciones explícitas.
7. RLS + grants mínimos en cada objeto expuesto.
8. Datos sensibles separados y con consentimiento específico.
9. IDs opacos UUID; no poner texto sensible en URLs/payloads.
10. Compatibilidad antes que limpieza del legado.

## Dominios existentes a conservar

- `habits` y `habit_entries`: expandir, no reemplazar de golpe.
- `traker_goals`, `traker_goal_actions`, `traker_goal_sessions`, `traker_goal_progress`, `traker_goal_events`: conservar y completar.
- Operaciones/consentimientos de metas: convertir en base del sync v2.
- `push_subscriptions`: conservar y extender por dispositivo.
- `settings`: conservar durante dual-read; mover preferencias especializadas gradualmente.

## Entidades del MVP

### `traker_goals` (existente, extendida)

Campos relevantes:

- `id uuid`, `user_id uuid`.
- `title`, `why`, `outcome`, `done_definition`.
- `horizon`: `short|medium|long`.
- `status`: `draft|active|paused|completed|closed`.
- `focus_rank smallint null` (MVP puede limitar a 1).
- `target_date date null`.
- `current_action_id uuid null`.
- `closed_at`, `close_reason`, `successor_goal_id null`.
- `version bigint`, `created_at`, `updated_at`, `deleted_at`.

Restricciones:

- Horizonte/estado por CHECK o enum estable.
- `focus_rank > 0`.
- Integridad de acción actual dentro de la misma meta mediante FK compuesta o trigger pequeño comprobado.
- No calcular completada desde hábitos.

### `traker_goal_milestones` (nueva)

- `id`, `user_id`, `goal_id`.
- `title`, `done_definition`.
- `position`, `status` (`pending|active|completed|skipped`).
- `target_date`, `completed_at`.
- `evidence_summary` opcional, no clínico.
- `version`, timestamps, `deleted_at`.

No requiere peso numérico en MVP. Completar puede sugerir cierre de meta, nunca hacerlo.

### `traker_goal_actions` (existente)

Añadir/normalizar:

- `milestone_id null`.
- `scheduled_local_date null`.
- `completed_at`, `status`.
- FK e índices.

### `traker_goal_events` / progreso (existente)

Usar como historial para:

- `goal_reformulated`
- `horizon_changed`
- `goal_paused/resumed/closed`
- `evidence_added`
- resoluciones de conflicto

Payload JSONB versionado y validado por tipo. No guardar snapshots completos innecesarios.

### `habits` (existente, extendida)

- `id`, `user_id`, `name`, `description`.
- `minimum_label`, `target_label`, `extra_label`.
- `icon_name` (Lucide), `color_token`.
- `status`: `active|paused|archived`.
- `paused_at`, `pause_reason null`.
- `timezone` por defecto.
- `version`, timestamps, `deleted_at`.
- Campos heredados `duration`, `linked_goal_id`, `minimum_version` se mantienen durante compatibilidad.

### `traker_habit_goal_links` (nueva)

- `habit_id`, `goal_id`, `user_id`.
- `contribution_note null`.
- `created_at`, `deleted_at`.
- PK/unique activo por par.

La presencia de `user_id` permite RLS directa y verifica que ambos objetos pertenecen al mismo usuario mediante trigger/RPC o FK compuestas si se añaden uniques `(id,user_id)`.

### `traker_habit_schedules` (nueva)

- `id`, `user_id`, `habit_id`.
- `kind`: `weekdays|times_per_week|times_per_month|every_n_days|window`.
- `start_date`, `end_date null`, `timezone`.
- `days_of_week smallint[] null`.
- `interval_days smallint null`.
- `period_minimum`, `period_target`, `period_extra`.
- `window_start time null`, `window_end time null`.
- `active`, `version`, timestamps, `deleted_at`.

CHECKs por `kind` evitan combinaciones inválidas. MVP solo expone `weekdays` y `times_per_week`; el esquema deja evolución segura.

### `traker_flexible_groups` (nueva)

- `id`, `user_id`, `name`.
- `period`: inicialmente `week`.
- `minimum_count`, `target_count`, `extra_count`.
- `status`, `timezone`, timestamps, versión/tombstone.

### `traker_flexible_group_members` (nueva)

- `group_id`, `habit_id`, `user_id`, `position`.
- `active_from`, `active_until`.
- Unique por grupo/hábito activo.

El grupo no duplica el hábito ni sus vínculos a metas.

### `habit_entries` (existente, log v2)

Añadir:

- `local_date date`.
- `timezone text`.
- `status`: `done|partial|not_done|conscious_skip`.
- `quantity numeric null`, `unit text null`, `duration_minutes int null`.
- `minimum_used boolean`.
- `occurrence_key text` determinista.
- `context_codes text[] null` o relación privada si crece.
- `client_operation_id uuid`.
- `edited_at`, `deleted_at`, `version`.
- `legacy_day_number`, `legacy_level` preservados.

Unique lógico: usuario + hábito + occurrence key activo. Para N/semana, cada registro tiene UUID y fecha; no precrear siete pendientes.

### `traker_daily_checkins` (nueva)

- `id`, `user_id`, `local_date`, `timezone`.
- `energy smallint null`, `mood smallint null`, `pressure smallint null`.
- `load_feeling`: `light|okay|heavy|null`.
- `context_codes text[] null`, `note text null`.
- `sync_scope`: `local_only|cloud` en cliente; solo `cloud` llega a servidor.
- `client_operation_id`, versión/timestamps/tombstone.

Todos los campos emocionales son opcionales. Unique por usuario/fecha activa.

### Recompensas (nuevas en servidor/IndexedDB)

`traker_rewards`

- Nombre, descripción, safety note opcional, estado, timestamps.

`traker_reward_rules`

- `reward_id`, `rule_type` (`all|at_least|milestone|day_sufficient`).
- `threshold`, `period`, `active_from/until`.

`traker_reward_rule_sources`

- `rule_id`, `source_type` (`habit|flex_group|goal_milestone`), `source_id`.
- La integridad polimórfica se valida en RPC/trigger; alternativa post-MVP: tablas por tipo.

`traker_reward_claims`

- `rule_id`, `period_key`, `unlocked_at`, `claimed_at`, `used_at`.
- Unique idempotente por regla/periodo.

### Notificaciones

`traker_notification_preferences`

- `user_id`, `device_id` nullable para defaults globales.
- Tipos habilitados, quiet hours, timezone, daily budget.
- `lock_screen_privacy`, `direct_actions_enabled`, `silenced_until`.

`push_subscriptions` (existente)

- Añadir `device_id`, `last_success_at`, `failure_count`, `invalidated_at`, capability JSON mínimo.

`traker_notification_jobs`

- `id`, `user_id`, `job_key`, `type`, `target_ref`, `scheduled_at`, `expires_at`.
- Estado `queued|leased|suppressed|completed|expired`.
- `lease_until`, `attempt_count`, `next_attempt_at`.
- Payload estructural sin texto sensible.

`traker_notification_deliveries`

- `job_id`, `subscription_id`, estado `sending|delivered|failed|invalid_subscription`.
- `provider_status`, `attempt`, `sent_at`, `error_code` y timestamps.

Interacciones pueden posponerse; si se crean, son opt-in y con retención corta.

### Sync v2

`traker_sync_operations` (extender/unificar existente)

- `operation_id uuid` PK por usuario.
- `user_id`, `entity_type`, `entity_id`, `operation_type`.
- `base_version`, `new_version`, `payload` validado.
- `device_id`, `occurred_at`, `received_at`.
- Resultado/conflicto mínimo.

No usar la tabla como historial infinito: política de retención después de que todos los dispositivos conocidos confirmen cursor o pasado un periodo aprobado.

## Vistas derivadas, no tablas

- Agenda de hoy.
- Progreso de frecuencia semanal/mensual.
- Recompensas cercanas.
- Tres horizontes.
- Día suficiente.
- Insights de correlación.

Las vistas SQL expuestas deben ser `security_invoker`; preferir RPCs/consultas sobre tablas con RLS cuando sea más claro.

## RLS y grants

Para toda tabla de usuario:

```sql
alter table ... enable row level security;
revoke all on ... from anon;
grant select, insert, update, delete on ... to authenticated; -- solo lo necesario
create policy ... to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

Reglas:

- No confiar solo en RLS; revisar grants por operación.
- Índice en `user_id` y claves usadas por políticas.
- `security definer` solo en schema privado, `search_path=''`, chequeo de usuario y grants de `EXECUTE` explícitos.
- RPC de sync valida consentimiento, pertenencia, versión y tipos de payload.
- Service role solo servidor.
- Probar usuario A/B y `anon` con `supabase test db`/pgTAP antes de aplicar.

La documentación oficial confirma que vistas creadas por rol privilegiado omiten RLS por defecto y recomienda `security_invoker` en PG15+: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Índices

Mínimos propuestos:

- Todas las FK (`goal_id`, `habit_id`, `group_id`, `rule_id`, `job_id`, `subscription_id`). Postgres no las indexa automáticamente.
- `(user_id, status, deleted_at)` en metas/hábitos.
- `(user_id, horizon, status)` en metas.
- `(goal_id, position)` en hitos/acciones.
- `(habit_id, start_date, end_date)` schedules.
- `(user_id, local_date)` entries/checkins.
- `(habit_id, local_date) where deleted_at is null` entries.
- `(user_id, next_attempt_at) where status='queued'` jobs.
- Unique `(user_id, job_key)` jobs.
- `(subscription_id, sent_at desc)` deliveries.
- `(user_id, received_at)` sync operations.
- Unique `(user_id, operation_id)` si PK no la incorpora.

Confirmar con `EXPLAIN (ANALYZE, BUFFERS)` y advisors; no crear índices redundantes por intuición.

## Restricciones de dominio

- Día de semana entre 1 y 7.
- Conteos `0 <= minimum <= target <= extra`, permitiendo null para extra.
- Hora como tipo `time`, no regex.
- Duración/cantidad no negativa.
- Ratings/check-in en rango explícito.
- `scheduled_at < expires_at`.
- `claimed_at >= unlocked_at`.
- Estados y tipos restringidos.
- FK de `current_action` dentro de la misma meta.
- Una sesión activa por usuario si el contrato sigue siendo global, no solo por meta.

## Offline local

Un IndexedDB unificado por versión lógica:

```text
traker-v2
├── goals, milestones, actions, sessions, goalEvents
├── habits, schedules, habitGoalLinks
├── flexibleGroups, flexibleGroupMembers
├── habitLogs, dailyCheckins
├── rewards, rewardRules, rewardSources, rewardClaims
├── notificationPreferences
├── outbox
├── syncCursors
└── migrationMeta
```

**[Recomendación técnica · Alto]** Migrar por dominio. Durante un periodo, leer primero v2 y hacer fallback a stores/localStorage heredados; dual-write solo donde sea imprescindible. No abrir dos DB y asumir atomicidad entre ellas.

## Conflictos

| Tipo | Política recomendada |
|---|---|
| Logs de días distintos | merge append-only |
| Dos logs misma ocurrencia | conservar versiones; elegir último solo si base coincide; si ambos cambian status, mostrar conflicto |
| Edición de texto de meta | optimistic concurrency; conflicto de campo/versión visible |
| Cambio de horizonte/foco | LWW con evento de historial si no hay base conflictiva |
| Pausa/cierre vs edición | estado terminal/pausa requiere resolución explícita |
| Borrado vs edición | tombstone gana provisionalmente; permitir restaurar con nueva operación |
| Recompensa claim | unique por periodo; idempotente |
| Preferencias | LWW por dispositivo; global separado |

Reloj del dispositivo no decide por sí solo. Usar versión de servidor y `received_at`; `occurred_at` sirve para historia.

## Compatibilidad y backfill

### Hábitos

- Crear un link N:M desde `linked_goal_id` y desde `goalId` local si existe.
- Conservar el campo original hasta la fase de contrato.
- Convertir `reminder_days` a schedule `weekdays` cuando sea válido.
- Si solo existe duración de reto, mantener modo legado y pedir elección de calendario, no inventarla.

### Entradas

- Calcular `local_date` desde fecha de creación + `day_number` usando timezone conocida; si es incierta, marcar `migration_quality='inferred'`.
- Mapear nivel a status solo tras aprobación.
- Conservar `legacy_level/day_number`.

### Metas

- Hidratación remota inicial antes de permitir edición en dispositivo nuevo.
- Crear hitos solo desde datos explícitos; no convertir cada acción en hito.

### Recompensas

- Importar reglas locales como una fuente única.
- Rueda no se migra; las recompensas definidas sí.

## Exportación y borrado

Export v2 incluye:

- Todos los stores locales, datos remotos del usuario, outbox y preferencias.
- Versión de esquema, timezone y calidad de migración.
- Catálogo de copy solo como preferencias/IDs, no código completo.

Borrado:

- “Borrar solo este dispositivo” limpia IndexedDB, localStorage, Cache Storage de app y suscripción local.
- “Borrar cuenta y nube” requiere reautenticación, borrado server-side verificable y luego limpieza local.
- Mostrar qué no se puede recuperar y ofrecer export previa.
- Pruebas automatizadas enumeran stores/tablas, evitando listas manuales incompletas.

## Plan de migraciones original de Etapa 1

La lista siguiente se conserva como trazabilidad del diseño inicial. Para el entorno personal sin datos de producción se consolidó el alcance aditivo de `010`–`015` en `20260829053218_integrated_personal_model.sql`. La limpieza destructiva planteada como `016` no se ejecutó.

1. `supabase/migrations/010_security_preflight_and_view_hardening.sql`
2. `supabase/migrations/011_goal_milestones_and_habit_goal_links.sql`
3. `supabase/migrations/012_habit_schedules_flexible_groups_and_log_v2.sql`
4. `supabase/migrations/013_daily_checkins_rewards_and_privacy.sql`
5. `supabase/migrations/014_notification_jobs_deliveries_and_preferences.sql`
6. `supabase/migrations/015_sync_v2_backfill_and_compatibility.sql`
7. `supabase/migrations/016_contract_cleanup_after_cutover.sql` — post-MVP, solo tras ventana de rollback y aprobación separada.

Cada migración tendrá un script compensatorio de ensayo en `supabase/rollback/NNN_<name>_down.sql`; esos scripts no se ejecutan automáticamente y deben probarse en rama/backup. `016` nunca forma parte del primer despliegue.

## Puertas antes de crear 010

1. `supabase migration list` contra proyecto vinculado.
2. Confirmar Postgres version, grants de vistas, RLS y objetos desplegados.
3. Ejecutar advisors de seguridad/rendimiento.
4. Backup/export y ensayo de restore.
5. Contar filas y detectar datos huérfanos.
6. Aprobar mapeo de niveles y timezone.
7. Crear rama/entorno staging.
8. Aprobar retención de datos sensibles y sync operations.

## Cambios vigentes de Supabase relevantes

El changelog de agosto de 2026 indica, entre otros cambios, que la exposición automática de nuevas tablas al Data API cambia y será obligatoria para todos los proyectos el 30-10-2026; por ello cada migración debe declarar grants/exposición explícitos y no depender de defaults. También está deprecado fijar versión de extensiones: [Supabase breaking changes](https://supabase.com/changelog?types=breaking-change).
