# Traker — UX de Hoy

## Objetivo del dashboard

Hoy debe ser un panel de decisión y retorno, no un resumen de toda la base. Su éxito ocurre cuando la persona entiende qué importa, elige una acción y puede salir.

**[Hipótesis de producto · Alto]** La apertura ideal permite registrar o iniciar algo en menos de 20 segundos sin obligar a leer estadísticas.

## Arquitectura de información adoptada

### Navegación primaria

**[Decisión de producto · 30 de agosto de 2026]**

- **Hoy:** apertura, foco, agenda y cierre.
- **Rumbo:** metas, horizontes, hitos y acciones.
- **Hábitos:** biblioteca, calendarios y grupos flexibles.
- **Recompensas:** catálogo personal, reglas y reclamaciones; la etiqueta móvil compacta es «Premios» y el nombre accesible completo permanece «Recompensas».
- **Historial:** registros, check-ins e insights descriptivos.
- **Ajustes:** accesible desde el perfil en móvil y como utilidad separada al final del rail de escritorio; no ocupa un destino primario.

En móvil caben cinco destinos. Rumbo aparece cuando `VITE_GOALS_ENABLED=true`; con la bandera apagada, los otros cuatro destinos conservan la misma jerarquía sin enlazar a una ruta inexistente. Crear no ocupa una pestaña: aparece como acción contextual dentro de Rumbo/Hábitos/Recompensas. Las rutas existentes se conservan: Rumbo usa `/goals`, Historial usa `/progress` y los demás destinos mantienen sus URL canónicas.

## Jerarquía de Hoy

Orden semántico recomendado:

1. Apertura contextual.
2. Meta en foco y motivo.
3. Agenda esencial.
4. Recompensa cercana.
5. Trayectoria de tres horizontes.
6. Opcionales/“También podrías”.
7. Cierre del día cuando corresponde.

**[Decisión que requiere validación · Medio]** El brief sugiere mostrar horizontes antes de agenda. Para móvil recomiendo agenda antes porque es la decisión inmediata; en escritorio ambos pueden coexistir. Validar con una prueba de comprensión.

## Wireframe móvil (320–430 px)

```text
┌────────────────────────────────┐
│ Traker                28 AGO   │
│ Buenas. No hay que resolverlo  │
│ todo. [carrilla opcional]      │
├────────────────────────────────┤
│ EN FOCO                         │
│ TOEFL ≥ 450                     │
│ “Para abrir opciones remotas”  │
│ [Empezar 10 min]                │
├────────────────────────────────┤
│ HOY · 2 ESENCIALES              │
│ ○ Practicar inglés · mínima 10m│
│ ◐ Movimiento · elige una       │
│ [Ver opciones]                  │
├────────────────────────────────┤
│ CERCA                           │
│ 2 de 3 sesiones → tarde libre  │
├────────────────────────────────┤
│ RUMBO                           │
│ Corto ●  Medio ◐  Largo ○      │
│ [Abrir trayectoria]             │
├────────────────────────────────┤
│ También podrías (3)             │
└────────────────────────────────┘
│ Hoy Rumbo Hábitos Premios Hist. │
└────────────────────────────────┘
```

Reglas:

- Un CTA primario visible a la vez.
- Texto mínimo a 16 px; metadatos nunca menores de 12–13 px.
- Área táctil mínima 44×44 CSS px.
- En 320 px se ocultan adornos, no significado ni acciones.
- La ilustración de apertura es pequeña o se omite si empuja la agenda fuera del primer viewport.

## Wireframe tablet (768 px)

```text
┌────────────────────────────────────────────┐
│ Apertura + fecha                           │
├───────────────────┬────────────────────────┤
│ Foco + siguiente  │ Agenda esencial        │
│ acción             │ (hasta 3)              │
├───────────────────┴────────────────────────┤
│ Trayectoria: corto — medio — largo          │
├───────────────────┬────────────────────────┤
│ Recompensa cerca  │ También podrías / cierre│
└───────────────────┴────────────────────────┘
```

No debe ser una columna móvil centrada. Usa dos zonas de decisión y una trayectoria completa.

## Wireframe 1024 px

