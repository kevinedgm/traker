# Traker — Plan de implementación

## Regla de ejecución

Este documento nació como propuesta de Etapa 2. El 28 de agosto de 2026 se aprobó replantear el modelo de la base local de prueba y se implementó su parte aditiva en `supabase/migrations/20260829053218_integrated_personal_model.sql`. Las fases de frontend, integración y despliegue remoto continúan pendientes. Ninguna migración destructiva forma parte del MVP.

Validación de la base local completada: 31/31 pruebas pgTAP, historial de 10 migraciones alineado y advisors de seguridad/rendimiento sin advertencias.

Primer corte vertical completado el 29 de agosto de 2026:

- Un hábito admite varias metas mediante `goalIds[]`, conservando `goalId` como compatibilidad temporal.
- El calendario de días es independiente del recordatorio y determina qué aparece en Hoy.
- El registro conserva `habit_entries` y escribe también el contrato canónico de `traker_habit_logs`.
- La sincronización persiste hábito, enlaces N:M, calendario y logs; las relaciones diferidas vuelven a la cola.
- 18 archivos de pruebas / 105 pruebas aprobadas, build de producción aprobado y revisión de interfaz en estado `PASS`.
- QA visual con capturas queda pendiente porque el navegador integrado no estuvo disponible en esta sesión.

Segundo corte vertical completado el 29 de agosto de 2026:

- Check-in diario opcional con carga, energía, ánimo, presión, contexto y nota; todos los campos emocionales siguen siendo opcionales.
- Persistencia offline-first en `traker:checkins`, un registro activo por fecha y edición sin crear deuda ni puntuación.
- Privacidad por registro: `local_only` por defecto; sólo `cloud` llega a `traker_daily_checkins`, y revocar el permiso conserva lo local y elimina la copia remota.
- Integración en Hoy e Historial, con alcance de privacidad visible y sin apertura automática ni bloqueo del cierre diario.
- Pull, push, cola offline, exportación, importación y borrado incluyen check-ins; RLS y grants existentes permanecen sin cambios.
- 21 archivos de pruebas / 117 pruebas aprobadas y build de producción aprobado. QA visual con capturas sigue pendiente por falta de navegador integrado.

## Checklist vivo de ejecución

Última actualización: 30 de agosto de 2026. Este bloque se actualiza después de cada corte de trabajo. `[x]` terminado y verificado, `[~]` implementado localmente con puerta humana pendiente, `[ ]` pendiente o bloqueado.

### Estado por fase

- [~] **Fase 0 — Baseline, seguridad y preservación:** modelo local aditivo, RLS, grants, export/delete y regresiones implementados; faltan backup/despliegue remoto aprobado y la comprobación humana cross-user fuera del entorno local.
- [~] **Fase 1 — Rumbo y relaciones:** metas, hitos, relación hábito-meta N:M, horizontes y compatibilidad local implementados; falta aprobar lenguaje y semántica con uso real.
- [~] **Fase 2 — Agenda y registro v2:** calendarios, agenda, logs versionados, outbox y UI responsive implementados; teclado, reflujo y zoom nativo a 200 % ya fueron comprobados en Chrome, pero faltan lector de pantalla físico y mapeo final de niveles.
- [~] **Fase 3 — Cierre, check-in y recompensas:** flujo local-first, consentimiento por registro, claims y copy sensible implementados; falta la puerta humana de privacidad, tono y retiro definitivo de la rueda.
- [~] **Fase 4 — Notificaciones fiables:** planner, jobs, leases, reintentos, quiet hours, diagnóstico y fallback implementados localmente; faltan escenarios en dispositivos reales y aprobación de textos/presupuesto.
- [x] **Fase 5 — Sync v2 y piloto local:** implementación, validación automatizada, matriz visible 5/5, restore manual offline/recarga, auditoría técnica y cutover local aprobados. Las pruebas físicas permanecen diferidas y no equivalen a certificación remota.
- [ ] **Fase 6 — Contrato y limpieza:** bloqueada; Fase 5 local ya está aprobada, pero no se inicia ni elimina lectores/columnas heredadas sin aprobación separada, backup y rollback probado.

### Cierre local — Fase 5

