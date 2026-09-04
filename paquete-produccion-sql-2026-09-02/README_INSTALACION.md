# Paquete SQL de producción — Traker

Paquete preparado el **2 de septiembre de 2026** para instalar el esquema de
Traker en un proyecto Supabase nuevo y vacío.

## Contenido

- `migrations/`: 24 migraciones oficiales, en el mismo orden que el historial
  validado de la base local.
- `rollbacks/`: 12 scripts compensatorios para ensayos o incidentes. **No se
  ejecutan durante una instalación normal.**
- `ORDEN_INSTALACION.txt`: inventario exacto de las migraciones.
- `MANIFEST.sha256`: checksums para comprobar que el paquete no fue alterado.

No contiene `.env`, contraseñas, claves Supabase, claves VAPID, `CRON_SECRET`,
backups, seeds ni datos de usuarios.

## Antes de instalar

1. Crear o seleccionar un proyecto Supabase de producción **vacío**.
2. Crear un backup si el proyecto ya contiene cualquier esquema o dato.
3. Verificar el paquete desde esta carpeta:

   ```bash
   shasum -a 256 -c MANIFEST.sha256
   ```

4. Revisar el historial remoto antes de escribir:

   ```bash
   npx supabase migration list --linked
   ```

   Si aparecen migraciones remotas que no coinciden con
   `ORDEN_INSTALACION.txt`, detenerse y reconciliar el historial. No ejecutar
   los archivos en lote desde el SQL Editor.

## Instalación recomendada con Supabase CLI

Este directorio es un artefacto de entrega. Para que Supabase registre el
historial correctamente, copie su carpeta `migrations/` como
`supabase/migrations/` dentro de un checkout limpio del proyecto que contenga
`supabase/config.toml`.

Desde la raíz de ese checkout:

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase migration list --linked
npx supabase db push --linked --include-all --skip-vault --dry-run
```

Revise que el `dry-run` enumere exactamente las 24 migraciones de
`ORDEN_INSTALACION.txt`. Para una base nueva y después de obtener la aprobación
de despliegue:

```bash
npx supabase db push --linked --include-all --skip-vault
npx supabase migration list --linked
```

No use `--include-seed`: Traker no necesita datos de ejemplo en producción.

## Validación posterior

Desde el repositorio completo, ejecutar:

```bash
npx supabase test db --linked
npx supabase db advisors --linked --type all --level warn --fail-on error
```

Además:

- comprobar que las 24 versiones aparecen en el historial remoto;
- verificar RLS y aislamiento con usuario A, usuario B y `anon`;
- verificar que las tablas requeridas están expuestas al Data API mediante sus
  grants explícitos;
- desplegar y probar las Edge Functions por separado;
- configurar secretos exclusivamente en Supabase, nunca en este paquete;
- ejecutar el smoke y la suite E2E contra staging antes de producción.

## Advertencia sobre Web Push

`003_push_notifications.sql` conserva, dentro de comentarios históricos, una
referencia de proyecto antigua y el marcador `<CRON-SECRET>`. Ese bloque está
comentado y **no se ejecuta como migración**. No debe descomentarse ni copiarse
en producción. El cron, la URL real, `VAPID_PRIVATE_KEY` y `CRON_SECRET` se
configuran durante el despliegue autorizado del worker.

## Rollback

Los archivos de `rollbacks/` son herramientas de recuperación manual, no una
cadena inversa completa. Antes de usar cualquiera:

1. confirmar el incidente y la versión exacta;
2. crear y verificar un backup;
3. ensayar el rollback en una restauración aislada;
4. revisar dependencias con migraciones posteriores;
5. aplicar sólo el archivo expresamente aprobado.

La fuente de verdad para una recuperación completa sigue siendo un backup
verificado.
