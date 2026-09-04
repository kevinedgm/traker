# Traker — Arquitectura de notificaciones

## Objetivo

Las notificaciones deben ayudar a iniciar, cerrar o regresar. No son un canal de retención. El sistema se considera correcto cuando puede decidir **no enviar**.

## Estado actual

**[Evidencia del proyecto · Alto]**

```text
App abierta
└── scheduler cada 30 s
    ├── recordatorios de hábito
    ├── apertura matutina
    └── inactividad

App cerrada + cuenta/suscripción
└── cron periódico
    └── Edge Function
        ├── lee suscripciones/settings/hábitos
        ├── reclama ledger diario
        └── envía Web Push
```

Fortalezas:

- Solicitud de permiso bajo gesto.
- VAPID y tabla de suscripciones.
- Anti-duplicado diario básico.
- Deep links/payloads básicos y diagnóstico de notificaciones.
- RLS en suscripciones y ledger.

Riesgos:

- **[Evidencia del proyecto · Crítico]** Se reclama el ledger antes de confirmar entrega; fallo de red quema el intento.
- **[Evidencia del proyecto · Alto]** `snooze` en `window.setTimeout` no sobrevive cierre.
- **[Evidencia del proyecto · Alto]** Una acción directa puede perderse si no había ventana abierta.
- **[Evidencia del proyecto · Alto]** No hay cierre nocturno, presupuesto, horas de silencio completas ni privacidad por dispositivo.
- **[Evidencia del proyecto · Alto]** Función de servidor hace lectura global y filtrado, sin cola/paginación robusta.
- **[Evidencia del proyecto · Alto]** Cliente y servidor usan catálogos distintos.
- **[Hipótesis · Alto]** El cron real y secretos desplegados no pudieron verificarse desde el repositorio.

## Principios

1. Consentimiento por propósito, no permiso genérico.
2. Una notificación = una intención.
3. Deep link fiable como contrato; acciones como mejora progresiva.
4. Presupuesto diario y cooldown.
5. Suppression después de cumplimiento.
6. Privacidad de lock screen por dispositivo.
7. Entrega/reintento separados de la decisión de enviar.
8. Sin IA en el camino crítico.
9. Todo push es visible; no usar silent push para sincronización.
10. El usuario puede silenciar hoy, por hábito, por tipo y globalmente.

## Arquitectura propuesta

```text
Eventos locales/sincronizados
        │
        ▼
Notification planner (reglas puras)
├── zona horaria / ventana
├── agenda vigente
├── ya completado
├── sensibilidad / privacidad
├── quiet hours / día silenciado
├── presupuesto / cooldown
└── capability + consentimiento
        │ crea job idempotente
        ▼
notification_jobs
        │ worker reclama con lock/lease
        ▼
notification_deliveries
├── queued → sending → delivered/failed/suppressed/expired
└── retry_count, next_attempt_at, provider response
        │
        ▼
Web Push visible con URL segura
        │
        ▼
notification_interactions (opt-in/minimizado)
```

### Planificador

Entrada: usuario, fecha local, agenda, preferencias, permisos, últimas entregas. Salida: cero o más intenciones, normalmente cero o una.

Tipos MVP:

- `morning_opening`: una apertura agrupada.
- `habit_or_block_reminder`: recordatorio solo si aporta y no está hecho.
- `evening_close`: cierre opcional.
- `return_nudge`: retorno con cooldown largo.

No enviar recordatorio por cada hábito cuando hay agenda cargada. Agrupar: “Tienes 2 mínimos; empieza por uno”.

### Presupuesto

Valores iniciales a validar:

- Máximo 2 pushes/día por defecto: apertura y cierre.
- Un recordatorio operativo puede sustituir apertura, no sumarse automáticamente.
- Máximo 1 nudge de regreso cada 7 días.
- Cooldown 4 horas entre pushes no críticos.
- Cero notificaciones durante quiet hours o “silenciar hoy”.

**[Decisión que requiere validación · Alto]** Aprobar presupuesto, ventanas por defecto y si el recordatorio de hábito puede elevar el máximo a 3 bajo opt-in.

## Web Push e iOS