- [x] Supabase local en Docker y migración `20260829071615_phase5_sync_v2_backfill.sql` aplicada.
- [x] Push/pull v2, cursor durable, ledger sin contenido, RLS y snapshot owner-scoped.
- [x] Dual-write para hábitos, logs y claims con compatibilidad heredada no destructiva.
- [x] Tombstones y restore versionado; restore offline pendiente persiste tras recarga y se deduplica por hábito.
- [x] Backfill local/servidor, exportación y rollback por bandera documentados.
- [x] 41 archivos / 229 pruebas Vitest aprobadas.
- [x] 5 archivos / 104 pruebas pgTAP aprobadas; incluyen invariantes globales de RLS/grants/vistas/funciones y un intento cross-user contra el RPC v2.
- [x] 8 escenarios HTTP locales aprobados y limpieza del usuario temporal confirmada; repetición del 29 de agosto aprobada con pull de 17 ms y operaciones de 8–63 ms después del seed.
- [x] Build PWA con `VITE_SYNC_V2_PILOT=true` aprobado.
- [x] Ruta local servida y bridge final comprobado por HTTP.
- [x] Navegador visible conectado y dos perfiles lógicos aislados por origen (`127.0.0.1` y `localhost`) autenticados con el mismo usuario local temporal.
- [x] Matriz visible 5/5: edición/mínimo, pausa, conflicto de ocurrencia diaria, tombstone/restore y claim de recompensa convergieron entre ambos perfiles.
- [x] Delete → restore → recarga probado manualmente con `supabase_kong_traker-local` desconectado: la UI conservó una sola restauración en la cola, sobrevivió a la recarga y, tras reconectar, Postgres aplicó una única operación con `baseVersion = 7`, creó la versión `8` activa y dejó `deletedAt = null`.
- [~] Los siete anchos objetivo quedaron recorridos en Chrome: 320/375 ya estaban aprobados y el 30 de agosto se confirmaron 430/768/1024/1280/1440 px. No hubo overflow horizontal; 430 conserva navegación inferior con cuatro etiquetas y objetivos de 76×56 px, 768 cambia a rail con objetivos de 44×44 px y 1024 mantiene una columna de 640 px. A 1280 se detectó una columna primaria vacía de 380 px; se eliminó la reserva vacía, el salto de dos columnas volvió a 1320 px con resumen de 360 px y 1280/1440 quedaron centrados cuando no existe contenido primario.
- [x] La conexión con Chrome quedó restablecida después de actualizar la extensión y reiniciar la sesión. Se reclamó la pestaña autenticada de `127.0.0.1:5175` y toda la evidencia responsive posterior proviene de esa sesión visible.
- [x] Evidencia visual y canónica registrada. El piloto detectó una carrera regla→claim, se serializó el orden de `push`, se añadió regresión y el retest dejó un claim canónico usado y una nueva operación `duplicate`; el rechazo previo se conserva como evidencia local del defecto encontrado.
- [x] El snapshot remoto reconcilia por `ruleId + periodKey` un claim local con ID provisional antes de guardar el ID canónico; así evita abortar IndexedDB por su índice único. Regresión añadida y piloto vivo sin nuevas excepciones tras HMR.
- [x] QA del lock: la capa modal fija quedó separada del ambiente relativo; cubre el viewport, bloquea `html/body`, mueve el foco al primer número, contiene Tab, ignora Escape, oculta `#app` con `aria-hidden`/`inert` y restaura el scroll al cerrar. Tres regresiones y el retest real a 430 px lo confirman.
- [x] La navegación quedó reestructurada como Hoy, Rumbo, Hábitos, Premios e Historial, con Rumbo condicionado por `VITE_GOALS_ENABLED`, etiquetas visibles en móvil, estados activos correctos y Ajustes separado en escritorio. Cinco regresiones cubren estructura, etiquetas, accesibilidad y mapeo de rutas; Chrome confirmó navegación y estado activo a 430 px, bottom nav hasta 767 px y rail desde 768 px.
- [x] Zoom nativo de Chrome a 200 % aprobado: `devicePixelRatio` pasó de 2 a 4, el viewport efectivo quedó en 702×306 px, el documento mantuvo scroll vertical y cero overflow horizontal, no hubo texto recortado y las acciones finales quedaron por encima de la navegación. La prueba descubrió que el ayudante cubría «Ver resumen»; ahora se oculta cuando la altura efectiva es menor a 480 px. Diez pasos de teclado mostraron orden lógico y foco cian de 2 px; el lector de pantalla real sigue siendo puerta humana.
- [~] `prefers-reduced-motion` reduce los tiempos Aurora a 1 ms y ahora también elimina el desplazamiento del desbloqueo. La preferencia del sistema de prueba estaba desactivada; la regla fue confirmada en CSSOM, pero falta una ejecución física con la preferencia activa.
- [x] Auditoría técnica de cutover local: Node `22.22.3`, Supabase CLI `2.115.0`, contenedores saludables, 14 migraciones locales alineadas, lint sin errores, asesor sin alertas de seguridad bloqueantes y pgTAP `104/104`.
- [x] Integridad del backfill reparada y verificada: una entrada ya canónica quedó enlazada sin duplicarse; después del replay idempotente hay `0` logs heredados y `0` horarios de recordatorio faltantes, con `0` logs inferidos.
- [x] El dual-write individual y masivo conserva ahora el ID de `habit_entries` en `traker_habit_logs`, evitando que el desfase vuelva a aparecer. La suite completa queda en 229 pruebas Vitest tras añadir la conciliación terminal conservadora y la frontera de cuenta local.
- [~] Lector físico, movimiento reducido real y red lenta quedan diferidos por decisión del propietario. No bloquean un cutover exclusivamente local/personal, pero sí una certificación amplia o despliegue remoto.
- [x] Cutover local aprobado explícitamente el 30 de agosto de 2026. `.env.local` activa `VITE_SYNC_V2_PILOT` sólo contra Supabase Docker local; `.env.example` permanece en `false` y la protección por hostname impide activarlo contra el proyecto remoto.
- [x] La configuración usa únicamente la clave publicable local; ninguna clave `service_role` se escribe en variables Vite.
- [x] Primera ventana técnica posterior al cutover: el runner aislado pasó pausa, conflicto obsoleto, delete/restore, conflicto de ocurrencia, claim idempotente, pull/cursor, ledger sin contenido y calidad del backfill. Terminó con `0` usuarios temporales, `0` logs faltantes y `0` horarios faltantes.
- [x] Recuperación de sesión endurecida: “Requiere sesión local” ofrece ahora `Iniciar sesión`, abre el formulario local y conserva un retorno permitido al piloto; destinos externos o no permitidos vuelven a Hoy. Chrome confirmó el flujo visible y tres regresiones nuevas lo cubren.
- [x] Observación autenticada cerrada: se desbloqueó Chrome, se inició sesión y el retorno mostró `0` huecos. El `1` restante era un `occurrence_conflict`, no trabajo pendiente; Postgres conservaba el log canónico y no tenía el duplicado. El piloto ahora distingue estados, concilia sólo tras comprobar el snapshot local y archiva la evidencia como `acknowledged`. La vista real terminó en `Convergencia lista` y `0` operaciones por resolver.
- [x] El desfase de propietario local que impedía el push fue corregido con autorización explícita: hábitos, logs, horarios, recompensas y su ledger se transfirieron atómicamente a la cuenta local activa; preferencias, sesiones y cursores no se mezclaron.
- [x] Cambio de cuenta endurecido: la copia v2 se vincula atómicamente a una huella irreversible de la primera cuenta, bloquea pull/push/colas/settings/push subscription ante otra cuenta, conserva las operaciones localmente y muestra una recuperación hacia Ajustes. La huella no se incluye en exportaciones y nunca se reemplaza automáticamente.
- [ ] Fase 6 continúa bloqueada y requiere aprobación separada, backup y rollback, aunque Fase 5 local esté cerrada.

