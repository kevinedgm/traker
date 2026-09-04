# Traker Metas — especificación de producto

## Problema

Las listas de tareas suelen asumir que definir un resultado, planificarlo, iniciarlo y retomarlo son una sola habilidad. Para parte de las personas adultas con TDAH o patrones semejantes, una meta extensa mantiene demasiado tiempo la recompensa a distancia, oculta el siguiente movimiento y convierte las interrupciones en deuda.

Traker Metas ayudará a convertir un resultado finito en una siguiente acción iniciable, dejar evidencia cercana y regresar sin intentar recuperar todo.

## Hipótesis principal

Convertir una meta en una siguiente acción pequeña, proporcionar feedback inmediato y facilitar el regreso aumentará la probabilidad de que una persona continúe y cierre lo que comenzó, sin elevar culpa o carga administrativa.

## Principios

- Regresar también es avanzar.
- Una meta es un resultado finito; un hábito es una conducta recurrente.
- La pantalla prioriza lo que puede hacerse ahora.
- Sólo una siguiente acción es obligatoria.
- La versión mínima es una adaptación válida, no una calificación inferior.
- Pausar conserva contexto; no acumula deuda.
- Cerrar conscientemente también es progreso.
- El feedback describe hechos y capacidad, no obediencia.
- La autonomía prevalece sobre límites rígidos y recompensas controladoras.
- Traker es apoyo organizativo, no tratamiento.

## Modelo conceptual

```text
Meta
 ├─ motivo personal
 ├─ resultado deseado
 ├─ definición de terminada
 ├─ etapas opcionales
 │   └─ acciones
 ├─ siguiente acción
 │   ├─ versión mínima
 │   ├─ energía requerida
 │   └─ rango de tiempo
 ├─ sesiones de trabajo
 ├─ evidencias de avance
 ├─ pausas y regresos
 └─ cierre
     ├─ completada
     ├─ reformulada → nueva meta vinculada
     ├─ pausada
     └─ abandonada conscientemente
```

No se crea una entidad Proyecto en el MVP: una meta con etapas cubre ese nivel. Sesión y acción son diferentes; una sesión registra tiempo dedicado y puede producir avance parcial sin completar una acción.

## Alcance del MVP

### Imprescindible

- Crear meta con título, motivo y definición de terminada.
- Definir una siguiente acción.
- Definir una versión mínima opcional.
- Seleccionar energía y tiempo por rangos opcionales.
- Iniciar, pausar y finalizar una sesión.
- Registrar avance parcial, bloqueo o acción completada.
- Feedback inmediato sobrio y proporcional con tokens Traker Aurora.
- Pausar una meta y conservar su contexto.
- Flujo especializado de regreso.
- Completar, abandonar o reformular conscientemente.
- Reformulación mediante una nueva meta vinculada; la original no se reabre.
- Límite configurable de metas en foco, recomendado inicialmente en tres.
- Uso anónimo/offline y cuenta Supabase opcional con sincronización.

### Segunda iteración

- Etapas y mapa completo editables.
- Evidencias enriquecidas y enlaces.
- Plan opcional “si X, entonces Y”.
- Variaciones de modalidad para recuperar interés.
- Conversión explícita de una acción recurrente en hábito.
- Recordatorios de Metas y calibración estimado/real.

### Experimentales

- Recorrido orgánico ramificable.
- Body doubling o acompañamiento social.
- WOOP guiado.
- Recompensas agradables elegidas por el usuario.
- Descomposición asistida automáticamente.

### Descartadas o contraproducentes

- Monedas, gemas, cofres, rankings y avatares infantiles.
- Rachas, pérdida de progreso y castigos por ausencia.
- Recompensas aleatorias.
- Confeti constante.
- Porcentaje obligatorio para metas no lineales.
- Feed social competitivo.
- Lista extensa generada durante la creación.

## Decisión sobre el recorrido orgánico

