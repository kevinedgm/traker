# Traker — Sistema de comunicación

## Personalidad

Traker habla como una persona cómplice, directa y breve que ayuda a elegir, no como coach, médico, juez o personaje dependiente. Puede tener carrilla mexicana moderada cuando la persona la elige, pero el contenido funcional siempre se entiende sin humor.

Rasgos:

- Cálida, no melosa.
- Directa, no autoritaria.
- Divertida, no cruel.
- Específica, no motivacional genérica.
- Honesta sobre incertidumbre.
- Respetuosa de pausa, parcialidad y regreso.

## Contrato de voz

1. Describir lo ocurrido, no evaluar a la persona.
2. Ofrecer una siguiente acción, no un sermón.
3. Nunca convertir ausencia en deuda.
4. Nunca prometer tratamiento, mejora clínica o causalidad.
5. No usar datos sensibles para bromear.
6. No mencionar un hábito sensible en pantalla bloqueada si la privacidad está activada.
7. Errores, permisos, borrado y pagos usan lenguaje neutral.
8. Una notificación contiene una intención y un deep link.
9. El humor nunca sustituye una etiqueta o instrucción.
10. “No” y “A medias” son información, no fracaso.

## Tonos e intensidad

| Nivel | Nombre | Uso | Ejemplo |
|---|---|---|---|
| 0 | Neutral | errores, privacidad, salud/familia/finanzas; siempre disponible | “Tu registro quedó guardado aquí.” |
| 1 | Cálido | valor por defecto prudente | “Con una cosa suficiente ya hay avance.” |
| 2 | Carrilla ligera | opt-in o contexto no sensible | “Poquitas cosas, jefe. Pero que sí cuenten.” |
| 3 | Sin respeto | opt-in explícito, nunca en sensible/ausencia grave | “A ver, criatura del caos: elige una y ya.” |

**[Decisión que requiere validación · Alto]** El repositorio actual favorece `no_respect`, mientras documentación previa habla de voz calmada. Se recomienda nivel 1 por defecto y conservar 2–3 como opt-in. Requiere decisión de marca.

## Contextos sensibles

Forzar neutral/cálido y desactivar carrilla cuando exista:

- Salud, medicación, cuerpo/alimentación.
- Familia/cuidado/duelo.
- Finanzas/deuda.
- Trabajo perdido o conflicto laboral.
- Presión/energía muy baja declarada.
- Error, pérdida de datos, permisos, privacidad.
- Retorno después de ausencia prolongada.

La categoría del hábito no basta: el contexto opcional del día puede elevar sensibilidad temporalmente.

## Catálogo mínimo de eventos

### Ciclo diario

- `morning_opening`
- `today_focus_selected`
- `today_overloaded`
- `day_sufficient`
- `evening_summary`
- `day_closed`
- `return_after_absence`

### Hábitos

- `habit_reminder`
- `habit_done`
- `habit_partial`
- `habit_not_done`
- `habit_minimum_used`
- `habit_conscious_skip`
- `habit_paused`
- `habit_returned`
- `flex_group_progressed`

### Metas/sesiones

- `goal_started`
- `goal_progressed`
- `goal_paused`
- `goal_returned`
- `goal_reformulated`
- `goal_ready_to_close`
- `goal_closed`
- `milestone_completed`
- `session_started`
- `session_completed`

### Recompensas

- `reward_near`
- `reward_unlocked`
- `reward_claimed`
- `reward_rule_needs_review`

### Sistema

- `offline_saved`
- `sync_restored`
- `sync_conflict`
- `sync_error`
- `notification_permission_denied`
- `generic_error`

## Estructura de una entrada

```text
id
event
category
tone_min / tone_max
intensity
sensitivity_allowlist
moment (morning/day/evening/return)
template
functional_fallback
variables allowlist
channels (in_app/push)
locale
version
```

El catálogo canónico debe vivir en una fuente compartida de build. La Edge Function recibe un snapshot versionado; no mantiene frases manualmente divergentes.

## Selección

Orden de filtros:

1. Evento.
2. Canal y momento.
3. Sensibilidad.
4. Tono máximo del usuario.
5. Categoría del hábito/meta.
6. Intensidad/contexto del día.
7. Historial anti-repetición.
8. Favoritos como sesgo suave.
9. Selección determinista con semilla local para pruebas.

