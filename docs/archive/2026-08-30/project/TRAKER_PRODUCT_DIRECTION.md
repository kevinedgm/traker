# Traker — Dirección de producto

## Problema

Traker debe resolver una brecha de ejecución, no premiar permanencia en la app. La persona sabe que existen objetivos importantes, pero puede tener dificultad para convertirlos en una acción cercana, elegir una carga razonable, iniciar, registrar sin sentirse evaluada y regresar después de interrumpirse.

**[Hipótesis de producto · Alto]** El valor diferencial no será “más seguimiento”; será reducir la distancia entre intención y una acción suficientemente pequeña, y proteger el regreso cuando el plan cambia.

Traker es organización, ejecución, motivación y reflexión. No es tratamiento, diagnóstico ni sustituto de acompañamiento profesional.

## Visión

Una PWA personal donde abrir la aplicación produce rápidamente cinco respuestas:

1. ¿Qué importa ahora?
2. ¿Qué es suficiente hoy?
3. ¿Qué puedo empezar con poca fricción?
4. ¿Qué apoyo/recompensa tengo cerca?
5. Si me fui, ¿cómo regreso sin deuda ni culpa?

Frases rectoras:

> Regresar también es avanzar.

> Hoy no tienes que resolver toda tu vida. Solo mover algo que sí importa.

## Principios de producto

1. **Dirección antes que volumen.** Una meta en foco; tres horizontes visibles, no tres listas enormes.
2. **Suficiente antes que perfecto.** Mínimo, objetivo y extra son opciones; no deuda.
3. **Registro antes que evaluación.** Sí, A medias, No. El contexto es opcional.
4. **Resultado antes que porcentaje.** Una meta se cierra por definición/hito/evidencia, no por llenar una barra.
5. **Un hábito, muchas metas.** La agenda deduplica la conducta y atribuye evidencia a sus vínculos.
6. **Recompensa elegida, no casino.** Beneficio cercano, explícito y seguro.
7. **Interrupción recuperable.** Pausar, omitir, reformular y cerrar son estados válidos.
8. **Offline como contrato.** Registrar no depende de red ni IA.
9. **Humor con consentimiento.** Carrilla regulable; cero culpa en sensibilidad alta.
10. **Datos mínimos y explicables.** La persona puede exportar, borrar y decidir qué sincroniza.

## Arquitectura conceptual recomendada

```text
Dirección personal (vista derivada de horizontes e intereses)
└── Meta finita
    ├── motivo y definición de cierre
    ├── hitos con peso semántico, no porcentaje universal
    ├── acciones puntuales
    ├── sesiones
    ├── evidencias/revisiones como eventos
    ├── hábitos vinculados N:M
    └── recompensas vinculadas por reglas

Agenda del día (vista derivada)
├── foco elegido
├── ocurrencias de hábitos según calendario
├── acciones elegibles
├── bloques alternables
├── capacidad declarada / baja energía
└── estado Sí / A medias / No / omitido consciente

Check-in breve
├── energía, ánimo, presión (todos opcionales)
├── contextos seleccionados (opcionales)
└── nota privada (opcional)
```

### Qué no necesita ser entidad en el MVP

**[Recomendación técnica · Medio]**

- “Dirección personal” puede ser una vista/agrupación derivada; no requiere tabla inicialmente.
- Evidencias y revisiones pueden ser tipos de evento/progreso mientras no necesiten consultas complejas.
- Resumen diario puede derivarse de registros y check-in; no persistir una copia al principio.
- Catálogo visual e ilustraciones deben vivir como activos versionados, no en Postgres.
- IA no requiere guardar conversaciones completas; debe recibir un paquete efímero y minimizado.

## Metas

Una meta es un resultado finito con:

- Título.
- Horizonte corto/medio/largo, mutable con historial.
- Motivo personal.
- Resultado esperado.
- Definición de terminada.
- Estado: borrador, activa, pausada, completada, reformulada/cerrada.
- Siguiente acción opcional.
- Fecha objetivo opcional.
- Hitos y evidencias opcionales.

**[Recomendación técnica · Alto]** El cierre siempre debe ser explícito. Completar un hito puede habilitar “Esta meta parece lista para cerrar”, pero nunca cerrarla automáticamente.

