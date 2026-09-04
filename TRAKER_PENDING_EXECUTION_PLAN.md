# Traker — Plan de pendientes ejecutable por bloques

Última revisión: 2 de septiembre de 2026.

Este documento es el checklist operativo de lo que todavía falta. Parte del
estado real del repositorio y de la base Supabase local después de aplicar la
Fase 6. No reemplaza las especificaciones de producto; las convierte en un
orden de ejecución verificable.

## Leyenda

- `[x]`: terminado y verificado.
- `[~]`: implementado, pero falta una validación humana o de dispositivo.
- `[ ]`: pendiente.
- `P0`: necesario para cerrar el MVP local con confianza.
- `P1`: necesario antes de considerar un despliegue remoto.
- `P2`: mejora posterior que no bloquea el uso personal local.
- `P3`: post-MVP.

## Punto de partida confirmado

- [x] Supabase local funciona en Docker.
- [x] El contrato canónico de hábitos, logs, agendas, metas, check-ins,
  recompensas, notificaciones y Sync v2 existe.
- [x] La Fase 6 está aplicada en la base local y cuenta con backup, checksum,
  rollback probado y archivo privado de recuperación.
- [x] El runtime ya no usa `habit_entries`, `linked_goal_id` ni
  `reminder_days`.
- [x] Sync v2 pasó el piloto local, tombstone/restore, conflicto explícito y
  convergencia entre dos perfiles lógicos.
- [x] La navegación móvil y el lock fueron corregidos y probados visualmente.
- [x] La validación acumulada quedó en 339 pruebas Vitest, 205 aserciones
  pgTAP, 36 escenarios E2E, build PWA y advisors de Supabase sin alertas.
- [~] Responsive fue recorrido en Chrome a 320, 375, 430, 768, 1024, 1280 y
  1440 px; faltan dispositivos físicos y lector de pantalla.
- [x] Existe una suite E2E repetible para los 24 escenarios obligatorios y nueve
  contratos técnicos adicionales de resiliencia, accesibilidad, responsive y
  borrado de cuenta.
- [ ] No se ha desplegado ni certificado el producto en un entorno remoto.

## Orden de ejecución

| Bloque | Prioridad | Resultado | Depende de |
| --- | --- | --- | --- |
| 0 | P0 | Baseline honesto y cliente actualizado tras F6 | Nada |
| 1 | P0 | Retención segura del ledger y cierre técnico de F6 | Bloque 0 |
| 2 | P0 | Recompensas sin rueda ni código cyber obsoleto | Bloque 0 |
| 3 | P0 | Agenda flexible, grupos alternables e hitos utilizables | Bloques 1–2 |
| 4 | P0 | Registro y copy alineados al producto | Bloques 2–3 |
| 5 | P0 | Suite E2E de los 24 escenarios y resiliencia offline | Bloques 3–4 |
| 6 | P1 | Accesibilidad, responsive y performance certificados | Bloque 5 |
| 7 | P1 | Web Push real certificado en dispositivos | Bloques 4–6 |
| 8 | P1 | Privacidad, borrado remoto, métricas y observabilidad | Bloques 5–7 |
| 9 | P1 | Ensayo y despliegue remoto controlado | Bloques 1–8 |
| 10 | P2 | Pulido visual, activos y movimiento final | Bloque 6 |
| 11 | P3 | Piloto de IA opcional | MVP validado |

Los bloques 1 y 2 pueden ejecutarse uno después del otro sin esperar trabajo
de dispositivo. A partir del bloque 3 conviene mantener el orden para evitar
certificar flujos que todavía van a cambiar.

---

## Bloque 0 — Baseline y cierre documental posterior a F6

**Objetivo:** empezar desde un estado reproducible y evitar que documentos o
clientes antiguos sigan describiendo/consumiendo el contrato eliminado.

### Checklist

- [x] La pestaña local fue recargada después de F6 y la build PWA vigente se
  sirvió correctamente bajo `/traker/`: bundle, manifest y `sw.js` responden
  con sus tipos correctos; el Service Worker contiene `skipWaiting`,
  `clients.claim` y 101 entradas de precache. Chrome solicitó el Service Worker
  y todas las entradas bajo la base de producción.
- [x] Smoke funcional autenticado en Chrome: Hoy, Hábitos, Recompensas,
  Historial, Ajustes y Sync v2 abren sin errores de consola y conservan los
  datos locales (2 hábitos y 2 logs). Rumbo no aparece porque su feature flag
  está apagado. La cuenta local quedó conectada mediante enlace mágico y el
  usuario confirmó visualmente el estado final `Convergencia lista`.
- [x] Sync v2 muestra el endpoint local conectado, `0` huecos y `0`
  operaciones por resolver. Las 2
  operaciones rechazadas eran claims antiguos ya representados por otra id en
  la copia canónica. Se corrigió la conciliación para actualizar primero el
  snapshot canónico bajo RLS y archivar sólo equivalencias comprobadas.
- [x] Sustituir el lector heredado eliminado por F6: la migración
  `20260831045854_canonical_sync_v2_quality_report.sql` añade un RPC canónico,
  content-free, `security invoker`, disponible sólo para `authenticated`; no
  reintroduce `habit_entries` ni las funciones de backfill retiradas.
- [x] Verificar los conteos canónicos y el archivo privado
  `traker_phase6_rollback` antes de su retiro. El esquema quedó vacío tras las
  pruebas y se eliminó con autorización explícita; la base final conserva cero
  cuentas y cero filas owner-scoped de prueba.
- [x] Mover la documentación histórica a
  `docs/archive/2026-08-30/`, conservando por separado proyecto, fases, ADR y
  especificaciones de páginas.
- [x] Mantener los estados históricos de
  `docs/archive/2026-08-30/project/TRAKER_IMPLEMENTATION_PLAN.md` y
  `docs/archive/2026-08-30/project/TRAKER_CURRENT_STATE.md` como evidencia del
  momento en que fueron escritos; este documento es la fuente operativa actual.
- [x] Actualizar `supabase/PUSH_SETUP.md`: ahora describe suscripciones,
  preferencias, jobs, leases, deliveries, reintentos, secretos y validación
  física del contrato vigente.
- [x] Registrar que el backup F6 es local, ignorado por Git y no sustituye un
  backup remoto. El archivo de 418 KiB conserva SHA-256
  `70cbaeee5cd11b826f6d2019f6013942373641b68a1d916f52b86e04011303dc`.
- [x] Guardar un inventario del árbol sucio; no se descartaron cambios del
  usuario ni se creó commit.

### Validación

```bash
npm test
npm run build
npx supabase test db --local
npx supabase db advisors --local --type all --level warn --fail-on error
git diff --check
```

### Criterio de cierre

