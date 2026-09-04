# Resultados del piloto de sincronización v2

Fecha: 30 de agosto de 2026  
Entorno: Traker y Supabase local en Docker  
Cutover: autorizado y activo sólo en localhost

## Resultado automatizado

La prueba `npm run pilot:sync-v2` creó un usuario local temporal, autenticó dos identificadores de dispositivo a través del gateway HTTP y eliminó el usuario al terminar. La comprobación posterior encontró cero usuarios temporales restantes.

| Escenario | Resultado |
| --- | --- |
| Edición de metadatos y pausa | Aprobado |
| Conflicto por versión obsoleta | Aprobado |
| Borrado, tombstone y restauración | Aprobado |
| Conflicto en la misma ocurrencia diaria | Aprobado; quedó un log |
| Claim de recompensa repetido | Aprobado; quedó un claim |
| Pull y cursor del segundo dispositivo | Aprobado; recibió cuatro cambios |
| Ledger sin contenido personal | Aprobado |
| Reporte de calidad del backfill | Aprobado; cero huecos |

En la repetición del 29 de agosto posterior a la corrección de restore offline, las operaciones individuales medidas después del seed tardaron entre 8 y 63 ms en la máquina local. El pull tardó 17 ms. Estas cifras sólo describen este entorno local y no constituyen un benchmark de producción.

## Validación acumulada

- Vitest: 41 archivos y 229 pruebas aprobadas.
- pgTAP: 5 archivos y 104 pruebas aprobadas; incluyen catálogo de seguridad y aislamiento cross-user del RPC v2.
- Linter local: cero errores o advertencias de esquema. Advisors: cero `WARN`/`ERROR`; sólo observaciones informativas de política deny-all e índices sin evidencia de uso todavía.
- Build PWA con `VITE_SYNC_V2_PILOT=true`: aprobado.
- Detector mecánico Impeccable: sin hallazgos.
- Runner, bandera, ruta y diagnóstico protegidos: rechazan o no exponen el piloto si `SUPABASE_URL` no es localhost.
- Matriz manual: sus marcas y tiempos sobreviven al reinicio y forman parte de la evidencia exportada.
- Estado honesto: un reporte de servidor incompleto no se presenta como cero huecos, y una outbox pendiente impide declarar convergencia.
- Diagnóstico terminal: el reporte separa operaciones pendientes, en conflicto, rechazadas y bloqueadas sin exponer payloads. Una operación sólo sale del total activo cuando el snapshot canónico ya convergió; se conserva como evidencia `acknowledged` en vez de borrarse.
- Frontera de cuenta: una huella irreversible vincula la copia v2 a una sola cuenta. Un cambio de cuenta pausa todo el transporte antes de pull, push, colas, settings o suscripción de notificaciones; conserva la copia y dirige a Ajustes. El marcador no se exporta ni se reemplaza automáticamente.
- Portabilidad local: el respaldo incluye las bases `traker-goals` y `traker-v2`, colas y preferencias; excluye credenciales, puede redactar check-ins emocionales y ya se descarga desde Ajustes con un nombre fechado. La limpieza local no se presenta como borrado de Supabase.
- Revisión Impeccable source-first en dos rondas: cuatro riesgos críticos confirmados como resueltos; la segunda ronda detectó una duplicación de restore tras recarga offline y terminó en `FIX` acotado.
- Corrección posterior al veredicto: el restore `pending` se deriva de IndexedDB al remontar, se muestra como `queued` sin acción, el bridge reutiliza la operación pendiente y la cola heredada deduplica por hábito. La regresión end-to-end local confirma un solo restore y la suite completa queda verde. No se abrió una tercera ronda por el límite de revisión de la skill.

## Resultado manual visible

Se autenticó el mismo usuario local temporal en dos perfiles lógicos aislados por origen: `http://127.0.0.1:5175` y `http://localhost:5175`. Esto separó IndexedDB, almacenamiento local y `deviceId` sin afirmar que fueran dos dispositivos físicos.

| Comprobación visible | Resultado |
| --- | --- |
| Editar nombre y mínimo en A | Aprobado; B recibió la versión nueva |
| Pausar y reanudar en A | Aprobado; B recibió ambos estados |
| Registrar la misma fecha en A y B | Aprobado; quedó un log canónico y un conflicto `occurrence_conflict` explícito |
| Eliminar en A y restaurar | Aprobado online; el tombstone ganó en B y el restore creó una versión activa nueva |
| Restaurar offline, recargar y reconectar | Aprobado; una sola operación pendiente sobrevivió la recarga y Postgres aplicó `baseVersion 7 → newVersion 8` |
| Reclamar el mismo periodo | Aprobado tras corrección; ambos perfiles mostraron una sola recompensa usada |