**[Decisión que requiere validación · Medio]** Definir si “reformulada” es un estado terminal con enlace a una nueva meta, o una revisión dentro de la misma meta. Se recomienda conservar la misma meta y registrar un evento de reformulación cuando el resultado esencial no cambia; crear una meta sucesora solo cuando cambia la definición de éxito.

## Hitos, acciones, sesiones y evidencia

- **Hito:** resultado intermedio significativo y cerrable.
- **Acción:** tarea de una sola vez, sin frecuencia.
- **Sesión:** intervalo concreto de trabajo sobre una acción, hábito o meta.
- **Evidencia:** dato o acontecimiento aportado por la persona; no “prueba” clínica.

**[Recomendación técnica · Alto]** Los hitos no deben sumar automáticamente 100 %. Mostrar estado y evidencia (“pendiente”, “en curso”, “logrado”), y usar una barra solo cuando la medición sea realmente continua y la persona haya definido sus unidades.

## Hábitos

Un hábito es recurrente, continuo y reusable. Debe incluir:

- Nombre e intención.
- Versión mínima, objetivo y extra opcional.
- Uno o más calendarios/reglas.
- Pausa y reanudación con historial.
- Vínculos N:M con metas.
- Contexto/ventana opcional.
- Icono Lucide y tratamiento visual opcional.

Frecuencias MVP:

- Días específicos.
- N veces por semana.
- Bloque alternable con N elecciones por semana.

Frecuencias después del MVP:

- N veces por mes.
- Cada N días.
- Ventana horaria/contextual avanzada.
- Reprogramación adaptativa.

**[Recomendación técnica · Alto]** No crear automáticamente pendientes vencidos. Una ocurrencia no realizada termina ese día/periodo; no migra como deuda.

## Grupos flexibles

Entidad propuesta: `flexible_group`.

Ejemplo “Movimiento esta semana”: caminar, gimnasio o bici; mínimo 3 elecciones. Cada miembro puede apoyar metas distintas, pero el grupo presenta una sola decisión por vez.

Reglas:

- Cuenta selecciones, no obliga a una actividad específica.
- No duplica hábitos en agenda.
- Puede definir mínimo/objetivo/extra del periodo.
- Al terminar el periodo, no arrastra faltantes.
- Explica qué opciones cuentan.

## Agenda y capacidad

La agenda no es una lista manual duplicada: es una proyección local del calendario, metas, elecciones y estado del día.

Orden de selección recomendado:

1. Acción/hábito de la meta en foco.
2. Mínimos con ventana o fecha real.
3. Un bloque flexible elegible.
4. Opcionales que caben según capacidad.

Estados de carga:

- **Ligera:** 1 esencial visible.
- **Normal:** hasta 3 esenciales.
- **Alta:** hasta 3 esenciales + “También podrías” colapsado.
- **Baja energía:** versiones mínimas y permiso visible para cerrar suficiente.

**[Hipótesis de producto · Alto]** La persona debe poder declarar “energía baja” sin completar un check-in emocional; esa señal solo reduce presentación, no borra ni reprograma silenciosamente.

## Registro

Contrato operacional:

- **Sí:** se realizó la versión elegida.
- **A medias:** hubo avance real, menor al objetivo.
- **No:** no se realizó.
- **Omitir conscientemente:** decisión de no incluirlo en el día, visible pero sin culpa.

El primer toque registra. Solo “A medias” y “No” ofrecen una segunda capa opcional de contexto. “Deshacer” permanece disponible y el cambio se sincroniza idempotentemente.

**[Decisión que requiere validación · Crítico]** Mapear los cinco niveles heredados al nuevo contrato. Propuesta: 4/3 → Sí, 2 → A medias, 1/0 → No, conservando el valor original en metadatos de migración para reversibilidad. “Día flexible” debe distinguirse de “No”.

## Recompensas

Una recompensa es algo cercano elegido por la persona. Una regla puede vincular:

- Un hábito.
- Varios hábitos.
- Un grupo flexible.
- Un hito.
- Un día suficiente.
- Un umbral semanal (por ejemplo, 2 de 3 fuentes).

Seguridad:

- Sin azar, loot boxes ni rueda.
- Sin penalización por no reclamar.
- Confirmación para recompensas con gasto, sustancias o riesgo.
- La app no prescribe la recompensa.
- “Reclamar” y “usar” pueden ser eventos separados.

## Check-ins

El check-in nocturno debe poder completarse con una sola respuesta: “¿Cómo se sintió la carga?”

Campos opcionales:

- Energía.
- Ánimo.
- Presión.
- Contextos: trabajo, familia, salud, entorno, sueño, finanzas, otro.
- Nota privada.

**[Decisión que requiere validación · Alto]** Se recomienda que check-ins sensibles sean locales por defecto y se sincronicen solo con consentimiento separado. Esto añade claridad de privacidad, pero exige explicar que no aparecerán en otro dispositivo.

## Ciclo diario

### Apertura

- Saludo y mensaje contextual local.
- Foco actual con motivo breve.
- Hasta tres esenciales.
- Recompensa cercana si existe.
- Tres horizontes como contexto compacto.

### Ejecución

- Iniciar acción/sesión o registrar hábito en uno o dos toques.
- Feedback inmediato, reversible y no celebratorio en exceso.
- Deduplicar hábitos vinculados a varias metas.

### Ajuste

- Marcar energía baja.
- Cambiar foco del día.
- Omitir/reprogramar sin deuda.
- Silenciar notificaciones por hoy.

### Cierre

- Resumen de lo movido, no lista de faltantes.
- Check-in opcional.
- Recompensa disponible.
- Sugerencia neutral para mañana, nunca obligación.

### Regreso

- Reconocer ausencia sin contar días como deuda.
- Mostrar una sola vía: retomar mínimo, revisar plan o pausar.
- No mostrar racha perdida ni backlog acumulado.

## Métricas responsables

### Métricas de valor

- Mediana de tiempo entre apertura y primera acción significativa.
- Proporción de días con 1–3 esenciales, no más.
- Registros Sí/A medias/No y uso de versión mínima.
- Frecuencias semanales alcanzadas sin deuda.
- Metas activas con siguiente acción.
- Hitos completados y metas cerradas conscientemente.
- Regresos después de 7/14/30 días.
- Recompensas reclamadas.
- Utilidad declarada del cierre.
- Cambio en presión/carga percibida.
- Reducción voluntaria de actividades programadas.
- Mensajes favoritos/desactivados y notificaciones silenciadas/ignoradas.

### Guardrails

- No optimizar tiempo dentro de la app, aperturas, puntos, número de pushes, rachas ni uso diario forzado.
- No llamar “abandono” a una ausencia.
- No inferir causalidad a partir de correlaciones.
- No segmentar contenido sensible para aumentar engagement.
- Telemetría opt-in, minimizada y separada del contenido privado.

## MVP propuesto

El MVP más pequeño que valida la tesis incluye:

1. Migración segura y preservación de datos.
2. Meta con horizonte, motivo, cierre, hitos y acciones.
3. Hábitos N:M con días específicos o N/semana.
4. Un tipo de grupo alternable.
5. Agenda Hoy con máximo de tres esenciales.
6. Meta en foco y tres horizontes compactos.
7. Registro Sí/A medias/No; contexto opcional.
8. Cierre nocturno y check-in omitible.
9. Recompensa inmediata/semanal explícita, sin rueda.
10. Mensajes locales versionados.
11. Apertura/cierre por notificación con deep links.
12. Un hábito visual piloto con activo liviano.
13. Offline completo y sync bidireccional probado.

Fuera del MVP: generación con IA, predicción, recomendaciones clínicas, decenas de ilustraciones, reglas de recompensa complejas y automatización adaptativa.

## Decisiones de producto que requieren aprobación

1. Navegación primaria y nombres “Rumbo”/“Historial”.
2. Mapeo exacto del registro heredado a tres estados.
3. Check-in local por defecto o sincronizado por defecto.
4. Hasta una o hasta tres metas en foco.
5. Eliminación de rueda y puntos como mecánica principal.
6. Tono por defecto y matriz de sensibilidad.
7. Semántica de meta reformulada/cerrada.
8. Frecuencias incluidas en MVP.
9. Datos de telemetría permitidos y retención.
10. Qué significa “día suficiente” en la primera versión.