- [x] Código, navegador, base y documentación coinciden en que F6 está
  aplicada: PWA actualizada, sesión local conectada, reporte canónico con `0`
  huecos y Sync v2 en `Convergencia lista`.
- [x] El runtime y el worker no contienen lectores/escritores de
  `habit_entries`, `linked_goal_id` ni `reminder_days`.
- [x] La suite base sigue verde: 41 archivos/231 pruebas Vitest, 5 archivos/110
  aserciones pgTAP, build PWA, advisors y `git diff --check` aprobados. pgTAP se
  ejecutó mediante el fallback transaccional porque Docker Desktop todavía no
  comparte `supabase/tests` con contenedores efímeros.

---

## Bloque 1 — Retención del ledger y cierre técnico de F6

**Objetivo:** impedir crecimiento indefinido de `traker_sync_operations` sin
romper idempotencia, auditoría ni el regreso de un dispositivo antiguo.

### Política aplicada

- Operaciones `pending`, `conflict` y `rejected`: no se eliminan
  automáticamente mientras no exista una resolución explícita.
- Operaciones terminales `applied` y `duplicate`: conservar por 180 días.
- Una operación terminal sólo es elegible si todos los dispositivos activos
  pasaron su posición. Un dispositivo se considera activo si su cursor se
  actualizó en los últimos 90 días.
- Aplicar 30 días adicionales de margen después del cursor mínimo.
- Conservar al menos la última operación de cada entidad y su tombstone activo.
- Un dispositivo ausente más de 90 días vuelve mediante rehidratación completa,
  no suponiendo que el ledger conserva toda su historia.
- En el uso personal local no se ejecutará compactación automática mientras el
  ledger tenga menos de 10 000 filas. La política sí queda implementada y
  probada; la ejecución será manual/dry-run.

### Checklist

- [x] Crear ADR de retención con estados elegibles, ventanas y recuperación de
  dispositivos inactivos: `docs/adr/0006-sync-ledger-retention.md`.
- [x] Auditar las 16 operaciones actuales y cuatro cursores sin leer payloads:
  12 `applied`, 1 `duplicate`, 1 `conflict` y 2 `rejected`.
- [x] Diseñar un `dry-run` que devuelve sólo conteos y límites. En la base real
  informó 16 filas, 0 elegibles, 4 dispositivos activos y ejecución bloqueada
  por debajo de 10 000 filas.
- [x] Implementar la compactación en `traker_private`, sin `USAGE` ni `EXECUTE`
  para `PUBLIC`, `anon`, `authenticated` o `service_role`.
- [x] Proteger la última operación por entidad, el tombstone canónico activo,
  estados no terminales y operaciones que no superen cursor seguro más margen.
- [x] Añadir rehidratación completa: un cursor compactado recibe
  `rehydrationRequired`, descarga el snapshot canónico bajo RLS y sólo entonces
  confirma el nuevo high-water mark.
- [x] Crear migración y down migration separadas de F6:
  `20260831051809_sync_ledger_retention.sql` y su `.down.sql`.
- [x] Probar ledger vacío, menos de 10 000 filas, dos dispositivos activos, uno
  inactivo, margen de 30 días, conflicto, pending, rejected, duplicate antiguo,
  última operación, tombstone y rehidratación.
- [x] Ejecutar advisors, 6 archivos/145 aserciones pgTAP, rollback aislado y
  comparación final: los 16 registros reales permanecieron intactos.
- [x] Resolver la caducidad de `traker_phase6_rollback`: al confirmarse que todo
  era prueba, se comprobó vacío y se retiró mediante migración; el down sólo
  recrea el namespace privado, nunca datos sintéticos.

### Regla Supabase

Antes de cada operación CLI se revisó `npx supabase <comando> --help`. La
migración se aplicó primero en local y el rollback se probó dentro de una sola
transacción que terminó en `ROLLBACK`. Nunca se aplica una compactación
destructiva sin `dry-run`, backup y conteos de salida.

### Criterio de cierre

- [x] La política queda documentada, probada y sin acceso de mantenimiento
  desde el cliente; sólo los RPC owner-scoped necesarios siguen expuestos.
- [x] El piloto sigue convergiendo después de compactar datos de prueba: pgTAP
  valida el regreso del dispositivo y Vitest conserva el cursor hasta completar
  el snapshot.
- [x] El checklist de F6 queda completamente en `[x]`: 41 archivos/233 pruebas
  Vitest, 6 archivos/145 aserciones pgTAP, build PWA de 101 entradas, advisors
  sin hallazgos y `git diff --check` aprobados.

---

## Bloque 2 — Retiro de rueda y código visual obsoleto

**Objetivo:** dejar Recompensas como bóveda de premios desbloqueados y elección
consciente, sin azar, apertura automática ni movimiento distractor.

### Checklist

- [x] Retirar `RewardWheel.vue`, `wheel.js`, su prueba y
  `useRewardWheelGate.js`.
- [x] Eliminar de `RewardsPage.vue` el import, estado, botón “Que la rueda
  elija” y montaje del modal.
- [x] Confirmar que una recompensa desbloqueada sólo aparece en la bóveda y se
  usa mediante una acción explícita.
- [x] Mantener creación, edición, pausa, borrado, claims, historial y sync.
- [x] Añadir regresiones de: desbloqueo sin modal, uso explícito, idempotencia,
  recompensa con varias fuentes y fuente eliminada.
- [x] Inventariar y retirar clases/tokens cyber o neon sin consumidores; no
  eliminar aliases Aurora que todavía protejan compatibilidad visual.
- [x] Revisar movimiento de celebraciones con `prefers-reduced-motion`.
- [x] Ejecutar búsqueda final de `RewardWheel`, `rewardWheel`, `cyber` y código
  muerto relacionado.

### Criterio de cierre

- [x] No queda rueda en código, copy, pruebas ni almacenamiento. La migración
  local v2 elimina las llaves heredadas `*.shownOn.*` sin tocar datos vigentes.
- [x] Las recompensas desbloqueadas no vencen y nunca se consumen solas.
- [x] Sync de reglas y claims sigue pasando.

### Evidencia de cierre

- [x] Detector Impeccable sin hallazgos y búsqueda final sin referencias a
  `RewardWheel`, `rewardWheel`, `cyber`, `wheel`, `color-neon` o `neon-glow`.
- [x] Vitest: 41 archivos y 236 pruebas aprobadas; incluye canje explícito,
  persistencia, idempotencia, reglas multifuente y limpieza de storage legado.
- [x] Build PWA aprobada con 101 entradas de precache; `git diff --check`
  aprobado.
- [x] Seis contratos pgTAP: 145 aserciones aprobadas; advisors local sin
  hallazgos.
- [~] QA visual de esta iteración en Chrome: el control ya funciona y confirmó
  que el lock cubre el viewport sin superposición; la vista posterior al lock
  requiere que el propietario desbloquee su sesión local. La matriz sintética
  de recompensas sigue cubierta por E2E.