Reglas:

- Excluir últimos 8 mensajes globales y últimos 3 del mismo evento.
- Una frase desactivada no reaparece aunque vacíe el pool; usar fallback neutral aparte.
- Favoritos aumentan peso, no exclusividad.
- No repetir el mismo chiste en push e interfaz el mismo día.
- El servidor registra solo ID de plantilla/entrega cuando haya consentimiento, no texto sensible interpolado.

## Variables permitidas

- Nombre corto elegido por la persona.
- Nombre de hábito/meta solo si el canal y privacidad lo permiten.
- Conteo de periodo, sin racha.
- Versión mínima.
- Nombre de recompensa.
- Hora/ventana local.

Prohibido interpolar notas, contexto familiar/salud, ánimo, contenido de evidencia o texto libre en notificaciones.

## Ejemplos por evento

| Evento | Neutral/cálido | Carrilla ligera |
|---|---|---|
| Apertura | “Hoy basta con mover una cosa que importe.” | “El menú de hoy es corto a propósito.” |
| Sobrecarga | “Hay ocho opciones; dejamos tres visibles.” | “Ocho pendientes querían entrar. Pasaron tres.” |
| Sí | “Registrado. Esto también mueve tu rumbo.” | “Mira nada más: sí ocurrió.” |
| A medias | “Cuenta lo que sí pasó.” | “Medio hecho sigue estando más hecho que imaginado.” |
| No | “Registrado. No necesitas justificarlo.” | “Hoy no salió. Se archiva, no se dramatiza.” |
| Mínima | “La versión mínima cuenta.” | “Edición compacta, pero edición real.” |
| Regreso | “No hay deuda. Elige por dónde volver.” | No usar nivel alto por defecto |
| Suficiente | “Lo importante de hoy ya quedó.” | “Se logró lo suficiente. Nadie llame a la policía de productividad.” |
| Offline | “Guardado aquí; sincronizaremos después.” | Siempre neutral |
| Error | “No pudimos sincronizar. Tu copia local sigue intacta.” | Siempre neutral |
| Meta cerrada | “Cerraste esta meta de forma consciente.” | “Se cerró el expediente. Bien ahí.” |

## Lenguaje prohibido o restringido

- “Fallaste”, “rompiste tu racha”, “perdiste progreso”.
- “Recupera lo de ayer”, “te debes”.
- “Sé disciplinado”, “sin excusas”.
- Diagnósticos o atribuciones: “tu TDAH hizo…”.
- Causalidad no demostrada: “la mañana te funciona mejor”.
- Insultos sobre inteligencia, cuerpo, salud, familia o valor personal.
- Urgencia falsa, FOMO o vergüenza.

**[Evidencia del proyecto · Alto]** Debe retirarse una frase de servidor que culpa explícitamente por el día anterior; viola este contrato.

## Citas y frases externas

**[Recomendación técnica · Medio]** No incluir citas atribuidas en el MVP. Si se agregan después, cada cita necesita texto verificado, autor, obra/fuente, licencia/uso permitido y revisión editorial. Una atribución dudosa se presenta como frase de Traker o se elimina, nunca como cita.

## Feedback de mensajes

Controles discretos:

- “Me dio risa”.
- “No me lo muestres”.
- “Bajar intensidad”.

No pedir feedback después de cada mensaje. Guardar local por defecto; sincronizar preferencias, no necesariamente el historial, con consentimiento.

## Pruebas del sistema

- Todas las plantillas interpolan solo variables autorizadas.
- Cada evento tiene fallback neutral.
- Frases desactivadas nunca reaparecen.
- Matriz sensible bloquea tonos 2–3.
- Anti-repetición funciona offline y servidor.
- Snapshot cliente/Edge comparte versión/hash.
- Pruebas de español MX: longitud, claridad y ambigüedad.
- Revisión humana específica de salud, familia, finanzas y retorno.
- El mensaje funcional sigue siendo comprensible sin carrilla.

## Decisiones humanas

1. Tono por defecto.
2. Límite exacto de lenguaje nivel 3.
3. Categorías sensibles y si el usuario puede sobrescribirlas.
4. Sincronización del historial de mensajes.
5. Equipo/persona responsable de revisión editorial.
6. Inclusión futura de citas.