### Revalidación automatizada — Fase 0

- [x] `supabase db lint --local`: cero errores o advertencias de esquema.
- [x] Advisor de seguridad: cero `WARN`/`ERROR`; `sent_reminders` aparece sólo como `INFO` porque está deliberadamente cerrado a `anon` y `authenticated` sin policy de cliente.
- [x] Advisor de rendimiento: cero `WARN`/`ERROR`; los foreign keys sin índice y los índices aún no usados quedan como observaciones `INFO` para revisar con volumen real, no como cambios automáticos.
- [x] Todas las tablas de aplicación en `public` tienen RLS.
- [x] `anon` no tiene privilegios sobre tablas de aplicación ni ejecución de funciones `SECURITY DEFINER`.
- [x] Ninguna vista visible para clientes usa privilegios del creador para evadir RLS.
- [x] Las funciones `SECURITY DEFINER` fijan `search_path`; sólo `traker_apply_sync_operations(text,jsonb)` está permitido a `authenticated`.
- [x] El usuario A recibe conflicto al apuntar el RPC v2 a una entidad del usuario B y la fila B permanece intacta.
- [x] El respaldo local incluye hábitos, check-ins, cierres, recompensas, preferencias, cola heredada, log de notificaciones, `traker-goals` y `traker-v2`.
- [x] PIN, token heredado y sesión Supabase quedan fuera del archivo exportado.
- [x] `includeEmotionsInExport=false` redacta los check-ins del respaldo y declara la redacción en `_privacy`.
- [x] El respaldo completo se puede descargar desde Ajustes con estado de progreso, resultado accesible y nombre de archivo fechado.
- [x] “Borrar copia local” elimina ambos IndexedDB, colas y preferencias sin llamar borrados remotos; el texto aclara que Supabase permanece y puede rehidratar la copia.
- [ ] Un borrado remoto de cuenta/datos requiere flujo, autenticación reforzada y aprobación separados; no se infiere desde la limpieza local.
- [ ] Confirmar backup, despliegue remoto y prueba cross-user en un entorno aprobado distinto de localhost.