La quinta comprobación expuso una carrera real: `upsert-reward-claim` podía llegar al RPC v2 antes de que `upsert-reward` terminara de crear la regla heredada requerida por la llave foránea. `sync.service.js` ahora serializa los `push` en orden de invocación, incluido el dual-write heredado, y `sync.v2-pilot.integration.test.js` cubre la regresión. En el retest, Postgres reportó un claim canónico, un claim usado y una nueva operación v2 con resultado `duplicate`; la operación rechazada anterior se conserva en el usuario temporal como evidencia del defecto previo.

El sondeo posterior encontró un segundo defecto relacionado: el pull podía intentar guardar el ID canónico del claim mientras IndexedDB todavía conservaba un ID local distinto para el mismo `ruleId + periodKey`, provocando `AbortError` por el índice único. `recordPilotV2RemoteSnapshot` ahora localiza y elimina primero ese ID provisional, igual que la reconciliación ya existente para ocurrencias de hábitos. La regresión confirma que queda sólo el claim canónico y el piloto vivo no volvió a registrar la excepción después de aplicar HMR.

La repetición manual offline descubrió que un restore histórico ya sincronizado podía ocultar indebidamente el botón de un tombstone posterior. `loadLatestPilotV2HabitRestoreState` ahora sólo considera restores cuya `baseVersion` corresponde al tombstone actual o a una versión posterior. Con el gateway local detenido, la UI mostró **Restauración guardada en la cola local**, mantuvo una sola operación tras recargar y, al reconectar, Postgres dejó el hábito activo en la versión `8`, sin `deletedAt`, mediante una única operación aplicada con `baseVersion = 7`. La regresión nueva cubre también este orden histórico restore → delete posterior → restore nuevo.

Durante la ejecución, Postgres dejó de responder porque `supabase_db_traker-local` estaba `unhealthy`. Tras el reinicio autorizado de Docker Desktop, el contenedor quedó `healthy`, `statement_timeout` continuó en `0` y la prueba dejó de fallar sin modificar SQL ni el modelo. El incidente se clasifica como salud de infraestructura local, no como timeout de consulta.

La conexión visible con Chrome quedó restablecida el 30 de agosto. Los siete anchos objetivo fueron recorridos: 320/375 ya estaban aprobados y se confirmaron 430/768/1024/1280/1440 px sin overflow horizontal. A 430 la barra inferior conserva Hoy, Hábitos, Premios e Historial con objetivos de 76×56 px; a 768 cambia a rail con objetivos de 44×44 px; 1024 mantiene una columna centrada de 640 px. A 1280 se detectó una columna vacía de 380 px, se corrigió el breakpoint a 1320 px, se restauró el resumen de 360 px y la cuadrícula ahora colapsa cuando no existe contenido primario. El retest de 1280 y 1440 dejó una sola columna de 640 px centrada, sin reserva vacía.

El reflujo equivalente a 200 % descubrió que el saludo largo se truncaba; `AuroraTopBar` ahora permite ajuste completo en dos líneas. Después se ejecutó zoom nativo de Chrome a 200 %: `devicePixelRatio` pasó de 2 a 4 y el viewport efectivo quedó en 702×306 px, con scroll vertical restaurado, cero overflow horizontal y ningún texto recortado. La altura reducida reveló que el ayudante cubría «Ver resumen»; ahora se oculta por debajo de 480 px de altura y el retest dejó las acciones finales libres. Diez pasos de teclado mostraron orden lógico y foco cian sólido de 2 px. El lock mueve el foco al primer número, contiene Tab, no cierra con Escape, oculta la app para tecnologías de asistencia y restaura scroll; una tercera regresión cubre la integración. `prefers-reduced-motion` reduce tokens a 1 ms y elimina el desplazamiento del desbloqueo; la preferencia del sistema estaba desactivada, por lo que falta su ejecución física.

El primer intento manual a 320 px detectó un defecto de capas fuera de la página del piloto: el nodo raíz de `LockOverlay` combinaba la utilidad fija con `aurora-ambient`, cuya regla global lo devolvía a `position: relative` y permitía que apareciera debajo de la app. La capa fija y el ambiente relativo ya están separados, el contenido de fondo queda sin scroll mientras el lock está montado y dos regresiones cubren la estructura modal y la restauración de overflow. El retest visual fue confirmado.

Ese intento también mostró que la navegación inferior estaba ausente: Inicio y el piloto declaraban `hideNav`, lo que en móvil retiraba la única navegación global. Ambas rutas ya permiten `AuroraBottomNav`; después se adoptó la arquitectura Hoy, Rumbo, Hábitos, Premios e Historial, se retiró Crear como pestaña y Ajustes quedó como utilidad secundaria. Cinco regresiones verifican estructura, etiquetas accesibles y mapeo de rutas. La composición final fue confirmada visualmente a 320 px.