```text
┌──────────┬──────────────────────────┬─────────────┐
│ rail/nav │ Apertura + foco          │ Recompensa  │
│ etiquet. │ Agenda esencial          │ Check-in    │
│          │ Trayectoria 3 horizontes│ Opcionales  │
└──────────┴──────────────────────────┴─────────────┘
```

El panel derecho no debe convertirse en vertedero. Solo muestra una capa secundaria contextual.

## Wireframe 1280–1440 px

- Contenedor editorial máximo de 1200–1280 px.
- Rail con texto, no solo iconos crípticos.
- Grid de 12 columnas con foco/agenda dominantes.
- Ilustración contextual puede ocupar 3–4 columnas si aporta estado.
- No estirar tarjetas hasta los bordes.
- Historial y configuración se benefician de panel maestro/detalle, pero Hoy conserva lectura vertical.

## Componentes y contratos

### Apertura

Muestra hora del día, fecha y una frase local. Si hay ausencia, reemplaza saludo genérico por tarjeta de regreso.

Copys:

- Neutral: “Hoy basta con mover una cosa que importe.”
- Carrilla baja: “Plan de hoy: poquitas cosas, pero que sí cuenten.”
- Regreso: “No tienes que ponerte al corriente. Elige por dónde volver.”

### Meta en foco

- Una meta dominante.
- Horizonte y motivo breve.
- Siguiente acción o estado “necesita siguiente acción”.
- CTA: Empezar, elegir acción o revisar.
- Cambiar foco es secundario.

### Agenda esencial

- Máximo tres filas expandidas.
- Un hábito ligado a varias metas aparece una vez y muestra “apoya 2 metas”.
- Estados no dependen del color: icono, texto y forma.
- Sí/A medias/No están disponibles con un toque o menú breve.
- La versión mínima es acción de primera clase, no excepción vergonzosa.

### Bloque alternable

Muestra el nombre del bloque y avance de periodo (“1 de 3 elecciones”). Solo despliega alternativas cuando se pulsa. Registrar una opción actualiza el grupo y sus metas sin duplicar filas.

### Recompensa cercana

Explica condición y beneficio: “2 de 3 sesiones. Falta una para reclamar tarde de película.” No usa rueda, jackpot ni cuenta regresiva manipuladora.

### Trayectoria

Tres nodos siempre presentes: corto, medio y largo. Cada nodo muestra máximo una meta representativa y su estado. Abrir trayectoria conduce a Rumbo.

### Cierre

Se ofrece cuando la persona lo pide, completa sus mínimos o llega su ventana de cierre. Resume lo movido y pregunta carga/energía opcional. Nunca enumera faltantes como deuda.

## Estados de la página

### Primera vez

- Explica en una frase el modelo.
- CTA único: crear primera meta o importar/conservar hábitos existentes.
- No pide notificaciones, tono, emoción y recompensas en el mismo flujo.

### Sin meta

- Permite usar hábitos sin bloquear.
- Propone crear rumbo cuando la persona quiera.

### Sin agenda

Copy: “Hoy no hay mínimos programados. Puedes elegir algo opcional o cerrar suficiente.”

### Sobrecarga

- Mantiene tres esenciales.
- Agrupa el resto.
- Ofrece “Reducir hoy”, “Usar versiones mínimas” y “Silenciar por hoy”.

### Offline

- Banner discreto: “Sin conexión. Tus registros se guardarán aquí.”
- Registro funciona igual.
- Estado de sincronización accesible, no modal bloqueante.

### Error de sincronización

- No revierte la acción local.
- Dice “Guardado en este dispositivo; intentaremos sincronizar.”
- CTA secundario: ver detalles/reintentar.

### Regreso

- Una tarjeta, una decisión.
- Opciones: Retomar mínimo, revisar plan, pausar algo.
- Nunca preselecciona todas las tareas perdidas.

## Responsive por ancho

| Ancho | Composición | Navegación | Ilustración | Densidad |
|---|---|---|---|---|
| 320 | 1 columna, 16 px laterales | bottom 5; etiquetas cortas | oculta salvo estado vacío | 1 CTA, 2 esenciales visibles |
| 375 | 1 columna | bottom 5 | sello/miniatura | 3 esenciales si caben |
| 430 | 1 columna amplia | bottom 5 | mini escena | recompensa visible temprano |
| 768 | 2 zonas + franjas | bottom o rail compacto según capacidad | escena lateral pequeña | agenda y foco en paralelo |
| 1024 | rail + centro + auxiliar | rail con etiquetas | panel contextual | 3 zonas, sin estirar móvil |
| 1280 | grid editorial 12 col | rail persistente | 3–4 columnas máximo | contenido max-width |
| 1440 | igual a 1280, más aire | rail persistente | no crece sin límite | evita dashboard mural |