---

## Bloque 3 — Contratos de producto que el modelo ya soporta

**Objetivo:** completar las funciones del MVP que existen en la base pero aún
no tienen un flujo de usuario completo.

### 3A. Frecuencias de hábitos

- [x] Extender el dominio; hoy normaliza todo a `weekdays` aunque la base
  soporta `times_per_week`, `times_per_month`, `every_n_days` y `window`.
- [x] Diseñar UI progresiva: días específicos, N por semana y ventana flexible
  como mínimo del MVP; mensual/cada N días puede quedar P2 si aumenta el scope.
- [x] Actualizar create/edit, agenda de Hoy, próximos pasos y detalle.
- [x] Sincronizar todos los campos canónicos sin reintroducir columnas F6.
- [x] Probar timezone, cambio de zona, DST, reprogramación y offline.

**Evidencia 3A:** el cliente conserva los cinco tipos canónicos; las cuotas
semanales/mensuales se reinician sin deuda, la reprogramación conserva logs y
la cola offline conserva el schedule completo. La migración reversible
`20260831055708_harden_habit_schedule_payloads.sql` endurece payloads por tipo y
sus 8 aserciones pgTAP pasan. Detector Impeccable sin hallazgos. La lista de
hábitos se verificó en Chrome; el modal quedó cubierto por el bloqueo local y
su inspección visual desbloqueada sigue pendiente. Cierre automatizado: 42
archivos/250 pruebas Vitest, 7 archivos/153 aserciones pgTAP, build PWA con 101
entradas, advisors sin hallazgos, historial local alineado y `git diff --check`
aprobado.

### 3B. Grupos alternables

- [x] Crear repositorio/store para `traker_flexible_groups` y miembros.
- [x] Permitir “elige N de estas actividades” sin mostrar todas como deuda.
- [x] Evitar duplicar un hábito ligado a varias metas o grupos en Hoy.
- [x] Integrar grupos en recompensas y en el resumen del día.
- [x] Añadir sync, tombstone, exportación, importación y borrado local.

**Evidencia 3B:** el modelo canónico existente resultó suficiente: grupos
versionados, miembros con baja lógica, RLS, grants e índices. La app añade
dominio, store local persistente, administración progresiva y agenda única de
opciones. Un hábito compartido aparece una sola vez y puede acreditar todos
sus grupos; esas opciones se excluyen del mínimo diario y de recordatorios
individuales. Los cierres conservan el avance del periodo, y las recompensas
aceptan `flex_group` como fuente. Sync offline, pull/push, tombstones,
exportación/importación, borrado local y backfill IndexedDB quedan cubiertos.
Cierre automatizado: 45 archivos/261 pruebas Vitest, 7 archivos/153 aserciones
pgTAP, build PWA aprobado, detector Impeccable sin hallazgos, RLS confirmado en
ambas tablas, schema lint y advisors sin hallazgos e historial local alineado.

### 3C. Hitos de metas

- [x] Crear UI para alta, edición, orden, estado y evidencia de hitos.
- [x] Completar una meta por hito/definición, no por porcentaje artificial.
- [x] Mostrar evidencia y línea de progreso en el detalle y el historial.
- [x] Conservar reformulación, pausa, cierre consciente y relación N:M con
  hábitos.
- [x] Integrar hitos como fuente real de recompensas.

**Evidencia 3C:** la app usa el store IndexedDB `goalStages` como repositorio
offline de hitos versionados, con alta, edición, orden accesible, estados,
tombstone y evidencia obligatoria al completar. El cierre de meta queda
bloqueado mientras exista una acción abierta o un hito vigente pendiente; el
detalle y la trayectoria muestran conteo `X de Y`, línea de avance y evidencia,
sin convertir el resultado en una calificación porcentual. Pausa,
reformulación y vínculos N:M hábito-meta se conservan. Las recompensas nuevas
usan fuentes `milestone`, se sincronizan con la relación canónica y se
desbloquean una sola vez por hito. La migración
`20260831142345_sync_goal_milestones.sql` añade un RPC de outbox con
consentimiento, RLS, idempotencia y conflicto optimista. Cierre automatizado:
46 archivos/268 pruebas Vitest, 8 archivos/162 aserciones pgTAP, build PWA con
103 entradas, detector Impeccable sin hallazgos, schema lint y advisors sin
hallazgos, RLS/índice/permisos confirmados e historial local alineado. La
inspección visual autenticada del panel queda pendiente; este cierre es
estático y local.

### Criterio de cierre

- [x] Funcionan offline: frecuencia semanal, grupo alternable e hito.
- [x] Hoy muestra una sola ocurrencia explicable y no crea deuda vencida.
- [x] Los nuevos stores forman parte de sync, exportación y borrado.

---

## Bloque 4 — Registro, comunicación y frase diaria

**Objetivo:** alinear la interacción diaria y el motor de mensajes con el brief,
sin volver evaluativo el registro.

### 4A. Registro

- [x] Resolver la decisión pendiente entre los cinco niveles heredados y el
  flujo principal “Sí / A medias / No”.
- [x] Recomendación: usar tres decisiones principales; ofrecer “versión mínima”
  y “descanso consciente” como contexto secundario, no como dos calificaciones
  adicionales.
- [x] Mapear de forma reversible UI → `status`, `minimum_used`, contexto y nivel
  legado de presentación.
- [x] Mantener nota, emoción y motivo totalmente opcionales.
- [x] Probar guardado en 1–2 toques y registro negativo sin explicación.

**Evidencia 4A:** el registro principal usa tres decisiones: “Sí”, “A medias”
y “No”. “Usé mi versión mínima” sólo aparece como contexto de “A medias”, y
“Fue un descanso consciente” sólo como contexto de “No”; emoción, energía y
nota permanecen cerradas bajo divulgación progresiva. `status` y
`minimum_used` son la fuente canónica y el nivel 0–4 queda como proyección
legada reversible. El modal, el detalle, la fila rápida, las notificaciones,
el tablero de progreso, sync directo y el piloto V2 comparten el contrato sin
borrar contexto previo. El esquema existente de `traker_habit_logs` ya admite
los cuatro estados canónicos, `minimum_used` y `context_codes`, por lo que no
se creó una migración. Cierre automatizado: 46 archivos/274 pruebas Vitest, 8
archivos/162 aserciones pgTAP, build PWA con 104 entradas, detector Impeccable
sin hallazgos, schema lint y advisors sin hallazgos y `git diff --check`
aprobado. La inspección visual autenticada del flujo queda pendiente; este
cierre es estático y local.

### 4B. Motor de mensajes

- [x] Añadir eventos faltantes: parcial, pausa, retorno, meta cerrada,
  reformulación, sesión completada, resumen nocturno, error de sync y error
  genérico.
