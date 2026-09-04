# ADR-0002: sincronización mediante outbox idempotente y versiones

- Estado: Aceptada
- Fecha: 2026-08-25

## Contexto

La sincronización actual de Hábitos combina cola local y last-write-wins. En Metas, dos dispositivos pueden editar la definición de terminada, cerrar una meta o reordenar acciones. Resolver todo mediante timestamps puede perder intención.

## Decisión

Cada mutación local generará una operación de outbox con:

- `operation_id`: UUID único e idempotente.
- `client_id`: instalación que originó la operación.
- `entity_type` y `entity_id`.
- `operation_type`.
- `base_version` conocida antes del cambio.
- `payload` mínimo.
- `created_at` y número de intento.

El servidor registra las operaciones procesadas, valida `base_version` e incrementa la versión de la entidad. El cliente obtiene cambios mediante cursor.

Política de conflicto:

- Eventos, progreso y sesiones: append-only, deduplicados por ID.
- Campos distintos: fusión por campo cuando puede demostrarse que no se solapan.
- Mismo texto editado concurrentemente: conflicto explícito para elección humana.
- Cierre concurrente: no se sobrescribe; se muestra conflicto.
- Preferencias no sensibles: last-write-wins permitido.
- Eliminación: tombstone sincronizable.

## Alternativas

- Last-write-wins global: simple, pero puede perder datos significativos. Rechazada.
- CRDT completo: robusto, pero desproporcionado para el MVP. Pospuesto.
- Sincronizar documentos completos: fácil de programar, costoso y conflictivo. Rechazada.

## Consecuencias

- Supabase necesitará tablas o funciones para idempotencia y cursores.
- La UI necesita estados `local`, `syncing`, `synced`, `conflict` y `error`.
- `sync.service.js` puede conservar su papel de orquestador, pero el protocolo de Metas se implementará separado para no romper Hábitos.

## Criterios de aceptación

- Reenviar una operación no duplica resultados.
- Un cierre no puede perderse silenciosamente.
- Crear anónimamente y autenticar después conserva IDs y relaciones.
- El orden converge tras reconectar dos dispositivos.