## Puerta humana y diferidos

Se difieren como comprobaciones no bloqueantes para el uso local/personal:

- lector de pantalla real y movimiento reducido activado en el sistema;
- prueba controlada de red lenta.

El cutover local fue aprobado explícitamente el 30 de agosto de 2026. Las comprobaciones anteriores permanecen registradas como diferidos, no como certificación completada.

El bloqueo anterior de integración quedó resuelto después de actualizar la extensión y reiniciar la sesión. La pestaña autenticada de `127.0.0.1:5175` fue reclamada directamente; no se usó automatización externa ni se reutilizó evidencia simulada.

El cutover queda persistido en `.env.local` con URL y clave publicable de Supabase Docker. `.env.example` conserva `VITE_SYNC_V2_PILOT=false`, la bandera exige hostname local y no se escribió ninguna clave `service_role`. Fase 6 no comienza automáticamente en ningún caso.

Las acciones normales soportadas —hábitos, logs y claims— ya atraviesan el transporte v2 bajo la bandera local. Las pruebas cubren staging atómico, operación estable offline, restore pendiente durable y deduplicado tras recarga, conflictos que no se sobreescriben, dependencias versionadas en rondas separadas, cursores por navegador, reconciliación del ID canónico y tombstones en el store visible.

El cierre automatizado, la matriz visible 5/5, el restore durante una desconexión controlada, los siete anchos y el zoom nativo a 200 % en Chrome cubren los contratos de código, persistencia, conflicto, convergencia y reflujo responsive del piloto. No certifican todavía lector de pantalla físico, movimiento reducido activado ni red lenta.

## Auditoría técnica de cutover — 30 de agosto de 2026

- Node `22.22.3` y Supabase CLI `2.115.0`.
- Contenedores locales de Traker saludables y 14 migraciones alineadas con la base.
- `supabase db lint --local`: sin errores de esquema.
- Advisor de seguridad: sin alertas bloqueantes; `sent_reminders` conserva RLS sin políticas y sin grants de cliente de forma intencional, por ser server-only.
- pgTAP: 5 archivos, 104 pruebas, todas aprobadas.
- El replay detectó una sola entrada heredada ya representada canónicamente, la enlazó sin crear filas y dejó `missingLegacyLogs = 0`, `missingReminderSchedules = 0` e `inferredLogs = 0`.
- El dual-write individual y masivo conserva ahora ese enlace al escribir, con regresión automatizada. La validación final después de la observación queda en 41 archivos y 229 pruebas Vitest; build PWA y `git diff --check` aprobados.
- Cutover local aprobado y activado. Vite reinició al cambiar `.env.local`; la resolución efectiva confirmó bandera activa, URL local y clave publicable, y la validación posterior aprobó el build PWA sin variables temporales.

## Primera ventana posterior al cutover — 30 de agosto de 2026

- El runner aislado volvió a pasar los ocho contratos de Sync v2: pausa, conflicto de versión, delete/restore, una ocurrencia diaria, claim idempotente, cursor/pull, ledger sin contenido y calidad del backfill.
- La limpieza dejó `temporary_pilot_users = 0`, `missingLegacyLogs = 0` y `missingReminderSchedules = 0`.
- Chrome confirmó que la ruta `/settings/sync-v2-pilot` está registrada y activa con el nuevo entorno.
- La sesión visible estaba bloqueada por PIN y sin sesión Supabase local. El estado mostraba una operación sin resolver y no ofrecía recuperación; ahora incluye `Iniciar sesión`, abre `/auth/login?returnTo=sync-v2-pilot` y el login sólo acepta retornos internos permitidos.
- Impeccable no detectó infracciones en las superficies modificadas. La validación acumulada queda en 41 archivos, 229 pruebas Vitest, build PWA y `git diff --check` aprobados.
- La sesión autenticada reveló que el registro restante era un `occurrence_conflict`, no una operación pendiente. La auditoría de sólo lectura confirmó un log canónico presente y ningún duplicado. Tras comprobar la misma convergencia en IndexedDB, el piloto archivó la operación como `acknowledged`; Chrome mostró `Convergencia lista`, `0` huecos y `0` operaciones por resolver.
- El login también expuso un desfase de propietario entre la copia funcional y la cuenta activa. Con autorización explícita se transfirieron atómicamente los datos funcionales y las 12 operaciones del ledger a la cuenta activa; preferencias, sesiones y cursores permanecieron aislados.
- La recarga final vinculó correctamente la copia a la cuenta activa, conservó `Convergencia lista` y no mostró un bloqueo falso. Las regresiones prueban que una cuenta distinta no puede sustituir esa vinculación ni enviar la cola.