No entra en el MVP. El primer lanzamiento representará progreso mediante etapa actual, evidencias recientes, último movimiento y siguiente acción. Esto valida la hipótesis sin añadir una visualización costosa, difícil de hacer accesible y todavía no respaldada por evidencia comparativa. El recorrido orgánico será un experimento reversible posterior.

## Pantalla principal de una meta

Orden de información:

1. Siguiente acción.
2. Versión mínima.
3. Iniciar sesión.
4. Rango de tiempo y energía.
5. Motivo personal.
6. Evidencia más reciente y punto de regreso.
7. Etapa actual, si existe.
8. Historial, mapa y configuración bajo revelación progresiva.

## Aplicación del sistema Traker Aurora

La experiencia de Metas utilizará Aurora como fuente de verdad:

- `NextStepCard` se adapta a Vue como protagonista de la pantalla: una sola acción visible y salida secundaria para reducir/adaptar.
- `ReturnCard` encabeza el flujo de regreso con `--aurora-return`, coral y Instrument Serif solamente en el titular emocional.
- `EffortSelector` expresa la energía/esfuerzo mediante forma y texto, no sólo color.
- `MinimalVersionSelector` permite elegir versión mínima, habitual o posponer sin advertencias punitivas.
- `ProgressCard` resume evidencias y decisiones, evitando porcentajes rígidos.
- `StatusTag` normaliza: Pendiente, Iniciado, Parcial, Completado, Adaptado, Pospuesto, Pausado, Retomado, Omitido y Sin registro.
- `BottomSheet` aloja adaptación rápida en móvil; en escritorio se transforma en panel contextual sin estirar la vista móvil.

La composición será mobile-first, con columna de acción de hasta 640 px. En escritorio utilizará hasta 1120 px y reorganizará siguiente acción, contexto y evidencia en dos o tres columnas. El glass se limita a navegación y superficies temporales.

Outfit se usa para interfaz, controles y cifras. Instrument Serif se limita a bienvenida, regreso o cierre reflexivo. Los estados deben mantener texto y forma además del color, con foco cian visible y targets mínimos de 44 × 44 px.

## Flujos funcionales

| Flujo | Disparador y pasos | Decisiones/errores | Copy y feedback | Datos/accesibilidad |
|---|---|---|---|---|
| Crear meta | `Nueva meta` → intención → motivo → terminada → acción | Guardar borrador; permitir “aún no lo sé” | “Empecemos por algo que puedas reconocer como terminado.” | Labels persistentes, errores asociados, borrador |
| Definir terminada | Elegir señal observable | Advertir definición circular o vaga sin bloquear | “Podrás ajustarla si cambia el contexto.” | Texto y versión |
| Crear etapas | Se ofrece sólo ante complejidad | Omitir o crear 2–5; vacío permitido | “Las etapas son un mapa, no una deuda.” | Orden y estado |
| Primer paso | Verbo + objeto + condiciones disponibles | Detectar dependencia oculta | “¿Qué podrías hacer sin preparar nada más?” | Acción y dependencias |
| Versión mínima | Reducir duración, alcance o estándar | Siempre opcional | “Hazla suficientemente pequeña para comenzar.” | Texto mínimo |
| Iniciar sesión | Elegir 5/10/15/personalizado/sin reloj | Recuperar sesión interrumpida | “Sólo este bloque.” | Timestamps y live region |
| Avance parcial | Terminar sesión → elegir resultado | Nota opcional; reintento offline | “Dejaste un punto claro para continuar.” | Evento idempotente |
| Feedback | Se guarda avance | Continuar, parar o preparar siguiente entrada | “Preparaste el borrador base.” | No depender de color/animación |
| Perder interés | Inactividad o acción del usuario | Revisar relevancia antes de “añadir novedad” | “¿Cambió la meta o necesitas otra forma de abordarla?” | Respuesta opcional |
| Cambiar actividad | Elegir lugar, formato, dificultad o apoyo | Mantener propósito o reformular | “Mismo propósito, otra manera.” | Variante elegida |
| Pausar | Acción explícita | Fecha de revisión opcional | “Pausar conserva el contexto.” | Motivo opcional |
| Regresar | Abrir meta pausada/inactiva | Importa / cambió / reducir / cerrar | “Qué bueno que volviste. No necesitas recuperar todo.” | Resumen y nuevo punto de entrada |
| Muchas metas | Foco supera límite configurado | Elegir foco, pausar o cambiar límite | “¿Cuáles merecen espacio ahora?” | Ajuste de límite |
| Terminar etapa | Completar última acción o marcar hito | Añadir evidencia y siguiente etapa | “Esta parte ya está construida.” | Evento y timestamp |
| Completar meta | Comparar con definición de terminada | Confirmar, reformular o seguir | “¿Qué cambió gracias a esta meta?” | Cierre inmutable |
| Reformular | Meta ya no encaja | Cerrar original y crear vinculada | “Cambiar la meta también puede ser avanzar.” | `reformulated_from_goal_id` |
| Abandonar | Cierre explícito | Motivo y aprendizaje opcionales | “Cerrar libera atención. Tu trabajo permanece.” | Cierre y archivo |
| Convertir en hábito | Se identifica recurrencia sin final | Confirmación; no conversión automática | “¿Quieres practicar esto como hábito?” | Relación entre entidades |

