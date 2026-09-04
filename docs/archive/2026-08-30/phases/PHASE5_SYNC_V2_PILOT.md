# Fase 5 — piloto de sincronización v2

## Estado seguro

- `VITE_SYNC_V2_PILOT` está apagada por defecto.
- El lector actual (`localStorage` y `traker-goals`) sigue siendo autoritativo.
- `traker-v2` es una copia aditiva; desactivar la bandera revierte el piloto sin borrar datos.
- Ninguna migración ni comando de esta fase elimina datos remotos.
- Con la bandera local activa, hábitos, logs y claims de recompensa pasan primero por el outbox/RPC v2; la escritura heredada queda como compatibilidad posterior y nunca puede sobreescribir un conflicto v2.
- Check-ins, cierres, definiciones de recompensa y demás dominios no soportados por el RPC continúan usando su transporte heredado.

## Preparación local

1. Levantar Supabase local y aplicar las migraciones pendientes.
2. Ejecutar `supabase test db --local` desde una ruta compartida con Docker.
3. Iniciar la aplicación con `VITE_SYNC_V2_PILOT=true` y `VITE_SUPABASE_URL` apuntando a `localhost` o `127.0.0.1`; cualquier otro endpoint oculta la ruta y queda bloqueado por el diagnóstico.
4. Abrir `/settings/sync-v2-pilot` y esperar a que `local-v2-backfill` figure como `completed`.
5. No avanzar mientras haya huecos del backfill, operaciones pendientes o un reporte incompleto. Sólo `converged: true` habilita la revisión humana.

El reporte sólo incluye conteos, estado de migración, operaciones pendientes y cursores; nunca incluye nombres, notas ni contenido de check-ins.

## Matriz de dos dispositivos

La pantalla del piloto registra estado y evidencia. El adaptador dual-write/pull ya conecta las acciones cotidianas soportadas cuando la bandera está activa: conserva una operación estable en IndexedDB, envía una sola versión por entidad en cada ronda y sondea cambios de otros perfiles cada 12 segundos, al recuperar foco y al volver a estar visible. Un restore offline conserva el tombstone y reaparece como `queued` sin botón después de recargar; tanto el bridge v2 como la cola heredada evitan duplicarlo por hábito. El ledger sólo señala cambios; el contenido se vuelve a leer desde tablas owner-scoped protegidas por RLS.

La matriz automatizada valida el protocolo mediante `npm run pilot:sync-v2`. La prueba física desde dos perfiles visibles sigue siendo obligatoria antes del cutover.

Ejecutar en dos perfiles de navegador distintos con el mismo usuario:

| Caso | Acción | Resultado obligatorio |
| --- | --- | --- |
| Metadatos | Editar nombre o mínimo | Versión nueva o conflicto explícito |
| Pausa | Pausar en A y sincronizar B | B recibe el estado pausado |
| Log diario | Registrar la misma ocurrencia en A y B | Queda una ocurrencia; el segundo recibe conflicto |
| Borrar/restaurar | Borrar en A, editar obsoleto en B, restaurar | Gana el tombstone; restaurar crea otra versión |
| Recompensa | Reclamar el mismo periodo en A y B | Queda un solo claim |

Registrar además tiempo de sincronización, operaciones pendientes, errores de accesibilidad y cualquier pérdida pre/post exportación.
Las marcas se guardan en IndexedDB con su hora y se incluyen en la evidencia exportada; reiniciar las marcas elimina únicamente esa sesión manual.

## Cierre físico pendiente

### Restore durante desconexión

Estado local del 30 de agosto de 2026: aprobado. La cola sobrevivió una recarga sin duplicar el restore; al reactivar el gateway, Postgres aplicó una sola operación con `baseVersion = 7`, creó la versión `8` activa y limpió `deletedAt`. Los pasos se conservan para futuras regresiones.

Antes de detener nada, confirmar el nombre exacto del gateway y que pertenece a `traker-local`. En esta instalación es `supabase_kong_traker-local`; versiones nuevas de Supabase pueden usar Envoy, por lo que no se debe copiar el nombre a ciegas.

1. En A, crear o elegir un hábito activo y confirmar que B también lo muestra.
2. Borrarlo en A con el gateway disponible; actualizar B y confirmar que el tombstone gana.
3. Detener únicamente el gateway de `traker-local`, nunca la base ni contenedores de otro proyecto.
4. En A, abrir `/settings/sync-v2-pilot`, actualizar y pulsar **Restaurar hábito**.
5. Recargar A mientras el gateway sigue detenido. Debe mostrarse **Restauración guardada en la cola local**, sin volver a ofrecer el botón y con una sola operación restore.
6. Volver a iniciar inmediatamente el mismo gateway, recuperar foco en A y esperar un ciclo de sondeo de hasta 12 segundos.
7. Actualizar B. El hábito debe aparecer activo una sola vez y con una versión posterior al tombstone.
8. Si cualquier paso falla, volver a iniciar el gateway antes de diagnosticar. No dejar el entorno deliberadamente desconectado.

### Responsive, zoom y accesibilidad

Usar la barra de dispositivos de Chrome DevTools y repetir la pantalla del piloto en `320`, `375`, `430`, `768`, `1024`, `1280` y `1440` px. En cada ancho comprobar:

- ausencia de scroll horizontal;
- encabezado, estado, matriz y exportación sin texto cortado;
- botones y filas táctiles de al menos 44 px;
- valores y etiquetas distinguibles sin depender sólo del color;
- acción principal y foco visibles sin superposición con el personaje de ayuda.

Después:

1. En escritorio, aplicar zoom del navegador al 200 % y repetir la navegación completa con `Tab` y `Shift+Tab`.
2. Confirmar un foco visible en Ajustes, Actualizar, Reiniciar marcas, los cinco checkboxes y Exportar evidencia.
3. Activar VoiceOver (`⌘ F5`) o un lector equivalente. Verificar un `h1`, tres regiones etiquetadas, sus `h2`, nombres completos y estado marcado/no marcado de los cinco casos.
4. Emular `prefers-reduced-motion: reduce` desde DevTools y confirmar que actualizar no conserva rotación perceptible ni transiciones espaciales largas.
5. Exportar la evidencia después de completar las comprobaciones y anotar ancho, zoom, lector, resultado y hora.

## Salida y rollback

1. Apagar `VITE_SYNC_V2_PILOT`.
2. Confirmar que el lector heredado conserva hábitos, logs, metas, check-ins y recompensas.
3. Si se necesita limpiar sólo el piloto local, usar `deleteV2PilotData()`; preserva `localStorage`.
4. El rollback SQL manual retira los RPC y el índice del piloto, pero conserva filas canónicas y su procedencia.

El corte definitivo y la eliminación de campos heredados pertenecen a Fase 6 y requieren una decisión humana explícita después del piloto.

Los resultados automatizados más recientes están en `PHASE5_SYNC_V2_PILOT_RESULTS.md`.
