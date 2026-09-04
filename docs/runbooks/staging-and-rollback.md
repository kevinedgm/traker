# Staging, backup, restore y rollback

Este runbook prepara el ensayo, pero no autoriza crear proyectos, enlazar la
CLI, cargar secretos ni desplegar. Esas acciones requieren la aprobación
humana registrada en el plan operativo.

## Separación de configuración

- Frontend publicable: `VITE_API_URL`, `VITE_SYNC_V2_PILOT`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_REQUEST_TIMEOUT_MS` y `VITE_VAPID_PUBLIC_KEY`.
- Edge Functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `CRON_SECRET`.
- CI/operación: `SUPABASE_ACCESS_TOKEN`, referencia del proyecto staging,
  contraseña o URL de base y URL pública del despliegue.

Una variable de servidor nunca debe llevar prefijo `VITE_`. Los valores reales
no se guardan en archivos del repositorio, argumentos de scripts, logs ni
capturas.

## Preflight local sin secretos

```sh
npm run build
npm run staging:preflight
node scripts/staging/database-rehearsal.mjs
node scripts/staging/rollback-rehearsal.mjs
```

El preflight verifica inventario público, ausencia de secretos rastreados,
orden de migraciones, rollback de las migraciones nuevas, scripts de prueba y
base `/traker/` del manifiesto. Los dos rehearsals son `dry-run` por defecto.

## Puerta de backup/restore remoto

Sólo después de crear y autorizar dos bases separadas de staging:

1. Revisar nuevamente la documentación y el changelog oficial de Supabase.
2. Ejecutar `npx supabase db dump --help` y comprobar la versión instalada.
3. Exportar `TRAKER_STAGING_DB_URL` y `TRAKER_RESTORE_DB_URL` fuera del historial.
4. Confirmar que el destino es desechable y distinto del origen.
5. Ejecutar:

```sh
TRAKER_STAGING_REHEARSAL_ACK=staging-only \
  node scripts/staging/database-rehearsal.mjs --execute
```

El script genera tres archivos SQL y un manifiesto SHA-256 dentro de
`.local-backups/staging-rehearsal/`, que Git ignora. La restauración requiere
`psql`; si no está instalado, el script falla antes de declarar éxito. El
backup de base no incluye los objetos binarios de Storage: deben inventariarse
y copiarse por separado antes de certificar un restore remoto.

## Puerta de rollback

Sobre la base restaurada aislada, nunca sobre el origen:

```sh
TRAKER_RESTORE_REHEARSAL_ACK=isolated-restore-only \
  node scripts/staging/rollback-rehearsal.mjs --execute
```

El down y el up de la última migración se ejecutan en una transacción. Después
debe repetirse pgTAP, advisors, el conteo content-free y la comparación de
historial de migraciones.

## Smoke de la aplicación desplegada

```sh
npm run staging:smoke -- --url=https://host.example/traker/
```

Comprueba HTML, manifest, Service Worker, icono, rutas directas, 404 del SPA,
content types y que `scope`/`start_url` sigan en `/traker/`. No autentica ni
modifica datos.

Vite Preview sirve los archivos físicos desde `/` aunque el manifiesto conserve
`/traker/`. Sólo para validar ese servidor local se usa
`--asset-root=/`; en staging real no debe usarse esa excepción.

## Monitoreo, límites y costo

Staging debe empezar en el plan gratuito o con presupuesto mensual de cero. No
se habilita un plan pagado, add-on ni autoescalado sin una aprobación humana
separada. Antes de desplegar se registran los límites vigentes del proveedor y
se configuran alertas al 50 %, 80 % y 100 % para base, Storage, egreso,
invocaciones Edge y usuarios activos. Al alcanzar 80 % se detienen pruebas de
volumen; al 100 % se pausa staging en vez de ampliar gasto automáticamente.

La revisión operativa diaria usa `traker_notification_operational_health()` y
los paneles content-free del proveedor para conexiones, CPU, tamaño de base,
errores 5xx, latencia y fallos de funciones. Los umbrales de producto siguen
siendo los ya versionados: jobs vencidos, leases expirados, sync sin resolver y
tasa de entrega sólo con muestra mínima de 20. Ningún panel ni alerta incluye
payloads, títulos de hábitos, notas o emociones.

Cada ventana de cambio conserva versión del frontend, migración máxima, smoke,
pgTAP, advisors y checksum de backup. Un error crítico, aislamiento cross-user
fallido, migración incompleta o pérdida de rutas detiene la ventana y activa el
rollback siguiente. Los valores monetarios y cuotas reales se completan desde
la consola de staging autorizada; no se inventan desde localhost.

## Rollback operativo

1. Detener nuevas escrituras automatizadas y el cron de recordatorios.
2. Conservar evidencia content-free de salud y conteos.
3. Revertir primero el frontend a un artefacto previamente verificado.
4. Aplicar SQL de rollback sólo si el contrato del cliente anterior lo exige y
   el rehearsal aislado fue verde.
5. Repetir usuario A/B/anon, pgTAP, advisors, E2E y smoke.
6. Reanudar cron únicamente después de confirmar leases, deduplicación y
   ausencia de envíos posteriores a completar.
