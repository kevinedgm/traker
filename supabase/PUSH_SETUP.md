# Configurar recordatorios en la nube (Web Push)

Pasos para activar las notificaciones que llegan **con la app cerrada**.
Hazlos en orden — el frontend nuevo asume que la migración 003 ya corrió.

Las claves VAPID generadas están en `supabase/.env.vapid` (gitignored).

## 1. Migración SQL (Supabase Dashboard)

Dashboard → SQL Editor → New query → pega y ejecuta
`migrations/003_push_notifications.sql` (las secciones 1–4; la sección 5
del cron viene comentada, va en el paso 4).

## 2. Secrets de la Edge Function

Con el [CLI de Supabase](https://supabase.com/docs/guides/cli) logueado y
el proyecto linkeado (`supabase link --project-ref tuzwecxijdblgihidhyo`):

```bash
# Valores: ver supabase/.env.vapid
supabase secrets set VAPID_PUBLIC_KEY=<público>
supabase secrets set VAPID_PRIVATE_KEY=<privado>

# Inventa un secreto largo para el cron (p. ej. `openssl rand -hex 32`)
supabase secrets set CRON_SECRET=<tu-secreto>
```

(Sin CLI: Dashboard → Edge Functions → Secrets.)

## 3. Desplegar la función

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

`--no-verify-jwt` es necesario: la invoca pg_cron con el `CRON_SECRET`,
no un usuario con JWT.

Prueba manual (debe responder `{"ok":true,...}`):

```bash
curl -s -X POST \
  -H "Authorization: Bearer <tu-CRON_SECRET>" \
  https://tuzwecxijdblgihidhyo.supabase.co/functions/v1/send-reminders
```

## 4. Programar el cron

En el SQL Editor, ejecuta la **sección 5** de
`migrations/003_push_notifications.sql` (descoméntala y sustituye
`<PROJECT-REF>` y `<CRON-SECRET>`).

## 5. Frontend

- **GitHub**: repo → Settings → Secrets and variables → Actions →
  Variables → New: `VITE_VAPID_PUBLIC_KEY` = la clave pública.
- **Local**: ya está en `.env`.
- Haz push a `main` para desplegar.

## 6. Activar en el teléfono

1. Abre la PWA instalada **con sesión iniciada** (Ajustes → Cuenta en la nube).
2. Ajustes → Recordatorios → permiso concedido.
3. Ajustes → Recordatorios → Diagnóstico y prueba → la fila
   "Recordatorios en la nube" debe decir **Conectado**
   (si no, toca el botón de actualizar arriba a la derecha).
4. Ponle a un hábito un recordatorio a 15 min en el futuro, cierra la app
   y espera: la notificación debe llegar con la pantalla bloqueada.

## Cómo decide qué enviar

Cada 10 minutos la función revisa, **en tu zona horaria**:

| Aviso | Condición | Máx. |
|---|---|---|
| Por hábito | `reminder_time` cayó en la ventana, día permitido, sin registro hoy | 1/día/hábito |
| Matutino | `morning_reminder_time`, tienes hábitos activos | 1/día |
| Inactividad | `inactivity_reminder_time` y **cero** registros hoy | 1/día |

El anti-spam vive en la tabla `sent_reminders` (única por usuario, tipo,
referencia y día local).

## Limitaciones conocidas

- Requiere sesión de Supabase en el dispositivo (las suscripciones son por usuario).
- Si revocas el permiso de notificaciones en Android, el endpoint muere;
  la función lo limpia sola y la app se re-suscribe al abrirla de nuevo.
- La zona horaria se toma del último dispositivo que sincronizó ajustes.