En iOS/iPadOS, Web Push requiere permiso bajo interacción directa y ha estado disponible para apps web añadidas a Home Screen desde 16.4; se integra con Lock Screen y Focus. La implementación debe usar detección de capacidades, no detección de navegador: [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

En iOS 26 cualquier sitio añadido puede abrir como app web, pero manifest e iconos siguen aportando identidad y comportamiento: [WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

WebKit exige notificación visible por cada push; un handler que no muestra una puede perder la suscripción. Declarative Web Push ofrece una ruta más robusta y compatible hacia una notificación con `navigate`, pero debe tratarse como mejora progresiva y validarse por versión: [WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/).

Acciones/botones no son Baseline y los navegadores limitan cuántas muestran. Por eso el payload siempre incluye un deep link que reproduce la intención dentro de la app; las acciones solo aceleran: [MDN Notification actions](https://developer.mozilla.org/en-US/docs/Web/API/Notification/actions).

### iPhone no instalado

- No solicitar push como si fuera fiable.
- Mostrar guía “Añadir a pantalla de inicio” solo después de que la persona active recordatorios.
- Ofrecer recordatorios dentro de la app y exportación a calendario como alternativa futura.
- No repetir el banner tras rechazo.

## Android y escritorio

- Usar estándares Push/Notifications y feature detection.
- Respetar `Notification.maxActions`.
- No asumir que `delivered` significa visto.
- Probar Chrome/Edge/Firefox y Android instalado/no instalado.
- Deep links deben funcionar aunque el SW se actualice o la app estuviera cerrada.

## Permisos

Flujo recomendado:

1. Explicar beneficio concreto: apertura, cierre o recordatorio de bloque.
2. Persona elige tipos y privacidad.
3. Bajo clic explícito, solicitar permiso del sistema.
4. Si rechaza, guardar estado y no insistir.
5. Probar envío local/servidor y mostrar diagnóstico.

No solicitar permiso en onboarding inicial ni al cargar Hoy.

## Deep links y acciones

URLs propuestas:

- `/today?intent=open`
- `/today?intent=close`
- `/today?intent=log&occurrence=<uuid>`
- `/today?intent=resume&target=<uuid>`
- `/settings/notifications?source=permission`

Requisitos:

- IDs opacos, sin nombres sensibles.
- Validar sesión/propiedad y vigencia.
- Si la ocurrencia ya está registrada, mostrar estado y no duplicar.
- Si no hay cliente, abrir URL; la intención vive en URL o en una cola local persistente, no solo en `postMessage`.
- Acción “Sí” desde push solo si la plataforma la soporta y el usuario habilitó registro directo. Si falla, abre confirmación en la app.

## Reintentos y concurrencia

- `job_key` único por usuario/tipo/objeto/ventana.
- Reclamo con lease y `FOR UPDATE SKIP LOCKED` o RPC equivalente.
- Marcar `delivered` solo después de respuesta aceptada del proveedor.
- Retry exponencial con jitter para 429/5xx/red; máximo y expiración por ventana.
- 404/410 elimina o invalida la suscripción.
- Un log nuevo suprime jobs queued; si ya se entregó, el deep link resuelve idempotentemente.
- Guardar respuesta mínima del proveedor, no payload interpolado sensible.

## Privacidad

Preferencias por dispositivo:

- Mostrar nombre de actividad: sí/no.
- Mostrar recompensa: sí/no.
- Vista lock screen genérica: “Traker tiene algo para hoy”.
- Tipos permitidos.
- Quiet hours y zona horaria.

Servidor:

- `service_role` solo en Edge Function.
- Secrets en Supabase secrets/Vault; no SQL comentado con secreto literal.
- Consultas paginadas y filtradas en DB.
- No interpolar notas, ánimo o contexto.
- Retención corta de deliveries/interactions, definida y borrable.
- La persona puede exportar/borrar preferencias y suscripciones.

## Integración futura con IA

**[Recomendación técnica · Bajo para MVP]** La IA puede proponer una variante de apertura o resumen, nunca decidir sola si enviar ni escribir directamente en datos.

Guardrails:

- Edge/server only; ninguna API key en PWA.
- Respuesta local/catálogo disponible antes de llamar.
- Paquete mínimo: evento, tono permitido, conteos agregados y lista explícita de términos prohibidos. No notas ni contextos sensibles.
- Salida JSON validada: `message`, `functional_label`, `sensitivity`, `template_reason`.
- Timeout corto, circuit breaker y cero reintento dentro de la ventana de push.
- Moderación/reglas locales posteriores.
- `store: false` cuando corresponda y revisión contractual de retención antes de producción.
- El API de Responses permite salida JSON por esquema y controlar si la respuesta se almacena; la integración exacta debe fijarse contra documentación vigente en la fase post-MVP: [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

## Observabilidad responsable

Operacional, no engagement:

- Jobs creados/suprimidos/expirados.
- Éxito y latencia por proveedor/plataforma.
- 404/410 y rotación de suscripciones.
- Duplicados evitados.
- Push tardío después de completar.
- Preferencias de silencio.
- Interacción solo con consentimiento y retención corta.

No usar apertura como KPI primario. La notificación correcta puede ser ignorada porque la persona ya actuó fuera de la app.

## Criterios de aceptación

- Completar suprime recordatorio pendiente.
- Un fallo transitorio reintenta sin duplicar.
- Acción perdida abre intención equivalente por URL.
- Rechazo no vuelve a generar prompt automático.
- iPhone no instalado recibe guía, no promesa falsa.
- Quiet hours y “hoy no” se respetan en servidor.
- Pantalla bloqueada puede ser genérica por dispositivo.
- Catálogo cliente/servidor comparte versión.
- La app funciona completamente sin IA.
- Push real probado en iOS, Android y escritorio antes de piloto.