### Siguiente acción desbloqueable

Fase 5 no conserva bloqueadores locales. Mantener la ventana de observación con lectores heredados y rollback activos. El siguiente cambio material es Fase 6; no se inicia sin aprobación separada, backup y rollback probado.

## Fase 0 — Baseline, seguridad y preservación

Objetivo: convertir riesgos críticos en un punto de partida fiable.

Trabajo:

- Inventario de Supabase desplegado, grants, RLS, advisors y backups.
- Hardening de vistas o revocación de acceso.
- Retirar cache runtime de REST autenticado.
- Completar exportación/borrado de todos los stores actuales.
- Corregir persistencia local de `goalId`.
- Corregir foco reactivo de modal e inputs accesibles.
- Añadir pull/hidratación de metas.
- Baseline E2E y pruebas A/B de RLS.

Migración: `010_security_preflight_and_view_hardening.sql`.

Criterios:

- Usuario A nunca consulta datos de B por tabla/vista/RPC/cache.
- Export + delete enumeran hábitos, metas, recompensas, colas y preferencias.
- Dispositivo nuevo hidrata metas.
- 93 pruebas previas siguen pasando y se agregan regresiones críticas.
- Rollback ensayado en staging.

Puerta humana: confirmar despliegue/backup y aprobar correcciones críticas.

## Fase 1 — Núcleo de rumbo y relaciones

Objetivo: metas cerrables y hábitos N:M sin cambiar todavía toda la agenda.

Trabajo:

- Hitos operativos.
- Join hábito-meta.
- Compatibilidad con `linked_goal_id`.
- Eventos de horizonte/reformulación/cierre.
- UI Rumbo y edición de vínculos.

Migración: `011_goal_milestones_and_habit_goal_links.sql`.

Criterios:

- Un hábito se vincula a ≥2 metas.
- Registrar genera evidencia en ambos vínculos sin cerrar metas.
- Hito puede habilitar cierre explícito.
- Cambiar horizonte conserva historial.
- Datos heredados conservan relación.

Puerta humana: validar lenguaje Meta/Hito/Acción/Rumbo y semántica de reformulación.

## Fase 2 — Calendario flexible, agenda y registro v2

Objetivo: producir Hoy desde ocurrencias reales y registrar en 1–2 toques.

Trabajo:

- Schedules weekdays y N/semana.
- Grupo alternable semanal.
- Log v2 Sí/A medias/No/omitido.
- Agenda esencial con deduplicación y capacidad.
- Dashboard responsive 320–1440.
- Outbox/idempotencia para logs.
- Compatibilidad visual y de lectura con entradas antiguas.

Migración: `012_habit_schedules_flexible_groups_and_log_v2.sql`.

Criterios:

- Un hábito N:M aparece una vez.
- Máximo tres esenciales y cero deuda al día siguiente.
- Registro offline, undo y sync idempotente.
- 24 escenarios: 1–9, 12, 15 y 24 pasan en integración.
- Teclado, zoom 200 %, lector y reduced motion.

Puerta humana: aprobar mapeo de cinco niveles y orden final de Hoy.

## Fase 3 — Cierre, check-in y recompensas

Objetivo: feedback cercano sin compulsión y reflexión opcional.

Trabajo:

- Cierre contextual.
- Check-in opcional/local-first.
- Recompensas multi-fuente y claims.
- Retiro de rueda como flujo principal.
- Catálogo de copy versionado y matriz sensible.
- Un hábito visual piloto + seis estados globales solo si diseño aprobado.

Migración: `013_daily_checkins_rewards_and_privacy.sql`.

Criterios:

- Cierre funciona sin ánimo/contexto.
- Recompensa “2 de 3” no duplica claims.
- Contexto sensible neutraliza carrilla y lock screen.
- Día suficiente no depende de completar todo.
- Escenarios 10, 11, 19, 20–23 pasan.

