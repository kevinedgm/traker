# Traker — Estado actual

Fecha de auditoría: 28 de agosto de 2026  
Alcance: Etapa 1, lectura del repositorio y verificación local. No describe necesariamente el estado desplegado de Supabase.

## Convenciones

Cada hallazgo incluye procedencia y prioridad:

- **Evidencia del proyecto**: comportamiento o estructura comprobados en el repositorio.
- **Recomendación técnica**: acción propuesta, todavía no implementada.
- **Hipótesis de producto**: supuesto que debe validarse con personas usuarias.
- **Preferencia visual**: dirección de diseño, no requisito técnico.
- **Decisión que requiere validación**: elección humana previa a implementación.

Prioridades: **Crítico**, **Alto**, **Medio**, **Bajo**.

## Resumen del estado

Traker ya no es un prototipo vacío. Tiene una PWA Vue funcional, un sistema visual Aurora 2 coherente, hábitos locales con sincronización opcional, un dominio de metas offline-first más reciente, recompensas, notificaciones locales y Web Push, un motor de mensajes con pruebas y una suite automatizada que pasa. La base sirve.

El problema principal es que conviven tres generaciones de producto:

1. Un tracker original basado en retos de duración y niveles de cumplimiento.
2. Un dominio de metas más sólido, aislado en IndexedDB y Supabase.
3. Una dirección Aurora/acompañante que todavía no unifica agenda, cierre, recompensas, notificaciones y sincronización.

La siguiente etapa no debe añadir más módulos en paralelo. Debe consolidar repositorios, semántica diaria y contratos de sincronización sin perder datos.

## Stack

**[Evidencia del proyecto · Bajo]**

- Vue 3.5, Pinia 3 y Vue Router 4.
- Vite 8, Tailwind CSS 3 y CSS propio.
- Supabase JS 2.106 para Auth, Postgres y funciones.
- IndexedDB mediante `idb`; `localStorage` para dominios heredados.
- `vite-plugin-pwa` con `injectManifest` y Service Worker propio.
- Lucide para iconografía funcional.
- Vitest, Vue Test Utils, Happy DOM y `fake-indexeddb`.
- Puppeteer está instalado como dependencia de desarrollo, pero no hay una suite E2E visible que cubra los escenarios críticos.

## Arquitectura de aplicación

**[Evidencia del proyecto · Alto]**

La arquitectura es modular por funcionalidades, pero no por repositorio común:

```text
Vue pages/components
├── Pinia habits store ── localStorage ── sync queue ── Supabase
├── Pinia goals store  ── IndexedDB ───── outbox/RPC ── Supabase
├── rewards store      ── localStorage
├── settings/auth      ── localStorage + Supabase
├── notification scheduler in-process + Web Push
└── copy engine        ── catálogo en código
```

Esto permite operación local, pero exportar, borrar, sincronizar y resolver conflictos tiene reglas distintas por dominio.

**[Recomendación técnica · Alto]** Consolidar gradualmente hábitos, metas, recompensas, registros diarios y colas en una capa de repositorios IndexedDB compartida. No hacer una reescritura de una sola vez.

## Navegación actual

**[Evidencia del proyecto · Medio]**

Rutas principales:

- `/`: Hoy.
- `/habits` y `/habit/:id`: hábitos.
- `/goals`, `/goals/new`, `/goals/:id`, `/goals/:id/session`: metas y sesiones.
- `/progress`: progreso.
- `/rewards`: recompensas.
- `/settings`, `/settings/goals`, `/settings/notifications`: configuración.
- `/login`: autenticación.

La navegación visible ofrece hasta cinco destinos primarios: Hoy, Rumbo, Hábitos, Recompensas —«Premios» en la etiqueta móvil compacta— e Historial. Rumbo respeta `VITE_GOALS_ENABLED` y no aparece si su ruta está desactivada. Crear dejó de ocupar una pestaña y permanece como acción contextual dentro de cada dominio. `/progress` conserva su URL y se presenta como Historial en navegación; `/goals` se presenta como Rumbo.

**[Decisión implementada · 30 de agosto de 2026]** Ajustes dejó de competir con los dominios principales: en móvil se abre desde el perfil y en escritorio vive como utilidad separada al final del rail. Los estados activos distinguen hábitos, recompensas e historial y las rutas existentes permanecen compatibles.

## Dashboard actual

**[Evidencia del proyecto · Alto]**

El dashboard contiene saludo, fecha, tarjeta de regreso por inactividad, foco de meta, hasta dos horizontes, lista de hábitos activos y camino semanal. Tiene una base visual útil, pero:

- Trata todo hábito activo como pertinente para hoy.
- Considera el día resuelto solo cuando todos los hábitos están registrados.
- No deduplica por intención ni agenda según frecuencia real.
- Muestra como máximo dos horizontes, no los tres.
- No tiene apertura contextual de mañana, recompensa cercana ni cierre nocturno.
- Una meta extensa todavía puede llegar como objeto grande, en vez de traducirse siempre a siguiente resultado/acción.

**[Hipótesis de producto · Alto]** Mostrar un máximo visible de tres elementos esenciales y ocultar el resto detrás de “También podrías” reducirá presión percibida sin reducir avance significativo.

## Hábitos

**[Evidencia del proyecto · Crítico]** La serialización local del store omite `goalId`. Una relación hábito-meta puede desaparecer después de recargar desde almacenamiento local.

**[Evidencia del proyecto · Alto]** El modelo actual:

- Permite un solo `goalId`/`linked_goal_id`; no es muchos-a-muchos.
- Usa una duración de reto de 1–365 días.
- Guarda entradas por `day_number` relativo a la creación.
- Expresa cumplimiento en cinco niveles evaluativos.
- No modela frecuencia semanal/mensual, cada N días, ventanas, alternancia, mínimos/objetivo/extra ni pausas con historial.
- Conserva conceptos de racha y porcentaje por duración.

**[Evidencia del proyecto · Alto]** El modal de registro pide nivel, emoción, energía y nota en la misma operación. Esto eleva el costo de registrar y vuelve obligatorio un contexto que el nuevo producto quiere opcional.

**[Evidencia del proyecto · Alto]** Después del primer registro se puede abrir `RewardWheel` sin opciones de premio, dejando una rueda vacía/deshabilitada. Además, la rueda de casino contradice la dirección de recompensas elegidas y no compulsivas.

## Metas

**[Evidencia del proyecto · Medio]** El dominio de metas es la base técnica más madura:

- Horizonte corto/medio/largo como propiedad mutable.
- Motivo, resultado esperado y definición de terminada.
- Próxima acción, foco, cierre y reformulación.
- Acciones, sesiones y entradas de progreso.
- IndexedDB con outbox, versiones y operaciones UUID.
- RPC de sincronización con idempotencia y detección de conflicto.
- Consentimiento explícito para sincronizar.

**[Evidencia del proyecto · Alto]** Las tablas locales `stages` y `events` existen, pero no hay una experiencia completa de hitos/revisiones. La evidencia sigue siendo principalmente texto en progreso.

**[Evidencia del proyecto · Crítico]** El servicio de sincronización de metas empuja operaciones, pero no hay una hidratación remota equivalente. Un segundo dispositivo vacío no puede reconstruir de forma confiable sus metas desde Supabase.

**[Evidencia del proyecto · Alto]** La base no garantiza que `current_action_id` pertenezca a la misma meta; la aplicación intenta mantener esa integridad, pero Postgres no la impone.

## Recompensas

**[Evidencia del proyecto · Alto]** Las recompensas viven solo en `localStorage`. Una regla puede apuntar a un hábito o una meta, pero no agrupar varias fuentes ni expresar “dos de tres”, mínimo semanal, hito o día suficiente. No entran en sincronización, exportación ni borrado integral.

**[Recomendación técnica · Alto]** Sustituir la rueda por recompensas explícitas elegidas por la persona, con una regla comprensible y una reclamación consciente. La celebración puede existir, pero no debe depender de azar ni de puntos.

## Comunicación

**[Evidencia del proyecto · Medio]** El motor local de copy es una fortaleza: catálogo por evento/categoría/tono, interpolación acotada, historial anti-repetición, favoritos, frases desactivadas, fallback offline y pruebas deterministas.

**[Evidencia del proyecto · Alto]** Faltan eventos del nuevo ciclo: parcial, pausa/retorno/cierre de meta, sesión completada, resumen nocturno, error de sincronización y error genérico. También faltan dominios sensibles como familia, salud, finanzas y trabajo.

**[Evidencia del proyecto · Alto]** “Favorita” no aumenta la probabilidad de selección; y si desactivar frases vacía un grupo, el fallback puede volver a mostrar una frase desactivada.

**[Evidencia del proyecto · Alto]** La función de notificaciones mantiene un catálogo pequeño y separado, sin memoria anti-repetición. Una frase existente culpa por el día anterior, incompatible con “Regresar también es avanzar”.

## Notificaciones