- [x] Añadir categorías sensibles faltantes: familia, salud, finanzas y trabajo.
- [x] Corregir el fallback: si el usuario desactiva todas las frases de un pool,
  no volver a mostrar una frase desactivada.
- [x] Definir el significado de “favorita”: aumentar selección de forma limitada
  o cambiar la etiqueta a “guardada”; añadir prueba estadística determinista.
- [x] Compartir el catálogo versionado entre frontend y worker para evitar copy
  divergente.
- [x] Añadir feedback “me sirvió / no me sirvió” sin convertirlo en analítica
  remota sin consentimiento.
- [x] Probar anti-repetición también en notificaciones.

**Evidencia 4B:** el catálogo cubre los nuevos eventos funcionales y fuerza
fallbacks neutrales para errores, además de degradar automáticamente familia,
salud, finanzas, trabajo, medicación, nutrición y sueño. Deshabilitar todo un
pool usa un mensaje funcional externo al pool; ninguna frase ocultada revive.
Las favoritas tienen peso 2×, nunca exclusividad, con prueba determinista. El
cliente y la Edge Function comparten `COPY_CATALOG_VERSION`, snapshot/hash y
el catálogo de notificaciones desde `_shared`; se eliminó la copia manual
divergente del worker. La anti-repetición considera los últimos ocho mensajes
globales y tres del mismo evento en cliente y notificaciones. “Me sirvió / No
me sirvió” guarda sólo ID, veredicto y fecha en el dispositivo, sin texto ni
envío remoto. Los mensajes ya se consumen en parcialidad, pausa/retorno de
hábito y meta, reformulación, cierre de meta, sesión, sync y error genérico.
Cierre automatizado: 47 archivos/289 pruebas Vitest, 8 archivos/162
aserciones pgTAP, build PWA con 105 entradas, Edge Function compilada y
respondida en runtime local Deno 2.1, detector Impeccable sin hallazgos,
schema lint y advisors sin hallazgos y `git diff --check` aprobado. No fue
necesaria una migración. La revisión humana del tono alto y de las categorías
sensibles continúa como puerta editorial, no como decisión automática.

### 4C. Frase diaria

- [x] Separar mensaje personal, carrilla contextual y cita atribuida.
- [x] Usar sólo citas con autor/fuente verificable; si no hay fuente, mostrarla
  como mensaje de Traker y no como cita.
- [x] Guardar fuente y versión del catálogo, no consultar una API para el MVP.
- [ ] Someter tono neutral, confianza y carrilla a aprobación humana.

**Evidencia 4C:** `TodayOpening` presenta el mensaje público, su fuente y el
motivo personal como regiones distintas; el motivo se conserva sólo en la
interfaz y no entra al payload de pantalla bloqueada. Dashboard y worker usan
la misma selección determinista por fecha desde `_shared/daily-opening.js`,
con versión y snapshot editorial compartidos. El catálogo MVP de citas queda
vacío deliberadamente: el validador exige texto, autor, obra, URL de fuente,
idioma, tema y condición de uso, y cualquier turno reservado a una cita sin
entrada verificada vuelve a un mensaje identificado como “Mensaje de Traker”.
No hay API externa ni atribuciones generadas. La aprobación humana de los tres
niveles de tono sigue abierta como puerta editorial; hasta entonces la
apertura diaria usa sólo el nivel neutral. Cierre automatizado: 49 archivos/
298 pruebas Vitest, 8 archivos/162 aserciones pgTAP, build PWA con 105
entradas, Edge Function compilada y respondida en runtime local compatible con
Deno 2.1, detector Impeccable sin hallazgos, schema lint y advisors sin
hallazgos y `git diff --check` aprobado. La suite completa también expuso una
comparación dependiente del reloj en cierres diarios; la convergencia ahora
prioriza `version` y conserva la nota privada. La revisión visual autenticada
en 375 px queda para la infraestructura E2E del bloque 5.

### Criterio de cierre

- [x] Cada estado funcional tiene copy neutral comprensible sin humor.
- [x] Los dominios sensibles nunca reciben carrilla fuerte.
- [x] Ninguna frase desactivada reaparece por fallback.

---

## Bloque 5 — E2E de los 24 escenarios obligatorios

**Objetivo:** transformar la validación dispersa en una suite reproducible con
Puppeteer, que ya está instalado.

### Infraestructura E2E

- [x] Crear `e2e/`, runner, fixtures y scripts `test:e2e` y
  `test:e2e:headed`.
- [x] Levantar Vite y Supabase local de forma aislada; usar usuarios temporales.
- [x] Limpiar siempre usuarios, IndexedDB, localStorage, Cache Storage y SW.
- [x] Capturar errores de consola, solicitudes fallidas y overflow horizontal.
- [x] Generar un reporte sin nombres, notas, emociones ni payloads sensibles.

### Matriz funcional

- [x] 01. Inicio del día con tres metas.
- [x] 02. Día con demasiados hábitos; se priorizan hasta tres esenciales.
- [x] 03. Un hábito ligado a dos metas aparece una vez.
- [x] 04. Bloque de actividades alternables.
- [x] 05. Registro exitoso del gimnasio.
- [x] 06. Registro parcial.
- [x] 07. Registro negativo sin explicar motivo.
- [x] 08. Registro negativo con contexto familiar y copy sensible.
- [x] 09. Día con energía baja.
- [x] 10. Día con todos los mínimos cumplidos.
- [x] 11. Día sin actividades cumplidas, sin castigo ni deuda.
- [x] 12. Regreso después de dos semanas.
- [x] 13. Notificación ignorada.
- [x] 14. Notificación suprimida después de completar.
- [x] 15. Pérdida y recuperación de conexión.
- [x] 16. IA no disponible; hoy no debe afectar ninguna función.
- [x] 17. Permiso de notificaciones rechazado.
- [x] 18. PWA no instalada en iPhone; explicación honesta.
- [x] 19. Recompensa vinculada a varios hábitos.
- [x] 20. Meta completada mediante hito, no porcentaje.
- [x] 21. Meta reformulada con trazabilidad.
- [x] 22. Meta cerrada conscientemente.
- [x] 23. Usuario que no registra ánimo.
- [x] 24. Dos dispositivos convergen o muestran conflicto explícito.

