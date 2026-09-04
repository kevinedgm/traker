# Configurar recordatorios en la nube (Web Push)

Este runbook activa los avisos que pueden llegar con la PWA cerrada. Describe
el contrato vigente después de las migraciones integradas y de Fase 6; no se
debe ejecutar SQL histórico manualmente desde el Dashboard.

## Arquitectura vigente

- El navegador guarda una suscripción por usuario y dispositivo en
  `public.push_subscriptions`.
- Las preferencias viven en `public.traker_notification_preferences`.
- `send-reminders` crea jobs idempotentes en
  `public.traker_notification_jobs`.
- `public.traker_claim_notification_jobs(integer, integer)` reclama un lote con
  lease y `SKIP LOCKED`.
- Cada intento se registra en `public.traker_notification_deliveries`.
- Fallos transitorios (`0`, `429` y `5xx`) regresan el job a la cola con
  backoff. Respuestas `404` y `410` invalidan la suscripción.
- Apertura, bloque/hábito, cierre y regreso comparten presupuesto diario,
  cooldown, horas de silencio y privacidad de pantalla bloqueada.

La función usa el contrato canónico `traker_habit_schedules` y
`traker_habit_logs`. No depende de `habit_entries` ni `reminder_days`, retirados
en Fase 6.

## 1. Preflight

Antes de tocar un proyecto remoto:

```bash
npx supabase --version
npx supabase migration list --local
npx supabase test db --local
npx supabase db advisors --local --type all --level warn --fail-on error
```

Comprueba también que `.env.example` mantiene sólo variables públicas. Nunca
copies `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` ni `CRON_SECRET` a una
variable `VITE_*`.

## 2. Aplicar migraciones

En un entorno remoto aprobado y enlazado, revisa primero la ayuda de la versión
instalada y después ejecuta el flujo de migraciones del repositorio:

```bash
npx supabase db push --help
npx supabase db push
npx supabase migration list --linked
```

No pegues por separado `003_push_notifications.sql`: las migraciones
posteriores crean el planner fiable, jobs, deliveries, leases, preferencias,
day closures y grants requeridos por `service_role`.

## 3. Configurar secretos de la Edge Function

Genera un par VAPID específico del entorno y un secreto largo para el cron. La
clave pública puede ir al frontend; la privada y el secreto sólo viven en
Supabase Secrets.

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY=<clave-publica> \
  VAPID_PRIVATE_KEY=<clave-privada> \
  CRON_SECRET=<secreto-largo>
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son proporcionados a la función
por el runtime de Supabase; no se guardan en el repositorio.

## 4. Desplegar el worker

`supabase/config.toml` declara `verify_jwt = false` para `send-reminders`
porque el invocador es el cron con un secreto compartido, no un usuario. La
función valida `Authorization: Bearer <CRON_SECRET>` antes de planear o reclamar
jobs.

```bash
npx supabase functions deploy --help
npx supabase functions deploy send-reminders --no-verify-jwt
```

Una petición sin token debe devolver `401`. Con el secreto correcto debe
responder JSON con `ok`, `planned`, `claimed`, `delivered`, `retrying` e
`invalidated`:

```bash
curl -X POST \
  -H "Authorization: Bearer <CRON_SECRET>" \
  https://<project-ref>.supabase.co/functions/v1/send-reminders
```

No guardes el comando real con su secreto en el historial del proyecto,
capturas ni reportes.

## 5. Programar la invocación

Configura un scheduler autorizado para invocar la función cada 5–10 minutos.
El scheduler debe enviar únicamente el `CRON_SECRET`; nunca una clave pública o
un JWT de usuario. Conserva la configuración del cron como infraestructura del
entorno y documenta:

- frecuencia;
- timeout;
- última ejecución correcta;
- responsable de rotar el secreto;
- procedimiento para pausar envíos.

El worker ya controla idempotencia y ventanas de entrega. Aumentar la frecuencia
del cron no aumenta el presupuesto diario del usuario.

## 6. Configurar el frontend

Variables públicas necesarias en el build:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave-publicable>
VITE_VAPID_PUBLIC_KEY=<clave-publica-vapid>
```

La suscripción requiere:

1. PWA/navegador compatible con Service Worker y Push API.
2. Acción explícita del usuario para solicitar permiso.
3. Sesión Supabase activa.
4. Preferencias sincronizadas para ese dispositivo.

## 7. Verificación en dispositivo

En cada plataforma objetivo:

1. Instala la PWA cuando la plataforma lo requiera.
2. Inicia sesión y activa recordatorios desde Ajustes.
3. Abre **Ajustes → Recordatorios → Diagnóstico y prueba**.
4. Confirma permiso, Service Worker, instalación y suscripción activa.
5. Envía una prueba local desde la pantalla de diagnóstico.
6. Programa un recordatorio dentro de la siguiente ventana del cron.
7. Cierra la app y confirma recepción con pantalla bloqueada.
8. Toca la notificación y confirma el deep link.
9. Completa el hábito antes de otra ventana y confirma que el aviso se suprime.
10. Revoca el permiso y confirma recuperación/limpieza de la suscripción.

La certificación mínima requiere Android instalado, iPhone instalado, iPhone
no instalado y escritorio compatible. El planner automatizado no sustituye
estas pruebas físicas.

## 8. Diagnóstico seguro

Consultas y reportes deben exponer sólo conteos y estados. No incluyas endpoint,
claves `p256dh`/`auth`, títulos, cuerpos, nombres de hábitos, notas o payloads.

Revisa como mínimo:

- jobs `queued` o `leased` fuera de su ventana;
- entregas `failed` agrupadas por `error_code`;
- suscripciones invalidadas;
- leases vencidos;
- presupuesto y supresiones esperadas;
- salud del cron y latencia de la función.

Después de cambios de SQL o grants:

```bash
npx supabase test db --local
npx supabase db advisors --local --type all --level warn --fail-on error
```

## Limitaciones actuales

- El Web Push fiable requiere cuenta Supabase; el uso completamente local sólo
  puede mostrar avisos mientras el navegador/PWA puede ejecutar el scheduler.
- iOS requiere instalar la PWA para Web Push y no garantiza todas las acciones
  interactivas de otras plataformas.
- El Bloque 7 del plan vigente conserva pendiente la certificación física, la
  persistencia de acciones con la app cerrada y la operación remota del cron.
