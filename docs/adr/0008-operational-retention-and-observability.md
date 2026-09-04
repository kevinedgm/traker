# ADR-0008: retención y observabilidad operacional

- Estado: Implementada en local
- Fecha: 2026-09-01
- Alcance: notificaciones, errores técnicos, backups y salud operativa

## Decisión

- `sent_reminders`: 35 días. Es un ledger anti-duplicado diario, no historial.
- Jobs terminales (`completed`, `suppressed`, `expired`): 90 días.
- Deliveries: heredan los 90 días del job mediante `on delete cascade`.
- Suscripciones invalidadas: 90 días desde `invalidated_at`.
- Jobs `queued` o `leased` nunca se eliminan por antigüedad.
- Consentimientos y Sync v2 usan sus políticas propias; no se mezclan aquí.
- Los respaldos manuales pertenecen al usuario. No se copian a telemetría ni se
  eliminan desde la aplicación fuera de una acción explícita.

Toda limpieza exige primero
`traker_private.traker_notification_retention_dry_run(now())`. La aplicación no
tiene permisos de ejecución. El mantenimiento se ejecuta localmente como rol
de base, con advisory lock y conteos de salida.

## Salud y alertas

`traker_private.traker_operational_health(now())` devuelve exclusivamente:
jobs atascados, leases vencidos, suscripciones inválidas, operaciones sync sin
resolver, intentos/fallos de entrega de 24 horas y tres banderas de alerta.
No devuelve títulos, payloads, endpoints, notas, hábitos, emociones ni nombres.

La tasa de fallo sólo se marca alta con al menos 20 intentos y más de 20% de
fallos. Estos datos describen infraestructura; nunca deben presentarse como
productividad, salud, causalidad o desempeño personal.

## Incidente y restauración

1. Detener cron/worker sin borrar colas.
2. Capturar sólo el reporte content-free y el dry-run.
3. Revisar secretos, expiraciones, leases y proveedor; no inspeccionar payloads
   personales salvo autorización explícita del propietario.
4. Corregir y ejecutar un lote manual pequeño.
5. Confirmar que `stuckJobs` y `expiredLeases` vuelven a cero.
6. Restaurar desde backup sólo en un proyecto aislado y comparar conteos antes
   de sustituir la base. Nunca sobrescribir la única copia.