**Evidencia final del bloque 5 — escenarios 01–24:** `npm run test:e2e`
ejecuta Chromium headless a 375×812 contra un Vite dedicado y Supabase local.
La corrida crea y autentica un usuario sintético temporal, confirma su borrado
y aísla además cada caso en un BrowserContext nuevo con limpieza explícita de
almacenamientos, cachés y service workers. Los dieciocho escenarios pasan sin
errores de consola, excepciones de página, solicitudes fallidas ni overflow
horizontal. El primer ciclo descubrió que “Hoy no hay mínimos programados”
ocultaba una meta accionable; `DashboardPage` ahora sólo prioriza el cierre si
existe un cierre guardado o al menos un mínimo programado. La repetición quedó
18/18 aprobada. Los escenarios 05–09 verifican el contrato persistido de “Sí”,
“A medias” y “No”, que el registro negativo no exige emoción, energía, nota ni
código de contexto, que la categoría familiar degrada el tono alto a
`trusted`, y que un check-in puede guardar únicamente energía baja con alcance
local. Los escenarios 10–12 confirman que una versión mínima cuenta para la
suficiencia del día, que cero actividades puede cerrarse con estado `quiet`
sin castigo ni deuda, y que volver después de dos semanas conserva el historial
sin rachas perdidas ni recuperación obligatoria. El reporte JSON registra sólo
códigos y métricas técnicas. Los escenarios 13–18 comprueban que ignorar un
aviso no infiere desinterés y activa cooldown, que un mínimo ya registrado
suprime el aviso posterior, que una operación offline entra una sola vez a la
cola y converge al reconectar con una sesión temporal, y que la ausencia de IA
no participa en el flujo principal. El permiso rechazado no se vuelve a pedir
automáticamente y el diagnóstico ofrece recuperación textual; la condición de
iPhone sin instalación se detecta por capacidad y explica “Añadir a pantalla de
inicio” sin mostrar instrucciones de Android. `AppShell` incorpora además un
estado offline no bloqueante. Los artefactos están ignorados por Git y las
capturas de fallos resueltos se eliminan en la siguiente corrida aprobada.
Una consulta posterior sobre `auth.users` confirmó cero cuentas con el prefijo
temporal del runner. Los escenarios 19–23 comprueban una regla determinista de
recompensa 2-de-3 con fuentes visibles y claim explícito; el cierre de meta sólo
se habilita después de guardar evidencia del hito y exige confirmar la
definición de terminado; la reformulación muestra antes/después y conserva el
enlace entre versiones; el cierre consciente guarda motivo y sucesora
opcionales aun cuando había una acción abierta; y “Omitir siempre” persiste la
preferencia sin impedir cerrar el día. La repetición acumulada quedó 23/23
aprobada a 375×812. El escenario 24 usa dos BrowserContext independientes con
la misma cuenta temporal: replica la versión inicial, provoca una edición
concurrente, recibe `version_mismatch`, presenta “1 en conflicto” y permite
elegir explícitamente “Usar copia de Supabase”. Después de resolver, ambas
copias visibles y la nube convergen en el mismo nombre y versión. La repetición
final quedó 24/24 aprobada, sin errores de consola, solicitudes fallidas ni
overflow horizontal. La suite base permanece verde con 49 archivos/303 pruebas
Vitest y build PWA de 105 entradas. El detector Impeccable señaló un borde
lateral demasiado enfático en la nueva advertencia; se sustituyó por un
contorno discreto. La migración local
`20260901060000_goal_closure_and_checkin_preference.sql` conserva motivo,
sucesora y preferencia de check-in en Supabase; 170 aserciones pgTAP pasaron y
`supabase db advisors --local` no reportó hallazgos. El reporte final contiene
26 resultados técnicos y una consulta posterior confirmó cero cuentas E2E
temporales en `auth.users`.

### Resiliencia adicional

- [x] Restaurar offline, recargar y reconectar sin duplicar operación.
- [x] Probar 5xx, 429, petición abortada y respuesta lenta.
- [x] Probar reloj incorrecto, cambio de timezone y DST.
- [x] Probar cliente con caché antigua después de una migración de contrato.
- [x] Probar exportar → borrar local → importar → comparar datos.

**Evidencia de resiliencia — escenarios 25–27 y matriz de transporte:** la cola heredada y la outbox
v2 conservan un único `operationId` al registrar offline, recargar la
aplicación y reconectar; el listener se instala al montar la app, de modo que
no requiere una mutación nueva después de la recarga. Supabase recibe un solo
registro canónico. El transporte Supabase aborta respuestas que superan 15 s
y la cola durable reintenta 429, 5xx, abortos, timeout y fallos de red con
esperas de 1, 5, 15 y 60 s; después conserva la operación sin crear un ciclo
infinito. Los errores de autenticación o validación no se reintentan a ciegas.
La convergencia compara primero la versión canónica y usa la hora únicamente
como desempate, por lo que un reloj local adelantado no bloquea una versión
superior; las pruebas de fecha cubren además cambio de zona, borde UTC y DST.
El escenario 27 simula un cliente con caché antigua abriendo esquema v99: el
arranque se detiene antes de montar Pinia, conserva metadatos y campos futuros
y muestra una acción accesible para actualizar Traker. Ajustes permite importar
el JSON exportado, valida esquema,
base, stores, key paths e índices en bases temporales antes de sustituir la
copia local, conserva la sesión y nunca importa PIN ni tokens. El ciclo visible
exportar → borrar copia local → crear PIN nuevo → importar → crear PIN nuevo
restaura hábitos, metas, acciones y preferencias sin tocar Supabase. La corrida
acumulada de ese corte quedó 30/30, 52 archivos/325 pruebas Vitest, build PWA de
103 entradas, nueve archivos/170 aserciones pgTAP, detector Impeccable sin
hallazgos, advisors sin hallazgos y `git diff --check` aprobado. Se eliminaron
seis cuentas sintéticas dejadas exclusivamente por diagnósticos interrumpidos;
la comprobación final quedó en cero.

### Criterio de cierre

- [x] Los 24 escenarios tienen prueba o evidencia manual explícita.
- [x] Ninguna prueba deja datos temporales en la base.
- [x] Un fallo genera evidencia accionable y no filtra contenido personal.

---

## Bloque 6 — Accesibilidad, responsive y performance

**Objetivo:** cerrar las puertas físicas que siguen diferidas y establecer un
presupuesto medible.

### Accesibilidad

- [x] Automatizar axe o equivalente en rutas principales y modales.
- [x] Probar teclado completo: navegación, sheets, diálogos, formularios,
  recompensas, sesión de meta y lock.
- [ ] Probar VoiceOver en iPhone/macOS y TalkBack en Android; NVDA es opcional.
- [ ] Activar físicamente movimiento reducido y confirmar feedback estático.
- [~] Probar zoom/reflow a 200 % y 400 %; la equivalencia de viewport pasa,
  falta confirmar el zoom nativo con tecnología de asistencia física.
- [x] Corregir `aria-describedby` y anuncio de errores dinámicos en inputs.
- [x] Completar el patrón de teclado de los elementos con `role="menu"` o usar
  controles nativos más simples.
- [~] Confirmar contraste, texto mínimo legible y estados no dependientes sólo
  del color.

### Responsive

