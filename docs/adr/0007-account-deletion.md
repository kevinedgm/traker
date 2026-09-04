# ADR-0007: borrado remoto de cuenta y datos

- Estado: Implementada y verificada en local
- Fecha: 2026-09-01
- Alcance: privacidad y ciclo de vida de cuenta

## Contexto

Traker ya permite exportar y borrar la copia local sin tocar Supabase. Eso no
equivale a borrar una cuenta: el usuario de Auth, los datos sincronizados, las
suscripciones push y los datos derivados seguirían existiendo. El frontend no
puede llamar `auth.admin.deleteUser`; esa operación requiere una clave secreta
que nunca debe exponerse al navegador.

Las tablas vigentes con datos por propietario referencian `auth.users(id)` con
`on delete cascade`. Aun así, el borrado debe comprobar el inventario real,
incluidos Storage, Auth y objetos derivados, porque una cascada declarada no es
evidencia suficiente de que la operación terminó completa.

## Decisión

Implementar el borrado como una Edge Function autenticada y de propósito único:

1. El cliente ofrece exportar un respaldo antes de continuar.
2. La persona inicia sesión de nuevo si `last_sign_in_at` supera diez minutos.
3. Un diálogo separado resume el alcance y exige escribir `BORRAR`.
4. La Edge Function valida el JWT con `auth.getUser`; nunca acepta un `user_id`
   enviado por el cliente.
5. La función confirma que la sesión es reciente y que su `session_id` sigue
   presente antes de ejecutar operaciones privilegiadas.
6. Con un cliente server-side y clave secreta elimina primero objetos de
   Storage cuyo propietario sea el usuario, si existen.
7. Ejecuta un hard delete mediante `auth.admin.deleteUser(user.id, false)`.
8. Verifica que el usuario y los conteos owner-scoped quedaron en cero.
9. Sólo después del éxito el cliente cierra la sesión local, borra IndexedDB,
   localStorage, Cache Storage y colas, y vuelve al inicio.

La función devuelve estados sin contenido personal. No registra títulos,
notas, emociones, payloads ni tokens.

## Fallos y atomicidad percibida

- Si falla reautenticación, no se llama al servidor.
- Si falla Storage o Auth, la copia local y la sesión permanecen para poder
  reintentar o exportar.
- Si Auth se elimina pero la respuesta se pierde, un reintento autenticado ya
  no será posible; al detectar sesión inválida el cliente limpia sólo su copia
  local y muestra un resultado verificable, no un error ambiguo.
- Los JWT emitidos antes del borrado pueden seguir siendo criptográficamente
  válidos hasta `exp`. Las operaciones sensibles deben validar `session_id`
  contra `auth.sessions`; el vencimiento JWT remoto deberá permanecer corto.

## Verificación obligatoria

- Usuario A sólo puede eliminar su propia cuenta; nunca recibe un parámetro de
  propietario.
- Usuario B y todos sus conteos permanecen intactos.
- Se cubren datos canónicos, Sync v2, consentimientos, notificaciones, jobs,
  deliveries, cursores y Storage. El rollback legacy vacío fue retirado con
  autorización antes de habilitar el flujo.
- Un fallo previo al hard delete no borra la copia local.
- Después del éxito no quedan refresh tokens y un nuevo login falla.
- Advisors, pruebas de función, pgTAP de cascadas y E2E de UI deben pasar antes
  de habilitar el botón.

## Fuentes técnicas

- Supabase User Management: https://supabase.com/docs/guides/auth/managing-user-data
- Admin deleteUser: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
- Edge Function auth: https://supabase.com/docs/guides/functions/auth
- Cascade deletes: https://supabase.com/docs/guides/database/postgres/cascade-deletes

## Consecuencias

El botón aparece sólo con una sesión de nube activa. “Borrar copia local” sigue
siendo una acción distinta y declara que no elimina Supabase. La Edge Function
`delete-account`, la migración
`20260902044303_account_deletion_and_legacy_cleanup.sql` y la prueba repetible
`npm run test:account-deletion` forman el contrato operativo.

La validación local final cubrió confirmación incorrecta, sesión activa y
reciente, hard delete, login posterior rechazado, conteo A en cero, cuenta B
intacta, limpieza local, accesibilidad móvil y ausencia de errores de consola.
Storage estaba vacío; la función recorre buckets y elimina por `owner_id` antes
de Auth para que futuros objetos no bloqueen la cuenta.

Riesgo residual: si Auth se elimina y la respuesta se pierde por completo, la
copia local puede requerir una recarga para reconocer la sesión inválida. No se
despliega remotamente hasta repetir esta matriz en staging.