## Experiencia de regreso

El flujo muestra primero un resumen: motivo, último avance, último bloqueo y punto que se había dejado preparado. Luego pregunta:

1. “¿Esta meta todavía importa para ti?”
2. “¿Qué cambió desde la última vez?”
3. “¿Qué versión tendría sentido hoy?”

Resultados posibles: retomar, reducir, reformular, pausar o cerrar. Nunca se muestra una lista de días perdidos ni se exige recuperar acciones vencidas.

## Recompensas

El MVP utiliza feedback informativo:

- Cambio visual breve y compatible con movimiento reducido.
- Descripción específica del avance.
- Evidencia guardada en el historial.
- Reconocimiento proporcional para inicio, regreso, ajuste realista y cierre.
- Opción de desactivar mensajes celebratorios.

No se acumula una economía virtual. El sistema no debe utilizar recompensas variables ni pérdida.

## Metas en foco

- Valor recomendado inicial: tres.
- Configurable y desactivable.
- Superarlo genera una sugerencia, nunca un bloqueo.
- Las metas fuera de foco siguen accesibles y no se consideran fallidas.

## Métricas responsables

Primarias:

- Porcentaje de metas con primera acción en 24 horas.
- Tiempo entre creación y primer inicio.
- Regreso después de 7, 14 y 30 días.
- Cierre consciente por tipo.
- Percepción de avance, carga y culpa.

Diagnósticas:

- Uso de versión mínima.
- Metas reformuladas.
- Sesiones que dejan punto de regreso.
- Diferencia estimado/real.
- Metas en foco frente a pausadas.

Guardrails:

- Notificaciones silenciadas.
- Abandono durante creación.
- Incremento de culpa o presión.
- Tiempo de registro mayor que el trabajo apoyado.
- Creación reiterada sin inicio.

No se optimizará tiempo dentro de la app, aperturas de notificaciones, acciones brutas ni retención basada en presión.

## Consentimiento e investigación

Traker podrá almacenar y sincronizar todos los datos funcionales descritos con consentimiento explícito. La analítica será separada, granular y revocable. Motivos, notas y evidencias textuales no se enviarán a analítica de producto.

El piloto será revisado por adultos con TDAH, personas con patrones similares sin diagnóstico y profesionales con experiencia clínica en TDAH adulto. La revisión clínica identificará riesgos y lenguaje problemático; no convertirá Traker en tratamiento.