- [x] Automatizar capturas a 320, 375, 430, 768, 1024, 1280 y 1440 px.
- [~] Probar alturas cortas, teclado virtual, safe areas y orientación; las
  alturas de 375–540 px y landscape pasan, falta teclado/safe area físicos.
- [~] Validar móvil físico, tablet y escritorio con datos vacíos y abundantes;
  la emulación automatizada pasa, faltan dispositivos reales.
- [x] Confirmar navegación inferior hasta 767 px y rail desde 768 px.

### Performance/PWA

- [~] Medir LCP, INP y CLS en navegador y PWA instalada con throttling móvil;
  el build web está medido, falta repetirlo como PWA instalada física.
- [x] Definir presupuesto de bundle y revisar la división del cliente Supabase.
- [x] Medir listas largas, memoria de IndexedDB y tiempo de rehidratación.
- [x] Actualizar manifest: descripción de producto, colores Aurora, shortcuts y
  revisar si `orientation: portrait` todavía es deseable.
- [~] Verificar actualización del SW, instalación, modo offline y recuperación
  tras una versión incompatible; registro, control, deep route offline y gate
  incompatible pasan, falta actualización/instalación en dispositivo físico.

**Evidencia automatizada parcial del bloque 6 — escenarios 28–32:** axe-core
recorre Inicio, el diálogo de registro, Ajustes, Progreso, Recompensas y el
formulario de recompensa con reglas WCAG 2 A/AA, 2.1 AA y 2.2 AA; no reporta
violaciones. El escenario 30 desbloquea el PIN, abre ayuda, navega, registra un
hábito y abre/cierra Recompensas usando sólo Tab, Shift+Tab, Enter y Escape;
confirma foco inicial, contención y retorno al disparador. La prueba descubrió
y corrigió que los modales inicialmente cerrados no activaban Escape ni la
trampa de foco al abrirse después. Los inputs Aurora/Base y los errores de
creación de meta enlazan hints y mensajes dinámicos mediante
`aria-describedby`, `aria-errormessage`, `aria-invalid` y `role="alert"`. El
menú de acciones implementa flechas, Home, End, Tab y Escape; la ayuda usa un
panel nativo en orden Tab en vez de declarar un menú incompleto. La matriz
responsive genera capturas a 320, 375, 430, 768, 1024,
1280 y 1440 px, comprueba overflow horizontal y confirma bottom nav por debajo
de 768 px y rail desde 768 px. La inspección visual de los extremos encontró y
cerró una colisión entre la mascota y “Abrir progreso” a 320 px. El presupuesto
reproducible `npm run test:bundle` limita el mayor chunk JS a 215 KiB, JS total
a 850 KiB/285 KiB gzip y CSS a 250 KiB/55 KiB gzip; la línea base aprobada es
202.2 KiB para el mayor chunk, 813.5/267.6 KiB de JS y 233.1/47.9 KiB de CSS.
El cliente Supabase permanece aislado en un chunk de 200.5 KiB (51.6 KiB gzip).
`npm audit` confirmó cero vulnerabilidades tanto de producción como de tooling.
El escenario 31 completa con teclado el recorrido Rumbo → detalle → sesión →
cierre → resultado → formulario; valida etiqueta de nota, foco inicial,
Escape, retorno de foco y errores enlazados. El escenario 32 cubre viewports
equivalentes a reflow 200/400 %, alturas de 375–540 px, landscape y una acción
de diálogo alcanzable con 420 px. El verificador `npm run test:pwa` abre el
build de producción con base `/traker/`, comprueba manifiesto, control del
Service Worker y deep route `/goals` offline. Bajo red móvil simulada y CPU 4×
midió LCP 1,648 ms, INP 56 ms y CLS 0.016. Con 1,000 hábitos y 500 metas en
IndexedDB hidrató en 1,021 ms, usó 21 MiB de heap y mantuvo sólo tres hábitos
visibles. El manifiesto ya describe hábitos/metas/continuidad, ofrece shortcuts
Hoy/Rumbo/Hábitos y no fuerza orientación vertical. Quedan pendientes lectores,
movimiento reducido, zoom/teclado/safe areas y PWA instalada en dispositivos
físicos; no se consideran aprobados por emulación.

### Criterio de cierre

- [~] Cero defectos críticos de teclado/lector/contraste; teclado y axe pasan,
  lector y contraste físico siguen pendientes.
- [x] Cero overflow horizontal en la matriz.
- [~] Existe un reporte de performance con presupuesto y regresiones.

---

## Bloque 7 — Notificaciones Web Push en dispositivos reales

**Objetivo:** demostrar el ciclo completo con app cerrada, no sólo el planner y
worker locales.

### Checklist técnico

- [x] Reescribir `supabase/PUSH_SETUP.md` según migraciones, funciones y secretos
  actuales.
- [ ] Preparar entorno aprobado con VAPID y `CRON_SECRET`; nunca incluir claves
  privadas en Vite, Git, logs ni capturas.
- [ ] Desplegar worker, programar invocación y probar autorización del cron.
- [x] Probar localmente leases, reintentos, expiración, deduplicación, presupuesto diario,
  cooldown, quiet hours y “hoy déjame en paz”.
- [x] Confirmar que completar antes del envío suprime el recordatorio.
- [x] Persistir acciones `done/snooze/skip` cuando la app estaba cerrada; no
  depender sólo de `setTimeout` ni de un cliente abierto.
- [x] Probar rotación y eliminación de suscripciones inválidas en la lógica
  local; la entrega real sigue en la matriz física.
- [~] Revisar paginación, lotes y registro de entregas sin contenido sensible;
  lote acotado y deliveries content-free pasan, falta volumen remoto.
- [x] Compartir el catálogo de copy y memoria anti-repetición con el worker.

**Evidencia técnica local adicional:** el Service Worker persiste
`done/snooze/skip` en una cola IndexedDB con `operationId`, lease y reintento;
la app la drena al volver a abrir. Las acciones directas están desactivadas por
defecto y sólo se adjuntan a una notificación de un único hábito después de un
opt-in explícito. El escenario E2E 35 cerró y recargó la aplicación entre las
tres acciones, comprobó sus efectos y dejó la cola en cero. El contenido de
`snooze` y del lock screen permanece genérico. La entrega física sigue siendo
una puerta externa.

### Matriz física

- [ ] Android instalado: pantalla bloqueada, toque, deep link y acción.
- [ ] iPhone instalado: permiso, recepción, toque y limitaciones de acciones.
- [ ] iPhone no instalado: explicación correcta, sin prometer push.
- [ ] Escritorio: Chrome/Safari compatible, permiso denegado y revocado.
- [ ] Red lenta/intermitente y dispositivo offline durante la ventana.
- [~] Privacidad genérica en lock screen sin nombre de hábito sensible; el
  payload y la prueba local son genéricos, falta confirmarlo en lock screens
  físicos.