Puerta humana: privacidad de check-in, tono por defecto, personaje y eliminación de rueda.

## Fase 4 — Notificaciones fiables

Objetivo: apertura/cierre con presupuesto, supresión y recuperación.

Trabajo:

- Preferences por dispositivo.
- Planner puro.
- Jobs/deliveries, leases, reintentos y caducidad.
- Deep links persistentes.
- Catálogo compartido en Edge.
- Diagnóstico iOS/Android/desktop.
- In-app scheduler como fallback, no fuente divergente.

Migración: `014_notification_jobs_deliveries_and_preferences.sql`.

Criterios:

- No se envía después de completar.
- Fallo 5xx reintenta sin quemar ledger ni duplicar.
- 410 invalida suscripción.
- Rechazo y quiet hours se respetan.
- PWA no instalada recibe guía correcta.
- Escenarios 13, 14, 17 y 18 pasan en dispositivos reales.

Puerta humana: presupuesto y textos de permiso/lock screen.

## Fase 5 — Sync v2, backfill y piloto

Objetivo: unir dominios, probar dos dispositivos y liberar MVP controlado.

Trabajo:

- Operaciones v2 y cursores.
- Backfill server/local con reporte de calidad.
- Consolidación gradual en IndexedDB `traker-v2`.
- Resolución de conflictos.
- Export/delete v2.
- Observabilidad operacional y piloto.

Migración implementada: `20260829071615_phase5_sync_v2_backfill.sql`.

Estado técnico local (29 de agosto de 2026):

- Operaciones/cursor v2, backfill idempotente y reporte de calidad implementados.
- IndexedDB `traker-v2`, exportación y limpieza reversible detrás de `VITE_SYNC_V2_PILOT`.
- Matriz automatizada de dos dispositivos y runbook en `../phases/PHASE5_SYNC_V2_PILOT.md`.
- El diagnóstico y la evidencia del piloto pasaron una revisión source-first inicial; la revisión final en dos rondas produjo un `FIX` acotado para restore offline/recarga, ya implementado y cubierto por regresión.
- Hábitos, logs y claims cotidianos ya usan staging/dual-write/pull v2 bajo la bandera local; versiones dependientes viajan en rondas separadas y un conflicto bloquea sus sucesoras sin permitir una escritura heredada destructiva.
- La matriz visible en dos perfiles lógicos aislados terminó 5/5. Durante el claim detectó una carrera entre la creación heredada de la regla y su operación v2 dependiente; el orquestador ahora serializa los `push` y una regresión cubre ese orden.
- Suite acumulada actual: 229 pruebas Vitest, 104 pgTAP, build PWA y ocho escenarios HTTP locales aprobados.
- La repetición manual offline/recarga quedó aprobada con una sola operación restore `7 → 8`. El cutover local fue aprobado, la convergencia visible quedó en cero gaps/conflictos sin resolver y Fase 6 avanzó únicamente a preflight reversible.

Criterios:

- Matriz dos dispositivos pasa con logs, meta editada, pausa, delete/restore y reward claim.
- Cero pérdida en comparación pre/post backfill.
- App puede volver a readers heredados bajo flag durante rollback.
- Métricas responsables capturan utilidad sin contenido sensible.
- Piloto cumple performance y accesibilidad.

Puerta humana: resultados de piloto y decisión de cutover.

## Fase 6 — Contrato y limpieza (fuera del MVP inicial)

Solo después de una ventana aprobada:

- Retirar columnas/lectores heredados.
- Limpiar vistas de rachas/porcentaje no usadas.
- Retirar rueda/código cyber obsoleto.
- Compactar operaciones según retención.

Migración preparada: `20260830081517_contract_cleanup_after_cutover.sql`.

Requiere aprobación separada, backup y rollback restaurando desde backup/compat migration.

Estado de preflight (30 de agosto de 2026):

- [x] Inventario de contratos y consumidores heredados.
- [x] Cliente y worker cortados de `habit_entries`, `linked_goal_id` y `reminder_days`.
- [x] Backup lógico portable con checksum verificado.
- [x] Restore aislado con hashes de datos y catálogo idénticos.
- [x] Suite de 229 pruebas, 104 aserciones pgTAP y build PWA después del corte del runtime.
- [x] RPC v2 sin escritura de `reminder_days` en la migración preparada.
- [x] Migración y down migration probadas sobre la copia restaurada.
- [ ] Política de retención del ledger definida.
- [x] Limpieza física aprobada y aplicada al esquema Supabase local.