**[Recomendación técnica · Alto]** Verificar cada ancho con datos cortos, largos, vacíos, offline y texto al 200 % antes del piloto.

## Accesibilidad

- Orden DOM coincide con lectura; CSS no reordena significado.
- `main`, encabezados y regiones con nombres.
- Acciones de registro tienen nombre completo: “Registrar Practicar inglés como Sí”.
- Tras registrar, mensaje `aria-live="polite"`; errores de guardado `assertive` solo si bloquean.
- `A medias` no se representa solo con color.
- Modales/sheets: foco inicial útil, trampa reactiva, Escape, restauración del foco e `inert` correcto.
- Ilustraciones decorativas con `alt=""`; las informativas tienen alternativa textual.
- Navegación de teclado completa para grupos alternables.
- Reduced motion conserva estados finales y feedback textual.
- Zoom 200–400 % sin pérdida de acciones.
- Humor siempre junto a texto funcional claro.

## Matriz de los 24 escenarios obligatorios

La columna “Datos” indica el mínimo; no autoriza telemetría.

| # | Interfaz y acción solicitada | Feedback y notificación | Fallo y recuperación | Datos / saturación / accesibilidad |
|---|---|---|---|---|
| 1. Inicio con 3 metas | Foco dominante + tres horizontes; iniciar una acción | Confirmación breve; apertura solo si fue consentida | Sin siguiente acción → asistente local para elegir una | metas/horizontes/foco; máximo 3 esenciales; encabezados y CTA nombrado |
| 2. Demasiados hábitos | Tres esenciales + resto colapsado; “Reducir hoy” | “Tu día quedó en 3”; agrupar recordatorios | Regla incierta → no ocultar, marcar revisión | ocurrencias/prioridad/capacidad; evita mural; contador textual |
| 3. Hábito ligado a 2 metas | Una fila “apoya 2 metas”; registrar una vez | Ambas reciben evento de evidencia; un solo recordatorio | Vínculo no sincroniza → log local conserva IDs | join N:M; deduplicación; relación disponible a lector |
| 4. Actividades alternables | Un bloque con opciones; elegir una | “1 de 3 elecciones”; push del bloque, no de cada opción | Opción eliminada → conservar registro histórico | grupo/miembros/periodo; opciones colapsadas; radiogroup/lista accesible |
| 5. Gimnasio exitoso | Tocar Sí; deshacer | Estado cambia y recompensa progresa; sin push posterior | Offline → outbox, UI queda guardada | log local_date/status; feedback texto+icono; objetivo táctil 44 px |
| 6. Registro parcial | Tocar A medias; contexto opcional | “Cuenta. ¿Quieres añadir contexto?” | Cerrar sheet mantiene registro | status partial/valor opcional; segunda capa no obligatoria; foco restaurado |
| 7. No sin motivo | Tocar No y cerrar | “Registrado. Sin explicación está bien.” | Ninguno; editable después | status no; cero culpa; no forzar campos |
| 8. No por familia | No → contexto Familia | Feedback neutral; se suprimen carrilla y nudges | Dato sensible local/no sync según consentimiento | contexto sensible; evitar detalle en lock screen; etiquetas claras |
| 9. Energía baja | Activar modo energía baja; usar mínimos | Agenda se reduce visualmente; notificaciones se agrupan/silencian | No hay mínimas → ofrecer cerrar suficiente | capacidad diaria; no esconder datos; switch con estado anunciado |
| 10. Todos los mínimos | Estado “Suficiente”; abrir cierre/recompensa | Cierre opcional, una celebración breve | Regla recompensa falla → registro no se revierte | reglas y claims; evitar confeti continuo; feedback no solo verde |
| 11. Nada cumplido | Cierre resume “hoy no se movió”; elegir mañana/pausa | Sin reprimenda; no push de “recuperar” | Si no cierra, el día expira sin deuda | logs ausentes/cierre; una pregunta; copy funcional |
| 12. Regreso tras 2 semanas | Tarjeta de regreso; retomar/revisar/pausar | “No hay deuda”; máximo un nudge de regreso | Sync pendiente → primero hidratar, luego decidir | last_activity/pausas; no listar 14 días; foco al título |
| 13. Notificación ignorada | La app no dramatiza; al abrir muestra agenda vigente | Se registra ignorada solo con telemetría consentida; se aplica cooldown | Entrega desconocida → no inferir desinterés | delivery/interaction opcional; presupuesto; control de silencio |
| 14. Push tras completar | Debe suprimirse; si ya salió, deep link muestra “ya estaba hecho” | No crea duplicado | Carrera servidor-cliente → idempotencia por ocurrencia | log version/job; no pedir registrar otra vez; anuncio claro |
| 15. Sin conexión | Banner discreto; todas las acciones locales | “Guardado en este dispositivo” | Reconexión → outbox + resolución visible | op UUID/version; no modal; estado accesible |
| 16. IA no disponible | Función de IA aparece no disponible, app normal intacta | Fallback local; sin push | Timeout/circuit breaker; no reintentos infinitos | petición minimizada; no dependencia; error neutral |
| 17. Permiso rechazado | Ajustes explican estado; usar avisos en app | No volver a pedir automáticamente | Guía a ajustes del sistema si la persona decide | permission/device prefs; cero banners repetidos; instrucciones textuales |
| 18. PWA no instalada iPhone | Explica que push fiable requiere app en Home Screen cuando aplique | Guía de instalación solo bajo intención | No compatible → recordatorios in-app/calendario | capability detection; pasos breves; no browser sniffing |
| 19. Recompensa multi-hábito | Regla muestra fuentes y umbral; reclamar | Progreso por fuentes, sin rueda | Fuente borrada → regla queda “requiere revisión” | rule_sources/claim; no contadores compulsivos; relación textual |
| 20. Meta completa por hito | Hito logrado habilita cierre explícito | “¿La definición de terminada ya se cumple?” | No cerrar → meta sigue activa | milestone/evidence/closure; sin porcentaje engañoso; diálogo accesible |
| 21. Meta reformulada | Comparación antes/después; confirmar | Historial conserva versión; notificaciones se recalculan | Conflicto → elegir versión/campos | goal events/version; resumen compacto; diferencias no solo color |
| 22. Meta cerrada conscientemente | Cerrar con motivo opcional; sucesora opcional | Cierre sobrio y exportable | Acción abierta → advertir, no bloquear sin explicación | closed_at/reason; no culpa; confirmación con foco correcto |
| 23. No quiere ánimo | “Omitir siempre” o “Ahora no” | Cierre funciona sin check-in; sin recordatorio emocional | Preferencia se respeta en dispositivos según sync | privacy pref; menos preguntas; control explícito |
| 24. Dos dispositivos | Estado de sync y conflicto solo cuando existe; elegir versión si semántico | Confirmación por operación, no por dispositivo | Append merge para logs; tombstone y resolución para ediciones | operation_id/version/device/timezone; no ruido normal; conflicto navegable por teclado |

## Copys funcionales de referencia

- Guardado offline: “Quedó guardado aquí. Se sincronizará cuando vuelva la conexión.”
- Parcial: “A medias también es información. Cuenta lo que sí pasó.”
- No: “Registrado. No necesitas justificarlo.”
- Sobrecarga: “Hay ocho cosas posibles. Dejé tres visibles; tú decides si basta.”
- Regreso: “No hay nada que recuperar. Hay algo que elegir.”
- Cierre suficiente: “Hoy moviste lo importante. Lo demás no se convierte en deuda.”
- Error: “No pudimos sincronizar todavía. Tu registro local sigue intacto.”

## Criterios de aceptación de Hoy

- Un hábito N:M aparece una vez.
- Máximo tres esenciales expandidos.
- Registro en uno o dos toques.
- “A medias” y omisión consciente existen.
- Cero deuda al día siguiente.
- Los tres horizontes son encontrables sin convertirlos en pendientes.
- Offline no bloquea.
- A 320 px y texto 200 % se conserva la acción principal.
- A 768/1024 existe composición propia.
- Teclado, lector y reduced motion pasan pruebas.