### Criterio de cierre

- [ ] Una entrega real queda confirmada en cada plataforma objetivo.
- [~] No hay duplicados ni avisos después de completar en la matriz local;
  falta entrega física.
- [~] Fallos transitorios se reintentan y no consumen el recordatorio antes de
  una entrega terminal.

---

## Bloque 8 — Privacidad, cuenta, métricas y observabilidad

**Objetivo:** hacer completas y honestas las promesas de control de datos antes
de salir de localhost.

### Privacidad y ciclo de vida

- [x] Mantener claramente separados “borrar copia local” y “borrar nube/cuenta”;
  ambas acciones declaran ahora su alcance y el borrado remoto sólo aparece con
  una sesión de nube activa.
- [x] Diseñar borrado remoto con reautenticación, resumen de alcance, doble
  confirmación y estado final verificable en
  `docs/adr/0007-account-deletion.md`.
- [x] Implementar la Edge Function, verificación final y limpieza local del
  flujo aceptado; el botón se habilitó después de pasar la matriz A/B.
- [x] Incluir tablas, Storage, suscripciones push, auth y datos derivados en el
  inventario de borrado remoto.
- [x] Probar borrado cross-user y garantizar que una cuenta no toca otra.
- [x] Probar exportación completa y exportación sin emociones.
- [x] Documentar que el PIN es bloqueo de interfaz, no cifrado de datos.
- [x] Definir retención de entregas, métricas, errores y backups.

**Evidencia de borrado remoto:** `delete-account` valida el JWT con
`auth.getUser`, exige `session_id` activo y `last_sign_in_at` menor a diez
minutos, recorre Storage por propietario, ejecuta hard delete y verifica cero
filas owner-scoped. La UI ofrece respaldo, exige `BORRAR`, pausa y drena sync,
preserva la copia local ante fallos previos y limpia PIN, JWT, localStorage,
IndexedDB, caches y colas sólo después del éxito. La matriz sintética A/B, el
escenario E2E 33 a 375 px, 11 aserciones pgTAP y el detector Impeccable pasaron.

### Métricas responsables

- [x] Mantener analítica separada de sync, opt-in y revocable.
- [x] Definir sólo métricas de producto necesarias: activación, retorno,
  registro, cierre, conflicto y entrega; sin notas, emociones ni texto libre.
- [x] No inferir productividad, salud ni causalidad desde recordatorios.
- [x] Exigir muestra mínima de 20 entregas antes de alertar por tasa y mantener
  fuera del producto cualquier afirmación sustentada sólo por horarios.
- [x] Probar revocación: deja de emitir eventos nuevos y conserva funcionalidad.

**Evidencia de revocación:** las migraciones
`20260902053000_product_analytics_consent_enforcement.sql` y
`20260902053100_account_deletion_product_events.sql` crean un ledger
content-free, exigen consentimiento activo también en RLS, bloquean updates y
lo integran al borrado de cuenta. El escenario E2E 34 emite una activación con
consentimiento, revoca local y remotamente, comprueba que el evento siguiente
se omite y registra un hábito con normalidad. Vitest, 14 aserciones pgTAP y los
dos rollbacks transaccionales pasaron.

### Observabilidad

- [x] Crear panel/consulta de salud con conteos, errores y colas, sin
  payloads personales.
- [x] Alertar sobre jobs atascados, leases vencidos, tasa de entrega y sync por
  resolver mediante umbrales explícitos.
- [x] Definir procedimiento de incidente y restauración.

### Criterio de cierre

- [x] Exportación y ambos tipos de borrado son verificables en local.
- [x] Consentimientos son independientes y revocables.
- [x] Logs y métricas operativas no contienen contenido personal.

---

## Bloque 9 — Staging y despliegue remoto controlado

**Objetivo:** pasar de una aplicación personal local validada a un entorno
remoto sin convertir localhost en evidencia de producción.

### Checklist

- [ ] Crear un proyecto staging separado y aprobado.
- [~] Revisar changelog/documentación oficial de Supabase y versión CLI antes
  de ejecutar cambios remotos; la revisión local se hizo con CLI 2.115.0 y debe
  repetirse en la ventana de despliegue (2.116.0 ya está disponible).
- [x] Inventariar variables y secretos; separar publicable, servidor y CI.
- [ ] Crear backup remoto y ensayar restore en otro proyecto/base.
- [ ] Aplicar migraciones desde cero y comparar historial, catálogo y advisors.
- [ ] Ejecutar pgTAP, E2E, usuario A/B/anon y funciones Edge en staging.
- [ ] Probar dos dispositivos físicos y cambio de cuenta.
- [ ] Ejecutar rehearsal de rollback de la última migración.
- [~] Revisar base `/traker/`, rutas directas, 404, assets y actualización PWA;
  el smoke local pasa, falta repetirlo sobre la URL remota.
- [x] Definir monitoreo, límites, costos y procedimiento de rollback.
- [~] Preparar paquete/commit por alcance sin `.env`, claves, backups ni datos;
  el paquete SQL quedó listo y verificado, mientras el commit continúa
  pendiente porque no fue autorizado.
- [ ] Solicitar aprobación humana antes del despliegue final.

### Preparación local autónoma

- [x] Añadir preflight de variables públicas, nombres de secretos, orden de
  migraciones, rollbacks, scripts y base PWA.
- [x] Añadir smoke no destructivo para HTML, manifest, SW, icono, rutas
  directas, 404, content types y `scope`/`start_url`.
- [x] Añadir scripts protegidos de backup/restore y rollback: son dry-run por
  defecto, exigen dos destinos distintos y acknowledgements explícitos.
- [x] Documentar separación de configuración, backup de Storage, secuencia de
  rollback y repetición de usuario A/B/anon, pgTAP, advisors y E2E.
- [x] Añadir workflow local/PR sin secretos para frontend, migraciones, pgTAP y
  advisors.

**Evidencia local del bloque 9:** `staging:preflight` pasó 28 comprobaciones
sobre 24 migraciones y 12 rollbacks; los rehearsals de backup/restore y
rollback devolvieron `dry-run` sin URLs ni secretos. El smoke local aprobó la
base `/traker/`, rutas directas, 404 y assets. No se creó proyecto remoto, no
se enlazó la CLI y no se desplegó.

El artefacto `paquete-produccion-sql-2026-09-02/` conserva copias byte a byte
de las 24 migraciones aplicadas localmente y 12 rollbacks separados. Su
`MANIFEST.sha256` verificó todos los archivos, el escaneo no encontró secretos
y pgTAP pasó 205 pruebas. Incluye orden de instalación y guía; no contiene
seeds, datos, backups ni configuración privada.

### Criterio de cierre