**[Evidencia del proyecto · Crítico]** El ledger de recordatorios se reclama antes de enviar. Un fallo transitorio puede marcar el recordatorio como usado y bloquear el reintento del mismo día.

**[Evidencia del proyecto · Alto]** Hay dos motores:

- Scheduler local cada 30 segundos, fiable solo mientras la app está abierta.
- Edge Function periódica, capaz de enviar Web Push a usuarios autenticados.

Existen recordatorios de hábito, mañana e inactividad. No existe un cierre nocturno operativo, agrupación, límite diario, horas de silencio completas, privacidad de pantalla bloqueada, “hoy déjame en paz” ni historial de entrega/interacción.

**[Evidencia del proyecto · Alto]** `snooze` usa `setTimeout` en la ventana; se pierde si el proceso se cierra. Las acciones de notificación también pueden perderse si no había un cliente abierto: se abre la app, pero el comando no queda persistido.

**[Evidencia del proyecto · Alto]** La función lee todas las suscripciones con `service_role` y luego filtra. No hay paginación/cola de trabajos ni auditoría por entrega. Errores al leer preferencias o hábitos pueden quedar degradados silenciosamente.

**[Evidencia del proyecto · Medio]** El permiso se solicita bajo gesto del usuario y la suscripción remota requiere cuenta Supabase; usuarios locales no reciben un push fiable con la app cerrada.

## Supabase, RLS y seguridad

**[Evidencia del proyecto · Positivo]** Las tablas de usuario tienen RLS y políticas de propiedad. Las RPC de metas restringen `EXECUTE` y validan usuario/consentimiento.

**[Evidencia del proyecto · Crítico]** Las vistas heredadas `v_habit_streaks`, `v_habit_completion` y `v_emotion_frequency` se crean sin `security_invoker = true`. Las vistas de Postgres usan permisos del creador por defecto y pueden omitir las políticas de tablas subyacentes. Debe verificarse inmediatamente qué grants y versión están desplegados. La documentación oficial de Supabase recomienda `security_invoker` en Postgres 15+ o retirar acceso/mover la vista en versiones anteriores: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

**[Evidencia del proyecto · Crítico]** El Service Worker guarda respuestas autenticadas del REST de Supabase en Cache Storage mediante la URL. La clave de caché no representa de forma segura el usuario, así que una sesión posterior en el mismo dispositivo podría recibir datos de la anterior. Recomendación: no cachear respuestas autenticadas de Supabase; usar los repositorios locales explícitos.

**[Evidencia del proyecto · Medio]** Las políticas usan repetidamente `auth.uid()` sin `select` y no limitan siempre a `authenticated`. No es una fuga por sí solo, pero escala peor. Supabase recomienda `(select auth.uid())`, columnas de filtro indexadas y rol explícito: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

**[Evidencia del proyecto · Medio]** Faltan restricciones de dominio: horas inválidas pueden pasar la regex, `reminder_days` no tiene validación de rango, `estimate_bucket` no está restringido y algunas FK carecen de comprobaciones agregadas.

**[Recomendación técnica · Crítico]** La primera migración futura debe ser un preflight de seguridad, grants y vistas. Ninguna nueva entidad debe desplegarse antes.

## PWA y offline

**[Evidencia del proyecto · Positivo]** Hay manifest, iconos `any` y `maskable`, Service Worker propio, precache y páginas que trabajan offline mediante almacenamiento local.

**[Evidencia del proyecto · Medio]** El manifest todavía describe el producto como tracker de hábitos y conserva `theme_color: #0B0D10`, distinto del fondo Aurora actual. Fuerza orientación vertical.

**[Evidencia del proyecto · Alto]** La cola heredada de hábitos no usa una operación UUID estable. Si se borra algo sin sesión y después se inicia sesión, el orden pull/push puede resucitar datos remotos.

**[Evidencia del proyecto · Alto]** El sync de hábitos hace lecturas por hábito y escrituras en bucle; es un patrón N+1. Las colas de metas son mejores, pero los dominios no comparten política de conflictos.

## Privacidad, exportación y borrado

**[Evidencia del proyecto · Crítico]** `exportData()` exporta hábitos, settings, app y estado de copy en `localStorage`, pero no metas de IndexedDB, recompensas, outboxes, entregas ni datos futuros de check-in.

**[Evidencia del proyecto · Crítico]** `clearAll()` tampoco elimina todos esos dominios. La promesa de borrar datos es incompleta.

**[Evidencia del proyecto · Alto]** El PIN local se almacena como valor de conveniencia, no como cifrado. La interfaz no debe presentarlo como protección criptográfica.