Evidencia y procedimiento: `../phases/PHASE6_CONTRACT_CLEANUP_PREFLIGHT.md`.

## Integración futura de IA — post-MVP

Fase aislada después de validar el producto sin IA:

- Caso único inicial: reescribir una apertura o resumen, bajo solicitud.
- Endpoint Edge, salida JSON schema, datos minimizados, `store:false` cuando aplique.
- Fallback local instantáneo.
- Eval de seguridad, tono, datos sensibles, coste y latencia.
- Sin escritura autónoma ni scheduling autónomo.
- Aprobación de privacidad y proveedor antes de piloto.

## Dependencias entre fases

```text
F0 seguridad/preservación
  └── F1 relaciones/meta
       └── F2 agenda/log
            ├── F3 cierre/recompensas
            └── F4 notificaciones
                  └── F5 sync/piloto
                       └── F6 limpieza
```

F3 y F4 pueden desarrollarse en paralelo solo después del contrato de agenda/log, pero no desplegarse sin las mismas reglas de sensibilidad y sync.

## Lista exacta de archivos existentes a modificar

La lista es el alcance propuesto completo; cada fase toca solo su subconjunto. Si el diseño aprobado cambia el alcance, se actualiza este contrato antes de editar.

### Shell, rutas y PWA

- `src/App.vue`
- `src/main.js`
- `src/router/index.js`
- `src/components/layout/AppShell.vue`
- `src/components/aurora/navigation/AuroraBottomNav.vue`
- `vite.config.js`
- `src/sw.js`
- `index.html`

### Hoy, hábitos y registro

- `src/pages/DashboardPage.vue`
- `src/pages/HabitDetailPage.vue`
- `src/pages/HabitsSettingsPage.vue`
- `src/components/habits/CreateHabitModal.vue`
- `src/components/habits/LogModal.vue`
- `src/components/habits/DayCloseModal.vue`
- `src/components/habits/HabitRow.vue`
- `src/components/habits/DayGrid.vue`
- `src/components/habits/DayCell.vue`
- `src/components/aurora/habits/AuroraHabitCard.vue`
- `src/components/aurora/habits/AuroraHabitList.vue`
- `src/components/aurora/habits/AuroraQuickLog.vue`
- `src/components/aurora/habits/AuroraNextStepCard.vue`
- `src/components/aurora/habits/AuroraReturnCard.vue`
- `src/components/aurora/goals/AuroraGoalFocus.vue`
- `src/components/aurora/progress/AuroraWeeklyPath.vue`

### Metas

- `src/pages/goals/GoalsPage.vue`
- `src/pages/goals/GoalDetailPage.vue`
- `src/pages/goals/CreateGoalPage.vue`
- `src/pages/goals/GoalSessionPage.vue`
- `src/pages/goals/GoalsSettingsPage.vue`
- `src/components/goals/DashboardGoalFocus.vue`
- `src/components/goals/GoalActionForm.vue`
- `src/components/goals/GoalProgressTimeline.vue`
- `src/components/goals/GoalsHorizonSection.vue`
- `src/features/goals/domain.js`
- `src/stores/goals.js`
- `src/stores/goalsSync.js`
- `src/services/local/goals.database.js`
- `src/services/local/goals.repository.js`
- `src/services/supabase/goals.service.js`

### Recompensas, historial y comunicación

- `src/pages/RewardsPage.vue`
- `src/pages/ProgressPage.vue`
- `src/components/rewards/RewardCelebrationHost.vue`
- `src/components/rewards/RewardForm.vue`
- `src/stores/rewards.js`
- `src/features/copy/catalog.js`
- `src/features/copy/engine.js`
- `src/composables/useCopy.js`
- `supabase/functions/_shared/copy.ts`

`src/components/rewards/RewardWheel.vue`, `src/components/rewards/wheel.js` y `src/composables/useRewardWheelGate.js` se mantienen durante compatibilidad y solo se retiran en F6.

### Notificaciones, settings y privacidad

- `src/services/notifications.service.js`
- `src/services/push.service.js`
- `src/components/notifications/InAppNotificationHost.vue`
- `src/pages/NotificationsDiagnosticPage.vue`
- `src/pages/SettingsPage.vue`
- `src/stores/settings.js`
- `src/stores/auth.js`
- `src/services/storage.js`
- `src/services/supabase/settings.service.js`
- `src/services/supabase/sync.service.js`
- `src/services/supabase/habits.service.js`
- `supabase/functions/send-reminders/index.ts`
- `supabase/PUSH_SETUP.md`

### Diseño y accesibilidad