- [ ] Staging reproduce la instalación desde cero y supera la misma matriz.
- [ ] Restore y rollback están ensayados, no sólo documentados.
- [ ] Producción no contiene secretos de servidor en el frontend.

---

## Bloque 10 — Pulido visual, activos y movimiento

**Objetivo:** completar identidad y estados visuales después de estabilizar los
flujos, sin frenar el MVP funcional.

### Checklist

- [x] Sustituir referencias internas “Koto” por identidad Traker exacta o
  documentar por qué ese activo sigue siendo canónico.
- [ ] Crear/aprobar ilustraciones para apertura, retorno, foco, suficiente,
  offline y error; optimizar tamaños y formatos.
- [ ] Probar un solo hábito piloto antes de generar familias completas.
- [x] Revisar cada movimiento: propósito, duración, interrupción y salida.
- [x] Retirar flotación/pulsos persistentes que compitan con la tarea.
- [x] Mantener transiciones recurrentes breves y feedback instantáneo en
  movimiento reducido.
- [x] Medir impacto de activos en LCP y bundle antes de integrarlos.
- [x] Validar modo claro/oscuro, tablet y escritorio.

**Evidencia del pulido autónomo:** `docs/brand/ASSETS.md` registra el vector
exacto recibido como símbolo canónico de Traker y conserva su nombre interno
sólo por procedencia. El mascotín dejó de flotar, pulsar, parpadear y saludar en
bucle; `HabitGrowth` limita su RAF a 15 fps y lo suspende fuera de viewport,
con pestaña oculta y bajo movimiento reducido. Loaders, skeletons y spinners
tienen fallback estático. El escenario E2E 36 recorre claro/oscuro a 375, 768 y
1280 px, comprueba navegación, overflow, tokens, SVG accesible y ausencia de
bucles infinitos bajo `reduce`. Impeccable terminó con `[]`; bundle y PWA
mantienen 103 entradas y los presupuestos aprobados.

### Criterio de cierre

- [x] La marca es consistente en app, manifest, iconos y accesibilidad.
- [x] Ningún activo rompe los presupuestos de performance.
- [x] El movimiento ayuda a entender estado y nunca obliga a esperar.

---

## Bloque 11 — IA opcional post-MVP

**Objetivo:** probar un caso pequeño sin volver dependiente de IA ninguna
función principal.

### Checklist

- [ ] No iniciar hasta cerrar y observar el MVP sin IA.
- [ ] Caso inicial único: reescribir una apertura o resumen sólo bajo solicitud.
- [ ] Edge Function con entrada mínima, salida estructurada y timeout corto.
- [ ] Fallback local inmediato si hay error, límite, desconexión o rechazo.
- [ ] No enviar notas, emociones o categorías sensibles sin consentimiento
  explícito y contextual.
- [ ] No permitir escritura autónoma, scheduling autónomo ni decisiones sobre
  recompensas.
- [ ] Crear evals de tono, seguridad, privacidad, costo y latencia.
- [ ] Definir retención/caché y mostrar claramente cuándo intervino IA.

### Criterio de cierre

- [ ] El escenario 16 pasa incluso con el proveedor totalmente caído.
- [ ] El usuario puede desactivar IA sin perder ninguna función.

---

## Puertas humanas que no debe decidir el código

- [ ] Aprobar el mapeo final “Sí / A medias / No” y descansos conscientes.
- [ ] Aprobar tono por defecto, límites de carrilla y categorías sensibles.
- [ ] Aprobar semántica de cierre/reformulación de metas.
- [ ] Aprobar privacidad y presupuesto de notificaciones.
- [ ] Proporcionar/autorizar dispositivos físicos para la certificación.
- [ ] Autorizar staging, secretos y cualquier despliegue remoto.
- [x] Aprobar borrado remoto de cuenta/datos antes de implementarlo.
- [ ] Aprobar activos visuales antes de integrarlos a todas las superficies.
- [ ] Aprobar proveedor y política de privacidad antes de un piloto de IA.

## Definition of Done global

- [x] Datos actuales preservados, exportables y restaurables.
- [x] Seguridad crítica y aislamiento cross-user verificados en local; staging
  remoto sigue pendiente.
- [x] Frecuencia semanal, grupo alternable e hitos funcionan offline.
- [x] Hoy presenta foco y agenda sin duplicados ni deuda acumulada.
- [x] Registro principal requiere 1–2 toques y el contexto es opcional.
- [x] Cierre y recompensas no dependen de completar todo.
- [x] Recompensas no usan rueda ni azar.
- [x] Dos dispositivos convergen o muestran conflicto explícito.
- [x] Los 24 escenarios obligatorios tienen evidencia.
- [~] Responsive, accesibilidad y performance tienen reportes automatizados
  repetibles; falta la matriz física.
- [ ] Web Push real respeta presupuesto, privacidad y reintentos.
- [x] Exportación, borrado local y borrado remoto dicen exactamente qué hacen.
- [x] IA puede estar ausente sin degradar el producto.
- [x] Tests, build, pgTAP, advisors y `git diff --check` quedan verdes al final
  de cada bloque.

## Siguiente acción recomendada

### Validación final del 2 de septiembre de 2026

- Vitest: 56 archivos y 339 pruebas aprobadas.
- E2E: 36/36, usuario temporal autenticado y eliminado; cero cuentas de prueba
  y cero eventos analíticos residuales.
- pgTAP: 12 archivos y 205 aserciones aprobadas. La CLI oficial no puede montar
  `supabase/tests` porque Docker Desktop no comparte `/Applications`; se copió
  sólo la suite al contenedor local y se ejecutó con fallo ante cualquier
  `not ok`.
- Build/PWA: 2,016 módulos, 103 entradas de precache; manifest, control de SW y
  ruta profunda offline aprobados. LCP 1,660 ms, INP 24 ms, CLS 0.016 y
  rehidratación de escala en 985 ms/16 MiB.
- Bundle: 823.9 KiB JS (270.8 KiB gzip), 233.3 KiB CSS (47.8 KiB gzip) y chunk
  mayor de 206.0 KiB; todo dentro del presupuesto.
- Supabase advisors: sin hallazgos. Impeccable: `[]`.
- Staging local: preflight aprobado; backup/restore y rollback en dry-run
  protegido; smoke local aprobado.
- Revisión: `git diff --check` aprobado, búsqueda de secretos sin coincidencias
  reales y contratos retirados ausentes del runtime. No se creó commit.

Todo pendiente técnicamente ejecutable en local quedó cerrado. Permanecen como
puertas externas la certificación física de accesibilidad/PWA/Web Push, la
aprobación de privacidad y activos, los secretos VAPID/cron, la creación de
staging, restore/rollback remoto y cualquier despliegue. IA continúa bloqueada
por diseño hasta cerrar y observar el MVP en un entorno aprobado.