## Diseño visual

**[Evidencia del proyecto · Positivo]** Aurora 2 ya aporta una identidad reconocible: fondos profundos, superficies translúcidas sobrias, verde como energía, coral como humano, Outfit + Instrument Serif, modos claro/oscuro y tokens semánticos. Debe conservarse.

**[Evidencia del proyecto · Medio]** Tailwind mantiene una capa heredada “cyber/neon” con Inter y keyframes propios. El detector estático encontró deriva de tamaños, radios y colores respecto a `DESIGN.md`, además de una transición de `height` que provoca trabajo de layout.

**[Evidencia del proyecto · Alto]** El shell usa `koto-logo.svg`, cuyo título interno dice “Koto logo”, aunque existen activos Traker. Es una inconsistencia de marca y accesibilidad.

**[Evidencia del proyecto · Medio]** La mascota actual es un bitmap transparente de 160×107, verde, simpático y con una sola expresión. Funciona como activo temporal, pero es demasiado pequeño y algo infantil para sostener estados contextuales en móvil, tablet y escritorio.

## Movimiento

**[Evidencia del proyecto · Alto]** Hay demasiada actividad persistente: flotación/brillo/pulsos del ayudante, respiración de una tarjeta, dibujo del camino semanal en cada montaje y una rueda de recompensa de 1.8 segundos. En una herramienta diaria para personas sensibles a distracción, este movimiento compite con la tarea.

**[Evidencia del proyecto · Alto]** Algunas transiciones de entrada llegan a 480–640 ms; son lentas para interacción recurrente.

**[Evidencia del proyecto · Medio]** `prefers-reduced-motion` fuerza casi toda animación a 0.01/1 ms. Evita movimiento, pero también elimina feedback útil. Debe existir una alternativa clara e instantánea por estado, no solo “velocidad extrema”.

## Responsive

**[Evidencia del proyecto · Alto]** La implementación tiene tres comportamientos efectivos:

- Móvil base.
- Desde 768 px: rail lateral y columna única centrada de ~640 px.
- Desde 1320 px: dos columnas sólo cuando existe contenido primario; sin foco/resumen primario, la columna de hábitos permanece centrada y no reserva espacio vacío.

El 30 de agosto Chrome confirmó 320, 375, 430, 768, 1024, 1280 y 1440 px sin overflow horizontal. La arquitectura cambia de navegación inferior a rail en 768 px y conserva lectura estrecha hasta que exista contenido que justifique la composición amplia.

**[Recomendación técnica · Alto]** Definir composición por capacidad, no por dispositivo: compacta (320–430), intermedia (768), amplia (1024) y editorial (1280–1440), con orden semántico estable.

## Accesibilidad

**[Evidencia del proyecto · Positivo]** Hay foco visible, tokens de contraste, uso amplio de botones nativos, nombres en iconos funcionales y una base de reduced motion.

**[Evidencia del proyecto · Crítico]** `useModalFocus` activa trampa e `inert` solo en `onMounted`. Si un modal persistente se abre después, puede no encerrar foco ni restaurarlo correctamente. Debe probarse con teclado y lector.

**[Corrección verificada · 30 de agosto de 2026]** `LockOverlay` integra `useModalFocus`, enfoca el teclado numérico, contiene Tab, conserva Escape, oculta `#app` y restaura scroll. La prueba física con lector de pantalla sigue pendiente.

**[Evidencia del proyecto · Alto]** `AuroraInput` no enlaza sistemáticamente pista/error con `aria-describedby` ni anuncia errores dinámicos.

**[Evidencia del proyecto · Alto]** Hay etiquetas de 9–11 px y estados de progreso que dependen demasiado de color/representación visual. El humor no siempre está acompañado de una instrucción funcional neutral.

**[Evidencia del proyecto · Medio]** El menú de mascota usa `role="menu"` sin implementar completamente el modelo de teclado esperado para menú.

## Insights y check-in

**[Evidencia del proyecto · Alto]** La pantalla de progreso usa hora de recordatorio como proxy de hora real de ejecución y puede afirmar que la mañana “da mejor tracción”. Esa correlación no está sustentada; con apenas dos muestras por grupo también presenta conclusiones demasiado seguras.

**[Recomendación técnica · Alto]** Separar recordatorio, ejecución y check-in. Presentar correlaciones descriptivas con tamaño de muestra y nunca causas ni recomendaciones clínicas.

## Pruebas y build

**[Evidencia del proyecto · Positivo]** Verificación realizada el 28-08-2026:

- 16 archivos de prueba aprobados.
- 93 pruebas aprobadas.
- Build de producción aprobado en un directorio temporal.
- 1,993 módulos transformados.
- Precache PWA: 99 entradas, ~999 KiB.

**[Evidencia del proyecto · Medio]** El build advierte que una importación dinámica de `goals.js` no divide el bundle porque el mismo módulo ya se importa estáticamente. El chunk principal y el cliente Supabase rondan 218 KiB y 200 KiB sin comprimir, respectivamente.

**[Actualización verificada · 30 de agosto de 2026]** La base local ya cuenta con 104 pruebas pgTAP para RLS/grants, modelo integrado, worker y Sync v2; las 14 migraciones están alineadas y la matriz lógica de dos dispositivos pasó 5/5. Siguen fuera de cobertura completa Web Push real, dispositivos iOS/Android, lector físico y el despliegue remoto.

## Documentación y estado del árbol

**[Evidencia del proyecto · Medio]** `PROJECT_ANALYSIS.md` quedó desactualizado: describe ausencia de pruebas y dependencias que ya existen. `PRODUCT.md`, `DESIGN.md` y los documentos recientes de metas contienen decisiones valiosas, pero también contratos que chocan con el nuevo brief, por ejemplo conservar la navegación actual o los cinco niveles de hábito.

**[Evidencia del proyecto · Alto]** El árbol ya tenía cambios sin confirmar antes de esta auditoría, incluidas migraciones 004–009 y trabajo de metas. Se trataron como trabajo del usuario y no se modificaron.

## Deuda técnica priorizada

| Prioridad | Hallazgo | Tratamiento propuesto |
|---|---|---|
| Crítico | Vistas potencialmente `security_definer` | Preflight de grants/RLS y hardening antes de nuevas tablas |
| Crítico | Cache de REST autenticado no aislada por usuario | Retirar runtime caching de Supabase |
| Crítico | Exportación/borrado incompletos | Inventario unificado de datos y pruebas de privacidad |
| Crítico | Metas no hidratan desde servidor | Pull inicial y sync bidireccional probado |
| Crítico | `goalId` se pierde al serializar hábito | Compatibilidad inmediata y backfill verificable |
| Crítico | Trampa de foco no reacciona a apertura | Corregir contrato de modal y pruebas |
| Alto | Modelos locales fragmentados | Repositorios IndexedDB + outbox compartido por fases |
| Alto | Agenda equivale a todos los hábitos | Motor de ocurrencias y capacidad diaria |
| Alto | Recordatorio se consume antes de entregarse | Jobs y entregas con estados/reintentos |
| Alto | Registro costoso y evaluativo | Sí / A medias / No; contexto opcional |
| Alto | Responsive intermedio ausente | Composiciones 320–1440 verificadas |
| Medio | Tokens Aurora/Tailwind divergentes | Consolidar tokens y eliminar capa cyber al migrar |
| Medio | Movimiento persistente | Presupuesto de movimiento e interrupción |
| Medio | Copy local/servidor duplicado | Catálogo versionado compartido |
| Bajo | Warnings de bundling | Optimización después del MVP funcional |

## Límites de esta auditoría

- Supabase local sí fue auditado en vivo: contenedores saludables, 14 migraciones alineadas, lint limpio, advisor sin bloqueos, pgTAP 104/104 y backfill sin faltantes. No se consultó ni modificó una instancia remota.
- El cutover de Sync v2 quedó activo sólo en `.env.local`: exige URL Docker local, usa clave publicable y mantiene apagado el ejemplo compartido. Los lectores heredados y el rollback siguen disponibles; Fase 6 permanece bloqueada.
- La primera observación posterior al cutover pasó los ocho escenarios aislados y dejó la base sin usuarios temporales ni huecos. La sesión visible autenticada terminó en `Convergencia lista`: el único registro restante era un conflicto de ocurrencia ya representado por el log canónico, se archivó como evidencia `acknowledged` sin borrarlo y el contador quedó en `0`. La copia v2 queda además vinculada por huella irreversible a una sola cuenta; otra cuenta no puede ejecutar pull, push, colas, settings ni registrar notificaciones sobre ella.
- Chrome quedó disponible posteriormente y permitió la QA responsive de los siete anchos objetivo y zoom nativo a 200 %. Dispositivos físicos, lector real, movimiento reducido activado y red lenta permanecen diferidos.
- La implementación sí evolucionó después de la auditoría inicial; el estado vigente se registra en `TRAKER_IMPLEMENTATION_PLAN.md` y en los documentos de resultados por fase.