- `src/assets/aurora.css`
- `src/assets/main.css`
- `tailwind.config.js`
- `src/components/aurora/forms/AuroraInput.vue`
- `src/components/aurora/surfaces/AuroraModal.vue`
- `src/components/aurora/surfaces/AuroraBottomSheet.vue`
- `src/composables/useModalFocus.js`
- `src/components/help/HelpMascotButton.vue`

Activos existentes que se referenciarían sin modificarlos: `public/brand/traker-logo.svg` y `public/brand/traker-logo-mono.svg`. `public/brand/koto-logo.svg` deja de referenciarse desde el shell, pero no se borra en el MVP.

### Stores base

- `src/stores/habits.js`
- `src/stores/app.js`
- `src/plugins/persistence.js`

## Lista exacta de archivos nuevos propuestos

### Dominio y repositorios

- `src/features/today/domain.js`
- `src/features/schedules/domain.js`
- `src/features/rewards/domain.js`
- `src/features/checkins/domain.js`
- `src/features/notifications/planner.js`
- `src/services/local/traker.database.js`
- `src/services/local/habits.repository.js`
- `src/services/local/today.repository.js`
- `src/services/local/rewards.repository.js`
- `src/services/local/checkins.repository.js`
- `src/services/local/outbox.repository.js`
- `src/services/supabase/sync-v2.service.js`
- `src/stores/today.js`
- `src/stores/checkins.js`
- `src/stores/sync.js`

### UI

- `src/pages/TodayPage.vue`
- `src/pages/HistoryPage.vue`
- `src/components/today/TodayOpening.vue`
- `src/components/today/FocusGoalCard.vue`
- `src/components/today/EssentialAgenda.vue`
- `src/components/today/AgendaItem.vue`
- `src/components/today/FlexibleGroupPicker.vue`
- `src/components/today/QuickLogControl.vue`
- `src/components/today/NearbyReward.vue`
- `src/components/today/HorizonJourney.vue`
- `src/components/today/DayCloseSheet.vue`
- `src/components/today/OptionalCheckIn.vue`
- `src/components/system/SyncStatus.vue`
- `src/components/system/ContextIllustration.vue`
- `src/components/system/SensitiveContextNotice.vue`

### Shared server/contracts

- `src/features/copy/catalog.schema.js`
- `supabase/functions/_shared/copy.generated.ts`
- `supabase/functions/_shared/notification-planner.ts`
- `supabase/functions/process-notification-jobs/index.ts`

### Pruebas

- `src/features/today/domain.test.js`
- `src/features/schedules/domain.test.js`
- `src/features/rewards/domain.test.js`
- `src/features/notifications/planner.test.js`
- `src/services/local/traker.database.test.js`
- `src/services/supabase/sync-v2.service.test.js`
- `src/components/today/today-components.test.js`
- `src/tests/accessibility/today.a11y.test.js`
- `e2e/today-responsive.spec.js`
- `e2e/offline-sync.spec.js`
- `e2e/two-device-conflicts.spec.js`
- `e2e/notifications.spec.js`
- `supabase/tests/rls.test.sql`
- `supabase/tests/migrations.test.sql`

### Activos, solo tras aprobación visual

- `public/illustrations/opening.webp`
- `public/illustrations/return.webp`
- `public/illustrations/focus.webp`
- `public/illustrations/sufficient.webp`
- `public/illustrations/offline.webp`
- `public/illustrations/error.webp`
- `public/illustrations/habits/movement-pilot.webp`
- `public/illustrations/manifest.json`

## Lista original propuesta y ejecución real

Ejecución local real:

- `supabase/migrations/20260829053218_integrated_personal_model.sql` — consolida de forma aditiva el alcance de `010`–`015` para el entorno personal vacío.
- `supabase/tests/integrated_personal_model.test.sql` — contrato de 31 pruebas transaccionales.

La lista que sigue queda como desglose histórico del plan, no como archivos pendientes de crear en esta rama:

- `supabase/migrations/010_security_preflight_and_view_hardening.sql`
- `supabase/migrations/011_goal_milestones_and_habit_goal_links.sql`
- `supabase/migrations/012_habit_schedules_flexible_groups_and_log_v2.sql`
- `supabase/migrations/013_daily_checkins_rewards_and_privacy.sql`
- `supabase/migrations/014_notification_jobs_deliveries_and_preferences.sql`
- `supabase/migrations/015_sync_v2_backfill_and_compatibility.sql`
- `supabase/migrations/016_contract_cleanup_after_cutover.sql` (fuera del MVP inicial)

