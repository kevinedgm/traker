# ADR-0006: retención y rehidratación del ledger Sync v2

- Estado: Aceptada
- Fecha: 2026-08-30
- Alcance: cierre técnico posterior a F6

## Contexto

`public.traker_sync_operations` conserva sobres idempotentes sin contenido de
usuario. Esa evidencia permite deduplicar reintentos y señalar cambios a otros
dispositivos, pero no debe crecer indefinidamente. Borrar por antigüedad sin
considerar cursores rompería el regreso de un dispositivo y podría eliminar la
última prueba de un tombstone.

La instalación local tenía 16 operaciones al aprobar esta ADR: 12 `applied`,
1 `duplicate`, 1 `conflict` y 2 `rejected`. El diagnóstico se hizo sólo con
conteos, estados y límites temporales; no se inspeccionaron payloads.

## Decisión

- `pending`, `conflict` y `rejected` nunca son elegibles para borrado
  automático.
- `applied` y `duplicate` requieren al menos 180 días de antigüedad.
- Cada dispositivo distinto del originador que siga activo debe haber pasado
  la operación. Un cursor es activo durante 90 días desde `updated_at`.
- La operación debe quedar además 30 días detrás del cursor activo más lento.
- Se conserva siempre la operación más reciente de cada entidad.
- Se conserva explícitamente el `delete` que representa un tombstone canónico
  todavía activo en `habits` o `traker_habit_logs`.
- Un dispositivo cuyo cursor quedó dentro del tramo compactado recibe
  `rehydrationRequired`; primero descarga el snapshot canónico completo y sólo
  después confirma un nuevo cursor.
- Por debajo de 10 000 filas, la ejecución destructiva se omite. El `dry-run`
  sigue disponible y devuelve únicamente conteos y límites.
- No hay job automático. La compactación es una tarea manual, transaccional y
  protegida por un advisory lock.

## Superficie de seguridad

Las funciones que calculan candidatos y borran filas viven en
`traker_private`, usan `search_path` vacío y no conceden `USAGE` ni `EXECUTE` a
`PUBLIC`, `anon`, `authenticated` o `service_role`. La tabla pública de estado
de retención contiene sólo límites por propietario, tiene RLS y es de sólo
lectura para el propietario. Los RPC públicos de pull y confirmación continúan
filtrando con `auth.uid()`.

## Recuperación de dispositivos inactivos

1. El pull detecta que el cursor es anterior o igual al límite compactado.
2. Responde sin cambios incrementales y entrega un high-water mark.
3. El cliente obtiene las tablas canónicas bajo RLS y actualiza IndexedDB.
4. Sólo si el snapshot terminó confirma el high-water mark en el servidor.
5. Si falla cualquier paso, conserva el cursor anterior y repite el snapshot.

Este camino evita suponer que el ledger conserva historia completa. El snapshot
canónico, no el ledger, es la fuente de rehidratación.

## Operación y reversión

- Ejecutar primero `traker_private.traker_sync_ledger_retention_dry_run(...)`.
- Verificar backup y conteos antes de usar modo `execute`.
- `p_force` existe sólo para pruebas y recuperación manual deliberada.
- La down migration elimina la política y restaura el pull previo; no puede
  reconstruir filas que ya hayan sido compactadas. Por eso la ejecución real
  exige backup.
- `traker_phase6_rollback` se conserva durante 30 días de uso local estable y
  sólo se retira después de verificar un backup posterior.

## Consecuencias

La idempotencia reciente y los conflictos sin resolver se preservan. Un equipo
que permanezca fuera más de 90 días paga el costo de un snapshot completo al
volver, a cambio de que el ledger pueda acotarse sin pérdida silenciosa.

