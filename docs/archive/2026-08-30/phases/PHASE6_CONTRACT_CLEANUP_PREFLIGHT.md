# Fase 6 — Preflight de contrato y limpieza

Estado: **aplicado al esquema local activo**  
Fecha: 30 de agosto de 2026

## Resultado actual

El cliente ya dejó de leer y escribir los tres contratos heredados que pueden
retirarse primero:

- `public.habit_entries`;
- `public.habits.linked_goal_id`;
- `public.habits.reminder_days`.

Los vínculos N:M viven en `traker_habit_goal_links`, los días de agenda en
`traker_habit_schedules` y los registros en `traker_habit_logs`. El worker de
notificaciones también exige una agenda canónica activa y ya no usa
`habits.reminder_days` como fallback.

`habits.minimum_version` **no es un campo heredado para retirar**: sigue siendo
parte del producto y del modelo local de hábitos.

## Checklist de ejecución

- [x] Inventariar lectores, escritores, funciones y vistas heredadas.
- [x] Cortar lectores/escritores heredados en el cliente.
- [x] Cortar el fallback heredado del worker de notificaciones.
- [x] Crear un backup lógico local con extensiones y datos.
- [x] Verificar checksum después de copiarlo fuera del contenedor.
- [x] Restaurar el backup en una base aislada.
- [x] Comparar datos, relaciones, índices, triggers, RLS, políticas y funciones.
- [x] Ejecutar 229 pruebas Vitest, 104 aserciones pgTAP y build PWA después
  del corte del runtime.
- [x] Sustituir el RPC `traker_apply_sync_operations` para que no escriba
  `reminder_days`.
- [x] Crear migración y down migration mediante Supabase CLI, sin aplicarlas al
  esquema activo.
- [x] Probar subida, rollback y equivalencia sobre una restauración aislada.
- [ ] Definir la retención del ledger; no borrar operaciones sin una política
  temporal y de cursores aprobada.
- [ ] Retirar rueda/código visual obsoleto con una regresión de recompensas.
- [x] Obtener aprobación humana separada para la eliminación física.
- [x] Aplicar la migración al esquema local activo.

## Backup verificado

- Archivo local ignorado por Git:
  `.local-backups/phase6/traker-f6-preflight-20260830.backup`
- Formato: `pg_dump` custom.
- Tamaño: `428199` bytes.
- SHA-256:
  `70cbaeee5cd11b826f6d2019f6013942373641b68a1d916f52b86e04011303dc`
- Esquemas: `public`, `auth`, `storage`, `extensions`, `vault` y
  `supabase_migrations`.
- Extensiones incluidas: `pgcrypto`, `uuid-ossp`, `pg_stat_statements` y
  `supabase_vault`.

La restauración limpia se hizo en `traker_f6_restore_jnp4pi`, propiedad de
`supabase_admin`. Fue necesario eliminar primero el esquema `public` vacío que
PostgreSQL crea automáticamente.

Comparación fuente/restauración:

| Grupo | Objetos | Resultado |
| --- | ---: | --- |
| Extensiones | 5 | hash idéntico |
| Relaciones | 71 | hash idéntico |
| Índices | 211 | hash idéntico |
| Triggers | 19 | hash idéntico |
| Políticas | 28 | hash idéntico |
| Funciones | 90 | hash idéntico |
| Tablas con estado RLS | 64 | hash idéntico |
| Filas funcionales seleccionadas | 20 | conteos y hashes idénticos |

El primer ensayo de backup completo incluyó infraestructura administrada de
Realtime y falló al intentar restaurar una configuración reservada. El archivo
conservado es la copia portable de la aplicación y declara explícitamente sus
extensiones; esa versión sí restauró sin errores.

## Migración preparada

- Subida:
  `supabase/migrations/20260830081517_contract_cleanup_after_cutover.sql`.
- Rollback:
  `supabase/rollbacks/20260830081517_contract_cleanup_after_cutover.down.sql`.
- Estado: la subida fue aplicada a `postgres` mediante
  `supabase migration up --local`; el historial local registra
  `20260830081517` y el rollback permanece disponible.