Scripts de rollback de ensayo:

- `supabase/rollback/010_security_preflight_and_view_hardening_down.sql`
- `supabase/rollback/011_goal_milestones_and_habit_goal_links_down.sql`
- `supabase/rollback/012_habit_schedules_flexible_groups_and_log_v2_down.sql`
- `supabase/rollback/013_daily_checkins_rewards_and_privacy_down.sql`
- `supabase/rollback/014_notification_jobs_deliveries_and_preferences_down.sql`
- `supabase/rollback/015_sync_v2_backfill_and_compatibility_down.sql`
- `supabase/rollback/016_contract_cleanup_after_cutover_down.sql`

## Estrategia de rollback

Por fase:

1. Feature flag vuelve al lector/UI anterior.
2. Writers nuevos se detienen, outbox queda preservado.
3. Migración compensatoria desactiva policies/RPC nuevas o retira objetos aditivos solo si no contienen datos exclusivos.
4. Si contienen datos, no dropear: restaurar app anterior con dual-read y exportar/reconciliar.
5. Para cambio destructivo F6: restore probado/point-in-time + migración forward reparadora; no confiar en `down` automático.

## Matriz de pruebas

- Unidad: dominios de agenda, calendarios, copy, planner, conflictos.
- Componente: 1–2 toques, sheets, foco, estados.
- Integración: IndexedDB/outbox, pull/push, undo, backfill.
- DB: RLS A/B/anon, grants, constraints, idempotencia, locks.
- E2E: 24 escenarios y anchos 320/375/430/768/1024/1280/1440.
- Dispositivo: iOS instalado/no instalado, Android, escritorio.
- Accesibilidad: axe + teclado manual + VoiceOver/TalkBack/NVDA o equivalente.
- Performance: LCP, INP, CLS, bundle, memoria de listas y SW.
- Resiliencia: offline, 5xx/429, reloj/timezone/DST, dos dispositivos.
- Migración: snapshot anterior, apply, conteos/hash, rollback/cutover.

## Riesgos principales

| Prioridad | Riesgo | Mitigación |
|---|---|---|
| Crítico | Fuga por vista/cache | F0 obligatoria y pruebas cross-user |
| Crítico | Pérdida/mapeo incorrecto de logs | preservar legacy + reporte de calidad + aprobación |
| Crítico | Divergencia multi-dispositivo | sync v2, idempotencia y pruebas con dos clientes |
| Alto | Scope excesivo | feature flags y MVP por verticales |
| Alto | Agenda oculta algo importante | reglas explicables + “También podrías” + control usuario |
| Alto | Humor causa daño | opt-in, matriz sensible y fallback neutral |
| Alto | Push se vuelve spam | presupuesto y planner capaz de suprimir |
| Alto | Check-in expone datos | local-first/consentimiento y lock-screen privacy |
| Medio | Aurora pierde coherencia | tokens únicos y aprobación visual temprana |
| Medio | Activos perjudican performance | piloto y presupuesto antes de escalar |
| Medio | Documentación deriva | estos TRAKER_* como ADR de dirección y actualización por fase |

## Decisiones humanas antes de Etapa 2

1. Aprobar el MVP y orden de fases.
2. Autorizar primero F0, sin asumir autorización para F1–F6.
3. Navegación y terminología.
4. Mapeo de logs heredados.
5. Semántica de cierre/reformulación.
6. Una o hasta tres metas en foco.
7. Frecuencias MVP.
8. Check-in local/cloud por defecto.
9. Tono por defecto y límites de carrilla.
10. Eliminar rueda y puntos del flujo principal.
11. Personaje actual vs motivo abstracto.
12. Presupuesto/privacidad de notificaciones.
13. Métricas, consentimiento y retención.
14. Ventana de compatibilidad antes de F6.
15. Entorno staging, backup y plan de despliegue Supabase.

## Definición de MVP terminado

- Todos los datos actuales preservados y exportables.
- Seguridad crítica cerrada.
- Un hábito N:M aparece una vez.
- Frecuencia semanal y grupo alternable funcionan offline.
- Hoy muestra una meta en foco, tres horizontes y ≤3 esenciales.
- Registro en 1–2 toques, con parcial y contexto opcional.
- Cierre/recompensa no dependen de completar todo.
- Apertura/cierre por push respetan presupuesto y privacidad.
- Dos dispositivos convergen o presentan conflicto explícito.
- 24 escenarios, responsive y accesibilidad tienen evidencia.
- IA ausente sin degradar ninguna función.
