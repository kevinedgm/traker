# ADR-0001: persistencia local de Metas en IndexedDB

- Estado: Aceptada
- Fecha: 2026-08-25
- Alcance: módulo Metas

## Contexto

Traker persiste actualmente stores Pinia en `localStorage`. Metas introduce varias colecciones relacionadas, sesiones recuperables, una outbox y tombstones. `localStorage` es síncrono, no ofrece transacciones y obliga a reescribir objetos completos.

## Decisión

Persistir el dominio Metas en IndexedDB detrás de `goals.repository.js`. El store Pinia no accederá directamente a IndexedDB. Durante la implementación se declarará `idb` como dependencia directa si se utiliza su wrapper; no se dependerá accidentalmente de una copia transitiva.

Almacenes iniciales:

- `goals`
- `goalStages`
- `goalActions`
- `workSessions`
- `progressEntries`
- `goalEvents`
- `syncOutbox`
- `syncMeta`

Una operación funcional que modifique varias colecciones utilizará una sola transacción local.

## Alternativas

### Ampliar `localStorage`

Menor trabajo inicial, pero sin atomicidad, consultas ni escala adecuadas. Rechazada para Metas.

### Migrar toda Traker a IndexedDB ahora

Produciría una arquitectura uniforme, pero mezcla una migración de Hábitos con la validación de Metas. Pospuesta.

### Usar sólo Supabase

Simplifica el modelo local, pero rompe el uso anónimo y offline. Rechazada.

## Consecuencias

- Se mantienen dos mecanismos locales temporalmente: Hábitos en `localStorage`, Metas en IndexedDB.
- El repositorio debe soportar esquema versionado y migraciones.
- Las pruebas deberán abrir una base aislada por caso.
- El UI recibe confirmación después del commit local, no después de Supabase.

## Reversión

El repositorio permite cambiar la implementación sin alterar stores o vistas. El feature flag puede ocultar Metas sin borrar datos locales.