La matriz aislada ejecutó `restore → up → down`. Después del rollback
coincidieron los hashes de datos funcionales, relaciones, columnas, índices,
triggers, políticas, funciones, RLS y los 418 privilegios efectivos de los
roles de aplicación. Una prueba negativa agregó una entrada heredada sin log
canónico y la subida abortó con `PHASE6_MISSING_CANONICAL_LOGS:1`, antes de
crear el archivo privado de rollback.

## Procedimiento de restauración local

Usar un nombre de base temporal explícito; nunca apuntar estos comandos a
`postgres` como destino del restore.

```sh
docker cp .local-backups/phase6/traker-f6-preflight-20260830.backup \
  supabase_db_traker-local:/tmp/traker-f6-preflight-20260830.backup

docker exec supabase_db_traker-local psql -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 -c \
  "create database traker_f6_restore_check owner supabase_admin"

docker exec supabase_db_traker-local psql -U supabase_admin \
  -d traker_f6_restore_check -v ON_ERROR_STOP=1 -c "drop schema public"

docker exec supabase_db_traker-local pg_restore -U supabase_admin \
  -d traker_f6_restore_check --exit-on-error --no-owner \
  /tmp/traker-f6-preflight-20260830.backup
```

## Dependencias que todavía bloquean el DROP

La aplicación ya está cortada, pero el SQL de Fase 5 conserva contratos para
rollback:

- `traker_backfill_legacy(uuid)` lee `habit_entries` y `reminder_days`;
- `traker_backfill_quality()` compara filas heredadas y canónicas;
- `traker_apply_sync_operations(text, jsonb)` aún escribe
  `habits.reminder_days` en operaciones de hábito;
- `traker_habit_logs.legacy_entry_id` mantiene una FK a `habit_entries`.

Las vistas `v_habit_streaks`, `v_habit_completion` y
`v_emotion_frequency` no tienen consumidores en el runtime, pero dependen de
`habit_entries` y deben retirarse en la misma migración.

## Orden propuesto para la migración

1. Abortarla si existe una entrada sin log canónico, un recordatorio sin agenda
   activa o un vínculo legado sin vínculo N:M.
2. Guardar una instantánea exacta y sin grants de cliente en el esquema
   temporal `traker_phase6_rollback`.
3. Reemplazar el RPC v2 para ignorar `reminderDays`; la agenda dedicada sigue
   escribiéndose mediante `traker_habit_schedules`.
4. Retirar `traker_backfill_legacy` y `traker_backfill_quality`.
5. Retirar las tres vistas analíticas heredadas.
6. Quitar la FK de `legacy_entry_id`, conservando temporalmente el UUID y los
   campos de procedencia para auditoría/rollback.
7. Retirar `habit_entries`, `linked_goal_id` y `reminder_days`.
8. Mantener la compactación del ledger en una migración separada: sus garantías
   dependen de la retención y del cursor mínimo de todos los dispositivos.

## Rollback obligatorio antes de aplicar

La fuente de verdad del rollback es el backup verificado. Además, la down
migration debe:

- recrear `habit_entries`, políticas, índices y trigger;
- restaurar exactamente las filas preexistentes desde
  `traker_phase6_rollback` y reconstruir desde logs solo las creadas después;
- recrear `linked_goal_id` desde el primer vínculo N:M activo de cada hábito;
- recrear `reminder_days` desde la agenda activa de tipo `weekdays`;
- restaurar vistas y funciones de compatibilidad;
- reinstalar la versión anterior de `traker_apply_sync_operations`.
- eliminar el esquema temporal `traker_phase6_rollback` al terminar.

La eliminación se autorizó solo después de que esa down migration pasó sobre
la base restaurada y el usuario dio la aprobación separada `aplica F6`.

## Evidencia posterior a la aplicación

- Historial local alineado: `20260830081517` presente en archivo y base.
- `habit_entries`, `linked_goal_id`, `reminder_days`, tres vistas y dos RPC de
  backfill: ausentes.
- Archivo privado de rollback: 1 hábito y 1 entrada preservados, sin `USAGE`
  para `anon`, `authenticated` ni `service_role`.
- Datos canónicos: 1 hábito, 1 log, 1 agenda activa y 12 operaciones.
- RPC v2 autenticado: resultado `applied` dentro de transacción revertida.
- Advisors Supabase: sin hallazgos de seguridad o rendimiento.
- Validación: 229 pruebas Vitest, 104 aserciones pgTAP y build PWA aprobados.
