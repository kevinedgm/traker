/**
 * @file catalog.js
 * Static phrase catalog for Traker's personality system ("sin respeto").
 *
 * Pure data — no Vue/Pinia. Every phrase has a stable `id` used by the
 * engine for anti-repetition, and by the user to disable/favorite it.
 *
 * Three tones per event, whenever it makes sense to have all three:
 *   normal      — plain, correct Spanish. No jokes, no slang.
 *   trusted     — warm "con confianza" tone. Encouraging, casual.
 *   no_respect  — heavy Mexican carrilla. Vulgar, funny, direct. DEFAULT.
 *
 * `medication` and any category in SENSITIVE_CATEGORIES intentionally
 * have NO `no_respect` catalog entries — see engine.js for the runtime
 * degradation rule. This file only ever contains normal/trusted content
 * for those categories.
 */

import {
  COPY_CATALOG_HASH,
  COPY_CATALOG_VERSION,
  SENSITIVE_CATEGORY_IDS,
} from '../../../supabase/functions/_shared/copy-contract.js'

export { COPY_CATALOG_HASH, COPY_CATALOG_VERSION }

/** Builds a stable, sortable id for each phrase: `${scope}.${event}.${tone}.${index}`. */
function bank(scope, event, tone, phrases) {
  return phrases.map((text, i) => ({
    id: `${scope}.${event}.${tone}.${String(i + 1).padStart(2, '0')}`,
    text,
  }))
}

export const TONES = Object.freeze(['normal', 'trusted', 'no_respect'])

export const CATEGORIES = Object.freeze([
  'generic',
  'gym',
  'cardio',
  'hydration',
  'sleep',
  'nutrition',
  'english',
  'study',
  'programming',
  'tidiness',
  'medication',
  'family',
  'health',
  'finance',
  'work',
])

/** Categories that never get catalog no_respect content — always caring/clear. */
export const SENSITIVE_CATEGORIES = new Set(SENSITIVE_CATEGORY_IDS)

/** Absolute last-resort phrase when every pool (catalog + custom) is empty. */
export const FALLBACK_PHRASE = { id: 'fallback.generic', text: 'Sigue.' }

/**
 * Functional phrases outside selectable pools. They remain available when a
 * person disables every catalog phrase for an event, without resurrecting an
 * id they explicitly hid.
 */
export const EVENT_FALLBACKS = Object.freeze({
  habit_reminder: { id: 'fallback.habit_reminder', text: 'Tienes un hábito pendiente por registrar.' },
  habit_completed: { id: 'fallback.habit_completed', text: 'Registro completado.' },
  habit_partial: { id: 'fallback.habit_partial', text: 'A medias también es información. Cuenta lo que sí pasó.' },
  habit_skipped: { id: 'fallback.habit_skipped', text: 'Registrado. No necesitas justificarlo.' },
  habit_paused: { id: 'fallback.habit_paused', text: 'Hábito pausado. Su progreso permanece guardado.' },
  habit_returned: { id: 'fallback.habit_returned', text: 'No hay deuda. Puedes continuar desde hoy.' },
  minimal_version: { id: 'fallback.minimal_version', text: 'La versión mínima cuenta.' },
  goal_paused: { id: 'fallback.goal_paused', text: 'Meta pausada. El contexto permanece guardado.' },
  goal_returned: { id: 'fallback.goal_returned', text: 'No hay nada que recuperar. Puedes elegir cómo continuar.' },
  goal_reformulated: { id: 'fallback.goal_reformulated', text: 'La meta anterior quedó vinculada a esta nueva dirección.' },
  goal_completed: { id: 'fallback.goal_completed', text: 'Meta completada.' },
  goal_closed: { id: 'fallback.goal_closed', text: 'Cerraste esta meta de forma consciente.' },
  session_completed: { id: 'fallback.session_completed', text: 'La sesión quedó registrada. Puedes volver desde aquí.' },
  evening_summary: { id: 'fallback.evening_summary', text: 'El resumen de hoy está listo. Lo pendiente no se convierte en deuda.' },
  day_closed: { id: 'fallback.day_closed', text: 'El cierre de hoy quedó guardado.' },
  morning_motivation: { id: 'fallback.morning_motivation', text: 'Hoy basta con mover una cosa que importe.' },
  inactivity_nudge: { id: 'fallback.inactivity_nudge', text: 'Puedes volver cuando quieras, sin ponerte al corriente.' },
  offline: { id: 'fallback.offline', text: 'Quedó guardado aquí. Se sincronizará cuando vuelva la conexión.' },
  sync_error: { id: 'fallback.sync_error', text: 'No pudimos sincronizar todavía. Tu registro local sigue intacto.' },
  generic_error: { id: 'fallback.generic_error', text: 'Algo no salió como esperábamos. Puedes intentarlo otra vez.' },
})

// ─────────────────────────────────────────────────────────────────────────
// Generic (cross-category) events
// ─────────────────────────────────────────────────────────────────────────

export const GENERIC_EVENTS = {
  habit_reminder: {
    no_respect: bank('generic', 'habit_reminder', 'no_respect', [
      'Oye, {habitName} no se hace solo. Muévete.',
      'Ya sé que traes flojera, pero {habitName} te está esperando desde hace rato.',
      'Recordatorio no solicitado: {habitName}. De nada.',
      '¿Otra vez viendo el techo? Ve y haz {habitName}.',
      'El celular no se va a ir a ningún lado. {habitName}, ahorita.',
      'Tu pretexto de hoy ya lo escuché ayer. Ve a hacer {habitName}.',
      'Son las {hour} y {habitName} sigue esperando, como novia plantada.',
      'No te hagas pato. Toca {habitName}.',
      'Si esto fuera examen ya hubieras reprobado por no presentarte. {habitName}, va.',
      'Pon la excusa en pausa y haz {habitName} de una vez.',
      'Este mensaje se autodestruye si haces {habitName} en los próximos cinco minutos. No es cierto, pero hazlo.',
      'Firma de salida: aquí sigo, aquí sigues sin hacer {habitName}.',
    ]),
    trusted: bank('generic', 'habit_reminder', 'trusted', [
      'Es hora de {habitName}. Tú puedes con esto.',
      'Nomás un recordatorio amistoso: {habitName} te espera.',
      'Vamos con {habitName}, aunque sea la versión chiquita.',
      'Ya casi son las {hour}. Buen momento para {habitName}.',
      'Ándale, un ratito para {habitName} y seguimos con el día.',
      'Aquí ando, echándote porras para que hagas {habitName}.',
      'No tiene que ser perfecto. Solo empieza con {habitName}.',
      'Tú y yo sabemos que después te vas a sentir bien si haces {habitName}.',
      'Recordatorio de tu compa: {habitName}, cuando puedas.',
      'Un paso más hacia {habitName}. Vamos por él.',
    ]),
    normal: bank('generic', 'habit_reminder', 'normal', [
      'Recordatorio: es hora de {habitName}.',
      'Tienes pendiente {habitName} hoy.',
      'Hora programada para {habitName}.',
      '{habitName} te está esperando.',
      'Un momento para {habitName}, cuando gustes.',
      'Notificación de hábito: {habitName}.',
      'Puedes registrar {habitName} ahora.',
      'Es buen momento para avanzar con {habitName}.',
    ]),
  },

  habit_completed: {
    no_respect: bank('generic', 'habit_completed', 'no_respect', [
      'A huevo, cabrón. {habitName} quedó liquidado.',
      'Mira nomás, cumpliste. Se me caen las lágrimas de la emoción.',
      '{habitName}: hecho. Ya puedes presumir en el chat, aunque nadie pregunte.',
      'Tanto pedo y sí pudiste con {habitName}.',
      'No te reconozco. ¿Quién eres y qué hiciste con el que siempre pone pretextos?',
      '{habitName} tachado. La disciplina existe y hoy decidió visitarte.',
      'Otra vez cumpliste. Ya hasta parece hábito, qué ironía.',
      'Chingón. {habitName} completado sin drama ni excusas de telenovela.',
      'Eso, papi. Uno más para la cuenta de {habitName}.',
      'Te luciste con {habitName}. Ahora no te me vayas a hacer el héroe todos los días.',
      '{habitName}: listo. El sillón te sigue esperando, te lo ganaste.',
      'Nada mal para alguien que ayer juraba que hoy no iba a poder.',
    ]),
    trusted: bank('generic', 'habit_completed', 'trusted', [
      'Bien hecho. {habitName} quedó registrado.',
      'Ahí está, otro día que sí se pudo con {habitName}.',
      'Se nota el esfuerzo en {habitName}. Sigue así.',
      '{habitName} completado. Cuenta, y cuenta bonito.',
      'Vas construyendo algo real con {habitName}, día a día.',
      'Buen trabajo con {habitName}. Te lo mereces.',
      'Ese registro de {habitName} también es una victoria, chiquita o no.',
      'Cumpliste. {habitName} queda anotado con orgullo.',
      'Un paso más firme en {habitName}. Vas bien.',
      'Hoy sí. {habitName} completado, y eso ya es ganancia.',
    ]),
    normal: bank('generic', 'habit_completed', 'normal', [
      '{habitName} registrado como completado.',
      'Hábito completado: {habitName}.',
      'Registro guardado para {habitName}.',
      '{habitName}: completado hoy.',
      'Avance registrado en {habitName}.',
      '{habitName} quedó marcado como hecho.',
      'Registro exitoso de {habitName}.',
      '{habitName} completado correctamente.',
    ]),
  },

  habit_partial: {
    no_respect: bank('generic', 'habit_partial', 'no_respect', [
      'Medio hecho sigue estando más hecho que imaginado. {habitName} cuenta hoy.',
      'No fue edición completa, pero {habitName} sí se movió. Anotado.',
      '{habitName} avanzó a medias. Cero drama, información útil.',
    ]),
    trusted: bank('generic', 'habit_partial', 'trusted', [
      'Cuenta lo que sí pasó con {habitName}.',
      '{habitName} avanzó hoy, aunque no haya quedado completo.',
      'Avance parcial registrado. Puedes continuar desde aquí.',
    ]),
    normal: bank('generic', 'habit_partial', 'normal', [
      'Avance parcial registrado en {habitName}.',
      '{habitName} quedó registrado como realizado a medias.',
      'Se guardó el avance disponible de {habitName}.',
    ]),
  },

  habit_skipped: {
    no_respect: bank('generic', 'habit_skipped', 'no_respect', [
      'Hoy no. Ni pedo, mañana le entramos otra vez a {habitName}.',
      'Cero drama. {habitName} se queda para otro día, así es esto.',
      'No pasó nada. El mundo sigue girando aunque hoy no hicieras {habitName}.',
      "Anotado el 'hoy no'. No te voy a andar sermoneando por eso.",
      'Un día sin {habitName} no te convierte en fracaso, tranquilo.',
      'Quedó anotado que hoy pasaste de {habitName}. Aquí seguimos mañana.',
    ]),
    trusted: bank('generic', 'habit_skipped', 'trusted', [
      'Sin castigo. {habitName} queda para otro momento.',
      'Un día sin registro no borra lo que ya construiste con {habitName}.',
      'Anotado con honestidad: hoy no fue el día de {habitName}. Está bien.',
      'No pasa nada. Mañana retomamos {habitName}.',
      'Hoy no se pudo con {habitName}, y aun así seguimos aquí.',
    ]),
    normal: bank('generic', 'habit_skipped', 'normal', [
      'Registrado como no realizado: {habitName}.',
      '{habitName} sin registro hoy.',
      'Día marcado como pendiente en {habitName}.',
      'No se registró avance en {habitName} hoy.',
    ]),
  },

  habit_paused: {
    no_respect: bank('generic', 'habit_paused', 'no_respect', [
      '{habitName} queda en pausa. No se borró nada ni hay deuda pendiente.',
      'Pausa puesta en {habitName}. El progreso se queda donde está.',
      '{habitName} se sienta un rato en la banca. Luego decides si vuelve.',
    ]),
    trusted: bank('generic', 'habit_paused', 'trusted', [
      '{habitName} quedó en pausa. Todo tu progreso permanece guardado.',
      'Pausar también puede cuidar tu atención. {habitName} queda disponible para después.',
      'Pausa guardada para {habitName}. Puedes retomarlo cuando tenga sentido.',
    ]),
    normal: bank('generic', 'habit_paused', 'normal', [
      'Hábito pausado: {habitName}.',
      '{habitName} quedó inactivo sin perder su historial.',
      'La pausa de {habitName} quedó guardada.',
    ]),
  },

  habit_returned: {
    no_respect: bank('generic', 'habit_returned', 'no_respect', [
      'Mira quién volvió, el hijo pródigo de la productividad.',
      'No tienes que recuperar todo. Esto no es Coppel, no hay meses sin intereses.',
      'Aquí sigue tu desmadre exactamente como lo dejaste.',
      'Volviste. No te voy a preguntar dónde andabas, pero sí me dio gusto.',
      'El fugitivo regresó a la escena del crimen. Bienvenido.',
      'Ya extrañaba tus pretextos, la verdad.',
      'Nadie te juzga, bueno, tantito sí, pero aquí seguimos.',
      'Ah, ya te acordaste que esto existía.',
      'Regresaste. Vamos a fingir que no pasó nada y seguirle.',
      'Se te extrañó por acá, cabrón. Vamos retomando.',
    ]),
    trusted: bank('generic', 'habit_returned', 'trusted', [
      'Qué bueno que volviste. Lo que ya hiciste sigue contando.',
      'No necesitas recuperar los días perdidos, solo seguir desde hoy.',
      'Bienvenido de vuelta. Empezamos donde te quedaste, sin drama.',
      'Tu progreso anterior sigue ahí, intacto, esperándote.',
      'Volver también cuenta como avance. Bien por ti.',
      'No importa cuánto tiempo pasó, hoy es un buen día para retomar.',
      'Aquí sigue todo, listo para cuando quieras continuar.',
      'Regresar es parte del proceso, no una excepción a la regla.',
      'Un respiro y seguimos. Nada se perdió.',
    ]),
    normal: bank('generic', 'habit_returned', 'normal', [
      'Bienvenido de vuelta.',
      'Retomando actividad después de una pausa.',
      'Tu historial sigue disponible.',
      'Puedes continuar desde donde lo dejaste.',
      'Actividad reanudada.',
      'De vuelta al registro.',
    ]),
  },

  task_started: {
    no_respect: bank('generic', 'task_started', 'no_respect', [
      'Abre el puto archivo. Ya, ahorita.',
      'Cinco minutos, cabrón. Tampoco te estoy pidiendo un riñón.',
      'Hazlo culero, pero hazlo.',
      'No necesitas ganas, solo necesitas empezar. Muévete.',
      'El primer paso es el más pendejo de dar y el más importante.',
      'Deja de pensarlo tanto, que se te va a hacer tarde para procrastinar otra cosa.',
      'Nomás abre la cosa. Lo demás se acomoda solo, casi siempre.',
      'Tu yo del futuro te va a odiar si no arrancas ahorita.',
      'No hay musa, no hay inspiración, solo hay que empezar. Va.',
      'Total, ya perdiste más tiempo pensándolo que lo que te toma hacerlo.',
    ]),
    trusted: bank('generic', 'task_started', 'trusted', [
      'Solo abre el material. Lo demás suele seguir.',
      'Haz solo 5 minutos. Eso mantiene el hábito vivo.',
      'No tiene que salir bien, solo tiene que ocurrir.',
      'Empezar es la parte difícil. Ya lo estás logrando con este paso.',
      'Un mínimo hoy vale más que un perfecto mañana.',
      'No necesitas sentirte listo para empezar, solo empezar.',
      'El primer minuto siempre es el más pesado. Después fluye.',
      'Puedes parar cuando quieras, pero empieza.',
      'Basta con abrir la puerta. No hace falta correr todavía.',
    ]),
    normal: bank('generic', 'task_started', 'normal', [
      'Puedes comenzar cuando quieras.',
      'Un primer paso pequeño es suficiente para arrancar.',
      'Este es un buen momento para empezar.',
      'Comienza con lo mínimo indispensable.',
      'Abre el material y continúa desde ahí.',
      'Listo para comenzar cuando tú digas.',
    ]),
  },

  minimal_version: {
    no_respect: bank('generic', 'minimal_version', 'no_respect', [
      'Ni que fuera para tanto. Registra el mínimo y ya.',
      'Lo mínimo también cuenta, no te hagas el héroe innecesario.',
      'Menos es más, y hoy menos también es victoria.',
      'Un cachito es mejor que nada. Anótalo y sigue tu vida.',
      'No todo tiene que ser epopeya. A veces solo es sobrevivir el día.',
      "El mínimo de hoy es el 'sí me acordé de ti' de mañana.",
      'Nadie te va a dar medalla, pero al menos no quedaste en ceros.',
      'Bájale a las exigencias. El mínimo también suma, cabrón.',
      'Hiciste lo justo y necesario. Ya, tampoco te claves.',
      'Con que aparezcas ya ganaste la mitad del partido.',
    ]),
    trusted: bank('generic', 'minimal_version', 'trusted', [
      'La versión mínima también construye el hábito.',
      'No hiciste todo, pero hiciste algo. Eso cuenta.',
      'Un mínimo consistente le gana a un perfecto ocasional.',
      'Está bien no dar el cien por ciento hoy.',
      'Lo pequeño de hoy sostiene lo grande de mañana.',
      'Registrar el mínimo es mejor que no registrar nada.',
      'Hiciste lo que pudiste, y con eso basta por hoy.',
      'El mínimo también es una forma de mantener la promesa contigo mismo.',
      'Aparecer, aunque sea poco, ya es parte del trabajo.',
    ]),
    normal: bank('generic', 'minimal_version', 'normal', [
      'Versión mínima registrada.',
      'Registro guardado como versión mínima.',
      'Se registró el mínimo definido para este hábito.',
      'Avance mínimo registrado correctamente.',
      'Versión reducida completada.',
      'Registrado: versión mínima cumplida.',
    ]),
  },

  too_many_goals: {
    no_respect: bank('generic', 'too_many_goals', 'no_respect', [
      'No mames, esto ya parece menú de fonda. Baja las opciones.',
      'Un solo cuerpo y quince pinches futuros posibles. Elige uno, campeón.',
      'Con tantas metas activas ya pareces catálogo, no persona.',
      'Menos metas, más chamba real en cada una.',
      'Si le entras a todo a la vez, no le entras a nada bien.',
      'Tantas direcciones y ninguna con gasolina de verdad.',
      'Esto no es Black Friday, no te lleves todo solo porque está ahí.',
      'Elige dos y mándale que las demás esperan sentaditas.',
    ]),
    trusted: bank('generic', 'too_many_goals', 'trusted', [
      'Tener muchas metas activas puede dispersar tu energía.',
      'Menos metas a la vez suele significar más avance real.',
      'Está bien pausar algunas para enfocarte en las que más importan.',
      'El foco rinde más que la cantidad.',
      'Elegir menos no es rendirse, es ser realista con tu tiempo.',
      'Prioriza dos o tres. Las demás pueden esperar su turno.',
      'Un enfoque más chico suele avanzar más rápido que uno disperso.',
    ]),
    normal: bank('generic', 'too_many_goals', 'normal', [
      'Tienes varias metas activas al mismo tiempo.',
      'Considera reducir el número de metas activas.',
      'Muchas metas simultáneas pueden dificultar el seguimiento.',
      'Recomendación: enfócate en pocas metas a la vez.',
      'Número elevado de metas activas detectado.',
    ]),
  },

  perfectionism_detected: {
    no_respect: bank('generic', 'perfectionism_detected', 'no_respect', [
      'Ya quedó, Miguel Ángel. Suelta la pinche Capilla Sixtina.',
      'Eso ya no es perfeccionismo; es miedo con buen diseño.',
      'Nadie te va a calificar la letra. Entrégalo ya.',
      'Le llevas tres revisiones a algo que nadie más va a notar.',
      'El 80% bien hecho hoy le gana al 100% que nunca sale.',
      'Ya bájale, no estás fabricando reliquia de museo.',
      'Perfecto es el enemigo de terminado, y tú llevas rato peleando con él.',
      'Suéltalo. Lo perfecto no existe, lo entregado sí.',
    ]),
    trusted: bank('generic', 'perfectionism_detected', 'trusted', [
      'Parece que estás buscando la perfección antes de avanzar.',
      'A veces terminar vale más que pulir de más.',
      'Puedes soltarlo así. Ya cumple con lo necesario.',
      'El perfeccionismo aquí podría estar frenando el avance real.',
      'Está bien que no sea perfecto. Que exista ya es un logro.',
      'Revisar una vez más no lo va a mejorar tanto como crees.',
      'Confía en que lo que ya hiciste es suficiente por hoy.',
    ]),
    normal: bank('generic', 'perfectionism_detected', 'normal', [
      'Se detectaron múltiples revisiones sobre la misma tarea.',
      'Considera avanzar con la versión actual.',
      'El nivel de detalle podría estar retrasando el cierre.',
      'Es un buen momento para dar por terminada esta tarea.',
      'Revisión repetida detectada en esta actividad.',
    ]),
  },

  inactivity_return: {
    no_respect: bank('generic', 'inactivity_return', 'no_respect', [
      'Llevas {daysAway} días desaparecido. ¿Todo bien o nomás flojera?',
      'El polvo ya se está acumulando en tu progreso, ven a sacudirlo.',
      '{daysAway} días de silencio. Ni que te hubiera secuestrado el trabajo.',
      'Aquí seguimos, esperando como perro en la puerta.',
      'Ya hasta se me hizo raro no verte por acá.',
      'No es regaño, es carrilla: ¿dónde andabas, cabrón?',
      'El hábito no se cancela solo, pero tampoco se cuida solo.',
      'Volviste justo antes de que te diera por perdido.',
    ]),
    trusted: bank('generic', 'inactivity_return', 'trusted', [
      'Han pasado {daysAway} días sin actividad. Cuando quieras, retomamos.',
      'No hay prisa. Lo que construiste sigue ahí esperándote.',
      'Está bien tomarse un respiro. Aquí sigue todo listo.',
      'Notamos que llevas un tiempo sin registrar. ¿Seguimos?',
      'Nada se pierde por una pausa. Retomar también cuenta.',
      'Cuando estés listo, este espacio sigue siendo tuyo.',
      'Un tiempo sin actividad no borra lo que ya lograste.',
    ]),
    normal: bank('generic', 'inactivity_return', 'normal', [
      'Sin actividad reciente registrada.',
      'Han pasado {daysAway} días desde el último registro.',
      'No se detectó actividad en los últimos días.',
      'Retoma cuando quieras: tu historial sigue disponible.',
      'Actividad pausada temporalmente.',
    ]),
  },

  goal_completed: {
    no_respect: bank('generic', 'goal_completed', 'no_respect', [
      'Chingón, meta cerrada. Ahora sí puedes presumir sin exagerar.',
      '{habitName} completado. Se vale hasta el baile de la victoria.',
      "Meta cumplida. Guárdate el drama de 'no iba a poder', ya sabemos que sí pudiste.",
      'Eso es. Otra meta tachada, otra excusa menos para el futuro.',
      'Lo lograste, cabrón. Ya deja de dudar de ti mismo por un rato.',
      'Meta completada. Hasta se te ve la cara de orgullo desde acá.',
      'Bien ahí. Una menos en la lista, y esta sí la cerraste bien.',
      'Terminaste lo que empezaste. No es poca cosa, la neta.',
    ]),
    trusted: bank('generic', 'goal_completed', 'trusted', [
      'Meta completada. Este logro es tuyo, disfrútalo.',
      'Lo lograste. Vale la pena reconocer el esfuerzo detrás de esto.',
      'Una meta más cerrada con trabajo real.',
      'Terminaste algo que empezaste. Eso importa más de lo que crees.',
      'Buen cierre. Te lo ganaste paso a paso.',
      'Meta cumplida: la constancia rindió fruto.',
      'Este logro es evidencia de lo que sí puedes sostener.',
    ]),
    normal: bank('generic', 'goal_completed', 'normal', [
      'Meta marcada como completada.',
      'Objetivo cumplido correctamente.',
      'Meta cerrada con éxito.',
      'Registro de meta completada guardado.',
      'Meta finalizada.',
    ]),
  },

  goal_paused: {
    no_respect: bank('generic', 'goal_paused', 'no_respect', [
      '{goalName} queda en pausa. El contexto sigue ahí; no hay que empezar de cero.',
      'Pausa guardada. {goalName} no se fue a ningún lado.',
      '{goalName} se baja un rato del escenario. Después decides qué sigue.',
    ]),
    trusted: bank('generic', 'goal_paused', 'trusted', [
      '{goalName} quedó en pausa con todo su contexto.',
      'La pausa está guardada. Puedes volver a {goalName} sin recuperar días.',
      'Pausar conserva lo avanzado en {goalName}.',
    ]),
    normal: bank('generic', 'goal_paused', 'normal', [
      'Meta pausada: {goalName}.',
      '{goalName} quedó en pausa sin perder su historial.',
      'La pausa de la meta quedó guardada.',
    ]),
  },

  goal_returned: {
    no_respect: bank('generic', 'goal_returned', 'no_respect', [
      'Volviste a {goalName}. Sin cuentas atrasadas: elige el siguiente movimiento.',
      '{goalName} vuelve a estar activa. Empezamos desde hoy, no desde la culpa.',
      'Regreso registrado. {goalName} sigue desde donde tiene sentido.',
    ]),
    trusted: bank('generic', 'goal_returned', 'trusted', [
      'Qué bueno que volviste a {goalName}. No necesitas recuperar todo.',
      '{goalName} está activa otra vez. Elige un paso pequeño para continuar.',
      'Retomar también cuenta. Tu contexto anterior sigue disponible.',
    ]),
    normal: bank('generic', 'goal_returned', 'normal', [
      'Meta reanudada: {goalName}.',
      '{goalName} volvió al trabajo activo.',
      'La meta quedó activa nuevamente con su historial anterior.',
    ]),
  },

  goal_reformulated: {
    no_respect: bank('generic', 'goal_reformulated', 'no_respect', [
      '{goalName} cambió de forma, no desapareció. Nueva dirección, mismo aprendizaje.',
      'Reformulación lista. Ajustar el mapa también es avanzar.',
      'La meta anterior quedó cerrada y conectada. Ahora sí, rumbo nuevo.',
    ]),
    trusted: bank('generic', 'goal_reformulated', 'trusted', [
      '{goalName} quedó reformulada y vinculada con su versión anterior.',
      'Cambiar la meta también puede ser avanzar. El historial permanece.',
      'Nueva dirección guardada sin borrar lo aprendido.',
    ]),
    normal: bank('generic', 'goal_reformulated', 'normal', [
      'Meta reformulada: {goalName}.',
      'La nueva meta quedó vinculada con la versión anterior.',
      'Reformulación guardada con trazabilidad.',
    ]),
  },

  goal_closed: {
    no_respect: bank('generic', 'goal_closed', 'no_respect', [
      'Se cerró el expediente de {goalName}. Bien ahí.',
      '{goalName} quedó cerrada con intención. Lo hecho se queda.',
      'Cierre listo. No todo final necesita fanfarria para contar.',
    ]),
    trusted: bank('generic', 'goal_closed', 'trusted', [
      'Cerraste {goalName} de forma consciente.',
      '{goalName} quedó cerrada y su recorrido permanece disponible.',
      'Cierre guardado. Lo aprendido también forma parte del resultado.',
    ]),
    normal: bank('generic', 'goal_closed', 'normal', [
      'Meta cerrada: {goalName}.',
      'El cierre de la meta quedó registrado.',
      '{goalName} quedó finalizada con su historial intacto.',
    ]),
  },

  session_completed: {
    no_respect: bank('generic', 'session_completed', 'no_respect', [
      'Bloque cerrado. Esos {minutes} minutos ya cuentan; no les inventemos examen.',
      'Sesión lista. Dejaste un punto claro para volver a {goalName}.',
      'Se acabó este bloque, no el mundo. El avance quedó guardado.',
    ]),
    trusted: bank('generic', 'session_completed', 'trusted', [
      'Sesión guardada. Puedes volver exactamente desde aquí.',
      '{minutes} minutos dedicados a {goalName}; el resultado quedó registrado.',
      'Este bloque terminó y tu siguiente punto de entrada sigue claro.',
    ]),
    normal: bank('generic', 'session_completed', 'normal', [
      'Sesión completada y guardada.',
      'Se registraron {minutes} minutos de trabajo en {goalName}.',
      'El resultado de la sesión quedó disponible en el historial.',
    ]),
  },

  evening_summary: {
    no_respect: bank('generic', 'evening_summary', 'no_respect', [
      'Resumen listo: {completions} de {total} con registro. Lo demás no se vuelve deuda.',
      'El día ya dijo lo que tenía que decir. Guarda lo que pasó y suéltalo.',
      'Cierre nocturno disponible. Sin regaños y sin tareas retroactivas.',
    ]),
    trusted: bank('generic', 'evening_summary', 'trusted', [
      'Tu resumen de hoy está listo. Lo pendiente no se convierte en deuda.',
      '{completions} de {total} con registro. Puedes cerrar el día desde aquí.',
      'Guarda lo que sí pasó y deja que mañana empiece limpio.',
    ]),
    normal: bank('generic', 'evening_summary', 'normal', [
      'Resumen nocturno disponible.',
      'Hoy hay {completions} de {total} actividades con registro.',
      'Puedes revisar y cerrar el registro de hoy.',
    ]),
  },

  day_closed: {
    no_respect: bank('generic', 'day_closed', 'no_respect', [
      'Día cerrado. Ya bájale a la pantalla y ve a dormir, cabrón.',
      'Listo, otro día en la bolsa. Ni tan mal, ni tan trágico.',
      'Se acabó el día. Lo que no se hizo, se hace mañana, no hoy a las 2am.',
      'Cerrado con {completions} de {total}. Nada mal para un día cualquiera.',
      'Ya, ciérralo. Mañana seguimos con más pretextos frescos.',
      'Día cerrado. El sillón ya te extraña, ve con él.',
    ]),
    trusted: bank('generic', 'day_closed', 'trusted', [
      'Día cerrado. Cada registro de hoy cuenta, completo o mínimo.',
      '{completions} de {total} con registro. Un cierre honesto es suficiente.',
      'Buen cierre de día. Mañana seguimos desde aquí.',
      'Ningún día tiene que ser perfecto para contar.',
      'Registro del día completado. Descansa, te lo ganaste.',
    ]),
    normal: bank('generic', 'day_closed', 'normal', [
      'Día cerrado: {completions} de {total} con registro.',
      'Registro diario finalizado.',
      'Resumen del día guardado.',
      'Cierre de día completado.',
    ]),
  },

  // Cross-habit pings — not tied to a specific habit name. Used by
  // notifications.service.js's scheduler for the once-a-day morning
  // motivation ping and the "you haven't logged anything today" nudge.
  morning_motivation: {
    no_respect: bank('generic', 'morning_motivation', 'no_respect', [
      'Buenos días. Ya deja la cama y vamos a hacer algo con el día.',
      'Arriba. El día no se va a ganar solo viéndolo desde la almohada.',
      'Otro día, otra oportunidad de no cagarla como ayer.',
      'A darle. Un paso pequeño hoy y ya la hicimos.',
    ]),
    trusted: bank('generic', 'morning_motivation', 'trusted', [
      'Buen día. Hoy también cuenta un paso pequeño.',
      'Empieza suave: un registro basta para tomar impulso.',
      'No tienes que hacerlo perfecto, solo empezar hoy.',
    ]),
    normal: bank('generic', 'morning_motivation', 'normal', [
      'Buen día. Este es tu recordatorio matutino.',
      'Nuevo día disponible para registrar tus hábitos.',
      'Recordatorio matutino programado.',
    ]),
  },

  inactivity_nudge: {
    no_respect: bank('generic', 'inactivity_nudge', 'no_respect', [
      'Todavía no registras nada hoy. Ni pedo, pero ya muévete.',
      'El día se acaba y tú sigues en las mismas. Ve y anota algo.',
      'Aquí sigo esperando tu registro de hoy, como perro en la puerta.',
      'Ni un registro en todo el día. Se puede ser flojo, pero no tanto.',
    ]),
    trusted: bank('generic', 'inactivity_nudge', 'trusted', [
      'Todavía puedes cerrar el día. Un paso pequeño también cuenta.',
      'Aún hay tiempo para un registro, aunque sea mínimo.',
      'No hace falta que sea mucho, solo que quede algo anotado.',
    ]),
    normal: bank('generic', 'inactivity_nudge', 'normal', [
      'No se ha registrado actividad hoy.',
      'Recordatorio: aún no hay registro para hoy.',
      'Puedes registrar tu día antes de que termine.',
    ]),
  },

  sync_error: {
    trusted: bank('generic', 'sync_error', 'trusted', [
      'No pudimos sincronizar todavía. Tu registro local sigue intacto.',
      'La nube no respondió. Lo que hiciste permanece guardado aquí y volveremos a intentarlo.',
      'La sincronización quedó pendiente; puedes seguir usando Traker normalmente.',
    ]),
    normal: bank('generic', 'sync_error', 'normal', [
      'Error de sincronización. La copia local permanece guardada.',
      'No fue posible actualizar la nube. Se reintentará después.',
      'La sincronización está pendiente; no se perdieron datos locales.',
    ]),
  },

  generic_error: {
    trusted: bank('generic', 'generic_error', 'trusted', [
      'Algo no salió como esperábamos. Puedes intentarlo otra vez.',
      'No pudimos completar esa acción. Tu información anterior sigue intacta.',
      'Hubo un problema. Reintenta cuando estés listo.',
    ]),
    normal: bank('generic', 'generic_error', 'normal', [
      'No se pudo completar la acción.',
      'Ocurrió un error. Puedes volver a intentarlo.',
      'La operación no terminó; los datos anteriores no cambiaron.',
    ]),
  },

  // No `no_respect` on purpose: real risk of confusing an actual error
  // with a joke is exactly what the user asked to avoid.
  offline: {
    trusted: bank('generic', 'offline', 'trusted', [
      'Sin conexión por ahora. Tus datos están guardados y se sincronizan en cuanto vuelva el internet.',
      'Se perdió la señal. No te preocupes, nada se pierde aquí.',
      'Estamos offline. Estos cambios se guardan localmente y se suben después.',
      'Hubo un problema al sincronizar, pero tu información local sigue intacta.',
      'No hay internet en este momento. Todo tu progreso queda guardado en el dispositivo.',
      'Falló la conexión con el servidor. Reintentaremos automáticamente.',
      'Estás trabajando sin conexión. Estos registros se sincronizarán cuando vuelva la señal.',
      'Ocurrió un error al guardar en la nube, pero la copia local está a salvo.',
    ]),
    normal: bank('generic', 'offline', 'normal', [
      'Sin conexión a internet.',
      'Error al sincronizar con el servidor.',
      'No se pudo conectar. Los datos se guardarán localmente.',
      'Error de sincronización. Se reintentará automáticamente.',
      'Sin señal de red en este momento.',
      'No fue posible completar la sincronización.',
      'Error inesperado. Tus datos locales están seguros.',
    ]),
  },
}

// ─────────────────────────────────────────────────────────────────────────
// Category overrides — only for reminder / completed / returned
// ─────────────────────────────────────────────────────────────────────────

function categoryBank(category, phrases) {
  return {
    habit_reminder: {
      no_respect: bank(category, 'habit_reminder', 'no_respect', phrases.reminder.no_respect),
      trusted:    bank(category, 'habit_reminder', 'trusted',    phrases.reminder.trusted),
      normal:     bank(category, 'habit_reminder', 'normal',     phrases.reminder.normal),
    },
    habit_completed: {
      no_respect: bank(category, 'habit_completed', 'no_respect', phrases.completed.no_respect),
      trusted:    bank(category, 'habit_completed', 'trusted',    phrases.completed.trusted),
      normal:     bank(category, 'habit_completed', 'normal',     phrases.completed.normal),
    },
    habit_returned: {
      no_respect: bank(category, 'habit_returned', 'no_respect', phrases.returned.no_respect),
      trusted:    bank(category, 'habit_returned', 'trusted',    phrases.returned.trusted),
      normal:     bank(category, 'habit_returned', 'normal',     phrases.returned.normal),
    },
  }
}

export const CATEGORY_EVENTS = {
  gym: categoryBank('gym', {
    reminder: {
      no_respect: [
        'Oinc, oinc. ¿Ya fuiste al gym?',
        'Órale, marrano, a mover la maquinaria.',
        'El músculo no sale viendo rutinas en TikTok.',
        'Tu playera de gym sigue doblada, cabrón. Úsala.',
        'La proteína no se justifica sola, ve y gánatela.',
        'Levanta algo que no sea el control remoto.',
        'El espejo del gym te está esperando para el mismo drama de siempre.',
        'Nadie creció fuerte quedándose en el sillón, ni tú vas a ser el primero.',
      ],
      trusted: [
        'Hora del gym. Aunque sea la versión corta, cuenta.',
        'Tu cuerpo agradece cada sesión, chiquita o completa.',
        'Un entrenamiento breve también construye consistencia.',
        'Vamos al gym. No tiene que ser el mejor día, solo un día más.',
        'Recuerda: aparecer ya es la mitad del trabajo.',
        'Hora de moverte. Tu yo de mañana te lo va a agradecer.',
        'Ve al gym cuando puedas hoy. Cualquier esfuerzo suma.',
      ],
      normal: [
        'Recordatorio: sesión de gimnasio programada.',
        'Hora de tu entrenamiento.',
        'Tienes pendiente tu rutina de gym.',
        'Sesión de ejercicio disponible para registrar.',
        'Recordatorio de entrenamiento físico.',
      ],
    },
    completed: {
      no_respect: [
        'A huevo, cabrón. Hoy sí justificaste la proteína.',
        'No faltaste. Milagro anabólico.',
        'Gym hecho. Ya te ganaste el derecho a quejarte de las agujetas.',
        'Músculo desbloqueado, nivel: presumible en el espejo.',
        'Fuiste, sudaste, sobreviviste. Eso ya es más que muchos.',
        'Otra sesión en la bolsa. El sillón tendrá que esperar.',
        'Hoy sí le entraste. Guarda esta racha como oro.',
        'Gym: check. Ahora sí puedes hablar de gains con cara seria.',
      ],
      trusted: [
        'Entrenamiento completado. Bien por presentarte hoy.',
        'Otra sesión lograda. Se nota el esfuerzo constante.',
        'Gym registrado. Cada sesión construye la siguiente.',
        'Buen trabajo hoy en el entrenamiento.',
        'Sesión completada. Tu cuerpo lo va a notar con el tiempo.',
        'Cumpliste con tu entrenamiento de hoy.',
        'Otro día activo registrado. Vas construyendo el hábito.',
      ],
      normal: [
        'Entrenamiento registrado como completado.',
        'Sesión de gimnasio completada.',
        'Registro de ejercicio guardado.',
        'Rutina física completada hoy.',
        'Entrenamiento marcado como hecho.',
      ],
    },
    returned: {
      no_respect: [
        'Regresaste al gym. Los fierros no te guardaron rencor.',
        'Volviste. El espejo también te extrañaba.',
        'Ya te tardaste, pero aquí sigue tu rutina esperándote.',
        'El gym no cierra rencores, solo abre a las mismas horas de siempre.',
      ],
      trusted: [
        'Volviste al gym. Empezamos donde lo dejaste, sin presión.',
        'El progreso anterior sigue ahí. Bienvenido de vuelta.',
        'Retomar el entrenamiento también es un logro.',
      ],
      normal: [
        'Actividad de gimnasio reanudada.',
        'De vuelta al entrenamiento.',
        'Retomando tu rutina física.',
      ],
    },
  }),

  cardio: categoryBank('cardio', {
    reminder: {
      no_respect: [
        'Las piernas no se corren solas, cabrón.',
        'Ponte los tenis antes de que se te olvide dónde los dejaste.',
        'El sillón no cuenta como circuito de cardio, aunque tú insistas.',
        'Sal a correr, aunque sea para huir de tus pendientes.',
        'Tu corazón quiere trabajar, no solo latir viendo memes.',
        'Ándale, unos minutos de cardio y ya la hiciste por hoy.',
        'El aire libre existe, y hoy te toca visitarlo corriendo.',
        'No hace falta maratón, con trotar un rato ya vas ganando.',
      ],
      trusted: [
        'Hora de moverte un poco. Cardio, cuando puedas.',
        'Unos minutos de cardio también cuentan hoy.',
        'Tu cuerpo agradece el movimiento, aunque sea breve.',
        'Buen momento para salir a caminar o correr un rato.',
        'No necesitas ir lejos, solo empezar a moverte.',
        'Cardio de hoy: lo que puedas dar está bien.',
        'Un poco de movimiento cardiovascular te espera.',
      ],
      normal: [
        'Recordatorio: sesión de cardio programada.',
        'Hora de tu actividad cardiovascular.',
        'Tienes pendiente tu sesión de cardio.',
        'Actividad física disponible para registrar.',
        'Recordatorio de ejercicio cardiovascular.',
      ],
    },
    completed: {
      no_respect: [
        'Corriste. El sofá va a tener que esperar sentado.',
        'Cardio hecho. Tus pulmones te lo van a cobrar mañana, mereciditamente.',
        'Sudaste sin que fuera por nervios. Bien ahí.',
        'Otra sesión de cardio en la bolsa, aunque sea a paso de tortuga.',
        'Le ganaste al sedentarismo, aunque sea por hoy.',
        'Cardio completado. Tu corazón te manda las gracias, a su manera.',
        'Hiciste ejercicio y no explotaste. Buen resultado.',
        'Corriste, caminaste o lo que hayas hecho: cuenta y ya está.',
      ],
      trusted: [
        'Cardio completado. Bien por moverte hoy.',
        'Otra sesión registrada. Tu constancia va sumando.',
        'Buen trabajo con tu actividad cardiovascular.',
        'Sesión de cardio lograda hoy.',
        'Cada sesión de cardio construye resistencia, poco a poco.',
        'Cumpliste con tu movimiento de hoy.',
        'Registro de cardio completado con éxito.',
      ],
      normal: [
        'Actividad cardiovascular registrada.',
        'Sesión de cardio completada.',
        'Registro de ejercicio cardiovascular guardado.',
        'Cardio marcado como hecho.',
        'Actividad física completada hoy.',
      ],
    },
    returned: {
      no_respect: [
        'Volviste a correr. Las banquetas te siguen esperando.',
        'Regresaste al cardio. Ya extrañábamos verte sudar por buenas razones.',
        'El aire libre te recibe de vuelta, sin rencores.',
        'Retomaste el trote. Nadie te va a preguntar por qué tardaste.',
      ],
      trusted: [
        'Volviste a moverte. Cada retorno cuenta.',
        'Retomar el cardio también es parte del proceso.',
        'Bienvenido de vuelta a tu actividad física.',
      ],
      normal: [
        'Actividad cardiovascular reanudada.',
        'De vuelta al ejercicio cardiovascular.',
        'Retomando tu rutina de cardio.',
      ],
    },
  }),

  hydration: categoryBank('hydration', {
    reminder: {
      no_respect: [
        'Tómate un vaso de agua, no todo en la vida es café.',
        'Tu cuerpo es 60% agua y 40% pretextos para no tomarla.',
        'Hidrátate, que la resaca de deshidratación también existe.',
        'El agua no se va a tomar sola, aunque tú actúes como si sí.',
        'Menos refresco, más agua. Ya lo sabes, hazlo.',
        'Tu orina amarillo neón te está mandando un mensaje. Tómate el agua.',
        'Un vaso de agua ahorita, que luego se te olvida hasta la sed.',
        'No es normal recordar hidratarte con notificación, pero aquí estamos.',
      ],
      trusted: [
        'Un vaso de agua te caería bien ahorita.',
        'Recuerda hidratarte un poco durante el día.',
        'Tu cuerpo funciona mejor con suficiente agua. Un vaso más no está de más.',
        'Buen momento para tomar agua.',
        'Pequeño recordatorio: hidrátate, aunque sea un poco.',
        'El agua ayuda más de lo que parece. Toma un poco.',
        'Un vaso de agua ahora te ayuda a seguir el día mejor.',
      ],
      normal: [
        'Recordatorio: hora de hidratarte.',
        'Tienes pendiente tu registro de agua.',
        'Hora programada de hidratación.',
        'Recordatorio de consumo de agua.',
        'Puedes registrar tu hidratación ahora.',
      ],
    },
    completed: {
      no_respect: [
        'Tomaste agua. Tu riñón manda saludos y las gracias.',
        'Hidratado como se debe. Ni una gota de pretexto hoy.',
        'Agua: hecho. Ahora sí puedes seguir con tu café sin culpa.',
        'Tu piel te lo va a agradecer, aunque no te lo diga en la cara.',
        'Cumpliste con el agua. Milagro moderno.',
        'Nada de excusas hoy, te hidrataste como la gente.',
        'Agua registrada. Un logro chiquito pero real.',
        'Bien ahí, hidratado y sin necesitar recordatorio doble.',
      ],
      trusted: [
        'Hidratación registrada. Bien hecho.',
        'Tomaste suficiente agua hoy. Tu cuerpo lo agradece.',
        'Buen trabajo manteniéndote hidratado.',
        'Registro de agua completado.',
        'Otro día cuidando tu hidratación.',
        'Cumpliste con tu meta de agua hoy.',
        'Hidratación completada con éxito.',
      ],
      normal: [
        'Hidratación registrada correctamente.',
        'Consumo de agua completado.',
        'Registro de hidratación guardado.',
        'Meta de agua marcada como cumplida.',
        'Hidratación completada hoy.',
      ],
    },
    returned: {
      no_respect: [
        'Volviste a tomar agua en serio. Tu riñón lo celebra.',
        'Regresaste a hidratarte. Ya iba siendo hora.',
        'El vaso de agua te sigue esperando, sin rencores.',
        'Retomaste la hidratación. Bien por ti, en serio.',
      ],
      trusted: [
        'Volviste a cuidar tu hidratación. Cada retorno cuenta.',
        'Retomar el agua también es parte del cuidado.',
        'Bienvenido de vuelta a tu hábito de hidratación.',
      ],
      normal: [
        'Registro de hidratación reanudado.',
        'De vuelta al seguimiento de agua.',
        'Retomando tu hábito de hidratación.',
      ],
    },
  }),

  sleep: categoryBank('sleep', {
    reminder: {
      no_respect: [
        'Ya bájale a la pantalla, que mañana no vas a rendir ni tantito.',
        'Dormir no es de flojos, es de gente que sí quiere funcionar mañana.',
        'Tu cama existe. Úsala, no la decores nada más.',
        'El scroll infinito no te va a dar más horas de sueño, cabrón.',
        'A dormir. Mañana sigues viendo memes, hoy ya no.',
        'Tus ojeras ya están mandando mensajes de auxilio.',
        'Ni Netflix ni pretextos: hora de dormir.',
        'El celular puede esperar hasta mañana, tu descanso no.',
      ],
      trusted: [
        'Es buena hora para empezar a prepararte para dormir.',
        'Tu cuerpo agradece un horario de sueño constante.',
        'Un buen descanso también cuenta como cuidado personal.',
        'Considera bajarle a las pantallas antes de dormir.',
        'Hora de ir cerrando el día y descansar.',
        'Dormir bien hoy te ayuda a rendir mejor mañana.',
        'Buen momento para ir preparando tu descanso.',
      ],
      normal: [
        'Recordatorio: hora de dormir.',
        'Hora programada para descansar.',
        'Recordatorio de horario de sueño.',
        'Puedes registrar tu descanso ahora.',
        'Hora sugerida para ir a dormir.',
      ],
    },
    completed: {
      no_respect: [
        'Dormiste tus horas. Milagro entre tanta pantalla.',
        'Descanso cumplido. Ahora sí vas a rendir sin verte zombie.',
        'Le ganaste al scroll infinito y te fuiste a dormir a tiempo.',
        'Sueño registrado. Tus ojeras lo van a agradecer, tantito.',
        'Dormiste como la gente. Que no se te haga costumbre... es broma, que sí se te haga.',
        'Cumpliste con dormir. El bajo estándar del siglo, pero lo lograste.',
        'Descanso hecho. Ahora sí tienes permiso de estar de buenas.',
        'Le hiciste caso a tu cuerpo por una vez. Bien ahí.',
      ],
      trusted: [
        'Descanso registrado. Bien por priorizarlo.',
        'Dormiste tus horas. Tu cuerpo lo necesitaba.',
        'Buen trabajo cuidando tu sueño hoy.',
        'Registro de descanso completado.',
        'Cumpliste con tu horario de sueño.',
        'Otro día cuidando tu descanso.',
        'Sueño registrado con éxito.',
      ],
      normal: [
        'Descanso registrado correctamente.',
        'Horario de sueño completado.',
        'Registro de descanso guardado.',
        'Sueño marcado como cumplido.',
        'Descanso completado hoy.',
      ],
    },
    returned: {
      no_respect: [
        'Volviste a dormir horas decentes. Ya extrañábamos verte despierto sin ojeras.',
        'Regresaste al buen dormir. Tu cuerpo lo agradece, en silencio.',
        'Retomaste el descanso. Ya iba siendo hora, la verdad.',
        'La cama sigue ahí, sin rencores por tus desvelos pasados.',
      ],
      trusted: [
        'Volviste a cuidar tu descanso. Cada retorno importa.',
        'Retomar el sueño también es parte del cuidado.',
        'Bienvenido de vuelta a tu hábito de descanso.',
      ],
      normal: [
        'Registro de sueño reanudado.',
        'De vuelta al seguimiento de descanso.',
        'Retomando tu horario de sueño.',
      ],
    },
  }),

  nutrition: categoryBank('nutrition', {
    reminder: {
      no_respect: [
        'Las papitas no son comida balanceada, aunque tú insistas.',
        'Come algo que no venga en bolsa crujiente, por favor.',
        'Tu cuerpo no es basurero, cuida lo que le echas.',
        'Una verdura no te va a matar, inténtalo.',
        'El cuarto café del día no cuenta como alimento, cabrón.',
        'Hora de comer algo decente, no solo lo que esté más cerca.',
        'Tu nutrición te lo va a agradecer si por una vez planeas la comida.',
        'No es dieta, es solo comer algo que no sea puro antojo.',
      ],
      trusted: [
        'Buen momento para pensar en tu próxima comida.',
        'Recuerda incluir algo nutritivo en tu comida de hoy.',
        'Tu cuerpo funciona mejor con comidas balanceadas.',
        'Un pequeño esfuerzo en la comida de hoy también cuenta.',
        'Considera planear algo saludable para tu próxima comida.',
        'Comer con calma también es parte del cuidado.',
        'Buen momento para registrar tu alimentación.',
      ],
      normal: [
        'Recordatorio: registra tu alimentación.',
        'Hora de registrar tu comida.',
        'Tienes pendiente tu registro nutricional.',
        'Recordatorio de alimentación.',
        'Puedes registrar tu comida ahora.',
      ],
    },
    completed: {
      no_respect: [
        'Comiste bien. El cuerpo dice gracias, aunque no hable.',
        'Nutrición cumplida. Ni una papita de más hoy.',
        'Le entraste a comer decente. Milagro alimenticio del día.',
        'Registro de comida hecho. Tu futuro yo lo agradece.',
        'Comiste como adulto funcional, no como estudiante en crisis.',
        'Alimentación registrada. Vas ganando puntos con tu propio cuerpo.',
        'Nada mal, comiste bien sin que fuera aniversario.',
        'Cumpliste con la comida. El antojo esperó su turno hoy.',
      ],
      trusted: [
        'Alimentación registrada. Bien hecho.',
        'Comiste bien hoy. Tu cuerpo lo va a notar.',
        'Buen trabajo cuidando tu nutrición.',
        'Registro de comida completado.',
        'Cumpliste con tu meta de alimentación.',
        'Otro día cuidando lo que comes.',
        'Nutrición registrada con éxito.',
      ],
      normal: [
        'Registro de alimentación guardado.',
        'Comida registrada correctamente.',
        'Nutrición marcada como completada.',
        'Registro nutricional completado.',
        'Alimentación completada hoy.',
      ],
    },
    returned: {
      no_respect: [
        'Volviste a comer con cabeza. Ya extrañábamos verte cuidarte.',
        'Regresaste a la nutrición. La comida chatarra tendrá que esperar.',
        'Retomaste comer bien. Bien por ti, en serio.',
        'La cocina sigue ahí, sin rencores por tus antojos pasados.',
      ],
      trusted: [
        'Volviste a cuidar tu alimentación. Cada retorno cuenta.',
        'Retomar la nutrición también es parte del cuidado.',
        'Bienvenido de vuelta a tu hábito de alimentación.',
      ],
      normal: [
        'Registro de alimentación reanudado.',
        'De vuelta al seguimiento nutricional.',
        'Retomando tu hábito de alimentación.',
      ],
    },
  }),

  english: categoryBank('english', {
    reminder: {
      no_respect: [
        "Ándale, practica inglés antes de que se te olvide hasta el 'hello'.",
        'El Duolingo búho no perdona, pero yo tampoco: practica.',
        'No vas a aprender inglés viendo memes en español, cabrón.',
        'Diez minutitos de inglés y ya la hiciste por hoy.',
        'Tu inglés no se va a mejorar solo por desearlo mucho.',
        'Practica algo de inglés, aunque sea para insultar bien en dos idiomas.',
        'El vocabulario no se aprende viéndolo, hay que usarlo.',
        "Ya deja el 'ahorita' y ponte a practicar tu inglés.",
      ],
      trusted: [
        'Buen momento para practicar un poco de inglés.',
        'Diez minutos de práctica también cuentan hoy.',
        'Recuerda avanzar en tu aprendizaje de inglés.',
        'Un pequeño repaso de inglés te ayuda a mantener el ritmo.',
        'Considera practicar algo de inglés hoy.',
        'La constancia en el idioma vale más que las sesiones largas.',
        'Buen momento para tu práctica de inglés.',
      ],
      normal: [
        'Recordatorio: práctica de inglés programada.',
        'Hora de tu sesión de inglés.',
        'Tienes pendiente tu práctica de idioma.',
        'Recordatorio de estudio de inglés.',
        'Puedes registrar tu práctica de inglés ahora.',
      ],
    },
    completed: {
      no_respect: [
        'Practicaste inglés. Ya casi puedes ver series sin subtítulos, casi.',
        'Inglés hecho. Tu vocabulario ya no da tanta pena.',
        'Le entraste al idioma. El búho de Duolingo puede descansar hoy.',
        'Otra sesión de inglés en la bolsa. Nice, la neta.',
        'Practicaste sin excusas. Bien ahí, políglota en construcción.',
        "Cumpliste con el inglés. Ya no vas a decir 'how much is the fish' nomás.",
        'Sesión completada. Vas mejorando, aunque no lo notes todavía.',
        'Inglés registrado. Un paso más cerca de dejar de traducir todo mentalmente.',
      ],
      trusted: [
        'Práctica de inglés completada. Bien hecho.',
        'Otra sesión lograda. Vas construyendo el idioma poco a poco.',
        'Buen trabajo con tu práctica de hoy.',
        'Registro de inglés completado.',
        'Cumpliste con tu meta de estudio hoy.',
        'Cada sesión suma, aunque sea corta.',
        'Práctica registrada con éxito.',
      ],
      normal: [
        'Práctica de inglés registrada.',
        'Sesión de idioma completada.',
        'Registro de estudio de inglés guardado.',
        'Práctica marcada como completada.',
        'Sesión de inglés completada hoy.',
      ],
    },
    returned: {
      no_respect: [
        'Volviste al inglés. El vocabulario no te guardó rencor.',
        'Regresaste a practicar. Ya extrañábamos tu acento en construcción.',
        'Retomaste el idioma. Bien por ti, en serio.',
        'El Duolingo sigue ahí, sin rencores por los días perdidos.',
      ],
      trusted: [
        'Volviste a practicar inglés. Cada retorno cuenta.',
        'Retomar el idioma también es parte del proceso.',
        'Bienvenido de vuelta a tu práctica de inglés.',
      ],
      normal: [
        'Práctica de inglés reanudada.',
        'De vuelta al estudio del idioma.',
        'Retomando tu práctica de inglés.',
      ],
    },
  }),

  study: categoryBank('study', {
    reminder: {
      no_respect: [
        'Abre el cuaderno, no solo lo cargues de decoración.',
        'Estudiar no se hace por ósmosis, hay que abrir el libro.',
        'El examen no se va a resolver solo por estar cerca de tus apuntes.',
        'Ándale, unos minutos de estudio antes de que se acumule todo.',
        'Tu futuro yo te va a odiar si dejas todo para la noche antes.',
        'Menos procrastinar, más repasar. Va.',
        'El conocimiento no entra por ver la portada del libro.',
        'Estudia un rato, aunque sea para sentirte menos culpable después.',
      ],
      trusted: [
        'Buen momento para repasar un poco.',
        'Unos minutos de estudio también cuentan hoy.',
        'Recuerda avanzar en tu material de estudio.',
        'Un repaso breve te ayuda a mantener el ritmo.',
        'Considera dedicar un momento a estudiar hoy.',
        'La constancia en el estudio rinde más que las maratones.',
        'Buen momento para tu sesión de estudio.',
      ],
      normal: [
        'Recordatorio: sesión de estudio programada.',
        'Hora de tu sesión de estudio.',
        'Tienes pendiente tu tiempo de estudio.',
        'Recordatorio de estudio.',
        'Puedes registrar tu sesión de estudio ahora.',
      ],
    },
    completed: {
      no_respect: [
        'Estudiaste. El cuaderno ya no es solo decoración.',
        'Sesión hecha. Tu futuro yo te lo va a agradecer en el examen.',
        'Le entraste a estudiar sin que fuera la noche antes. Milagro.',
        'Otra sesión de estudio en la bolsa. Vas ganando terreno.',
        'Cumpliste con estudiar. El procrastinador de siempre, sorprendido.',
        'Repasaste sin drama. Bien ahí, aplicado.',
        'Sesión completada. Ya no vas a llegar al examen a rezar nomás.',
        'Estudio registrado. Un paso más cerca de no entrar en pánico después.',
      ],
      trusted: [
        'Sesión de estudio completada. Bien hecho.',
        'Otra sesión lograda. Vas construyendo el conocimiento poco a poco.',
        'Buen trabajo con tu estudio de hoy.',
        'Registro de estudio completado.',
        'Cumpliste con tu meta de estudio hoy.',
        'Cada sesión suma, aunque sea corta.',
        'Estudio registrado con éxito.',
      ],
      normal: [
        'Sesión de estudio registrada.',
        'Estudio completado.',
        'Registro de estudio guardado.',
        'Sesión marcada como completada.',
        'Estudio completado hoy.',
      ],
    },
    returned: {
      no_respect: [
        'Volviste a estudiar. Los apuntes no te guardaron rencor.',
        'Regresaste al estudio. Ya extrañábamos verte con el cuaderno abierto.',
        'Retomaste la sesión. Bien por ti, en serio.',
        'El material sigue ahí, sin rencores por los días perdidos.',
      ],
      trusted: [
        'Volviste a estudiar. Cada retorno cuenta.',
        'Retomar el estudio también es parte del proceso.',
        'Bienvenido de vuelta a tu hábito de estudio.',
      ],
      normal: [
        'Sesión de estudio reanudada.',
        'De vuelta al estudio.',
        'Retomando tu hábito de estudio.',
      ],
    },
  }),

  programming: categoryBank('programming', {
    reminder: {
      no_respect: [
        'Abre el IDE, no solo lo dejes minimizado de adorno.',
        'El código no se escribe solo, aunque el copilot ayude tantito.',
        'Ándale, unas líneas de código antes de que se enfríe la idea.',
        'Tu proyecto sigue con ese bug de hace tres días. Ve a verlo.',
        'Menos Stack Overflow de paseo, más código escrito.',
        'El commit de hoy no se va a hacer solo, cabrón.',
        'Programa un rato, aunque sea para pelearte con un error nuevo.',
        'Ese proyecto no se termina viéndolo desde lejos.',
      ],
      trusted: [
        'Buen momento para avanzar en tu código.',
        'Unos minutos de programación también cuentan hoy.',
        'Recuerda avanzar en tu proyecto.',
        'Un rato de código te ayuda a mantener el ritmo.',
        'Considera dedicar un momento a programar hoy.',
        'La constancia en el código rinde más que las maratones de último momento.',
        'Buen momento para tu sesión de programación.',
      ],
      normal: [
        'Recordatorio: sesión de programación programada.',
        'Hora de tu sesión de código.',
        'Tienes pendiente tu tiempo de programación.',
        'Recordatorio de desarrollo.',
        'Puedes registrar tu sesión de código ahora.',
      ],
    },
    completed: {
      no_respect: [
        'Programaste. El bug de hace tres días por fin tiene rival.',
        'Código escrito. El compilador no se quejó tanto hoy.',
        'Le entraste al proyecto sin procrastinar tanto. Milagro.',
        'Otra sesión de código en la bolsa. Vas avanzando de verdad.',
        'Cumpliste con programar. El commit de hoy no fue mentira.',
        'Escribiste código sin que fuera copiar y pegar de Stack Overflow.',
        'Sesión completada. El proyecto ya no te ve tan feo.',
        'Programación registrada. Un paso más cerca de terminar esto.',
      ],
      trusted: [
        'Sesión de programación completada. Bien hecho.',
        'Otra sesión lograda. Vas construyendo el proyecto poco a poco.',
        'Buen trabajo con tu código de hoy.',
        'Registro de programación completado.',
        'Cumpliste con tu meta de desarrollo hoy.',
        'Cada sesión suma, aunque sea corta.',
        'Código registrado con éxito.',
      ],
      normal: [
        'Sesión de programación registrada.',
        'Desarrollo completado.',
        'Registro de código guardado.',
        'Sesión marcada como completada.',
        'Programación completada hoy.',
      ],
    },
    returned: {
      no_respect: [
        'Volviste a programar. El proyecto no te guardó rencor.',
        'Regresaste al código. Ya extrañábamos verte pelear con errores.',
        'Retomaste la sesión. Bien por ti, en serio.',
        'El repositorio sigue ahí, sin rencores por los días perdidos.',
      ],
      trusted: [
        'Volviste a programar. Cada retorno cuenta.',
        'Retomar el proyecto también es parte del proceso.',
        'Bienvenido de vuelta a tu hábito de programación.',
      ],
      normal: [
        'Sesión de programación reanudada.',
        'De vuelta al desarrollo.',
        'Retomando tu hábito de programación.',
      ],
    },
  }),

  tidiness: categoryBank('tidiness', {
    reminder: {
      no_respect: [
        'Tu cuarto no se va a ordenar solo, por más que lo mires feo.',
        'Esa pila de ropa ya tiene nombre propio, cabrón.',
        'Ándale, ordena tantito antes de que el desorden gane la guerra.',
        'El piso existe debajo de tus cosas, lo prometo.',
        "Menos 'después lo hago', más ordenar ahorita.",
        'Tu espacio refleja tu cabeza, y ahorita ambos están de cabeza.',
        'Diez minutos de orden y ya no da tanta vergüenza si llega alguien.',
        'El tiradero no se va a acomodar solo por buena voluntad.',
      ],
      trusted: [
        'Buen momento para ordenar un poco tu espacio.',
        'Unos minutos de orden también cuentan hoy.',
        'Recuerda dedicar un rato a organizar.',
        'Un pequeño orden te ayuda a sentirte mejor en tu espacio.',
        'Considera ordenar algo hoy, aunque sea poco.',
        'La constancia en el orden rinde más que las limpiezas grandes.',
        'Buen momento para tu sesión de orden.',
      ],
      normal: [
        'Recordatorio: sesión de orden programada.',
        'Hora de organizar tu espacio.',
        'Tienes pendiente tu tiempo de orden.',
        'Recordatorio de limpieza.',
        'Puedes registrar tu sesión de orden ahora.',
      ],
    },
    completed: {
      no_respect: [
        'Ordenaste. Tu cuarto ya no parece escena de desastre natural.',
        'Orden hecho. Hasta se puede caminar sin tropezar ahora.',
        'Le entraste al tiradero y ganaste tú. Bien ahí.',
        'Otra sesión de orden en la bolsa. El piso agradece.',
        'Cumpliste con ordenar. Milagro doméstico del día.',
        'Organizaste sin que fuera emergencia por visitas.',
        'Sesión completada. Tu espacio ya no da tanta pena.',
        'Orden registrado. Un paso más cerca de encontrar cosas sin excavar.',
      ],
      trusted: [
        'Sesión de orden completada. Bien hecho.',
        'Otro espacio organizado. Se nota el esfuerzo.',
        'Buen trabajo ordenando hoy.',
        'Registro de orden completado.',
        'Cumpliste con tu meta de organización hoy.',
        'Cada sesión suma, aunque sea corta.',
        'Orden registrado con éxito.',
      ],
      normal: [
        'Sesión de orden registrada.',
        'Organización completada.',
        'Registro de limpieza guardado.',
        'Sesión marcada como completada.',
        'Orden completado hoy.',
      ],
    },
    returned: {
      no_respect: [
        'Volviste a ordenar. El desorden no te guardó rencor, por desgracia.',
        'Regresaste a organizar. Ya extrañábamos ver el piso.',
        'Retomaste el orden. Bien por ti, en serio.',
        'El clóset sigue ahí, sin rencores por los días perdidos.',
      ],
      trusted: [
        'Volviste a ordenar. Cada retorno cuenta.',
        'Retomar el orden también es parte del proceso.',
        'Bienvenido de vuelta a tu hábito de organización.',
      ],
      normal: [
        'Sesión de orden reanudada.',
        'De vuelta a la organización.',
        'Retomando tu hábito de orden.',
      ],
    },
  }),

  // Sensitive — no_respect intentionally omitted. See SENSITIVE_CATEGORIES.
  medication: {
    habit_reminder: {
      trusted: bank('medication', 'habit_reminder', 'trusted', [
        'Es hora de tu medicamento. Un recordatorio simple, sin drama.',
        'Recuerda tomar tu medicamento a tiempo.',
        'Hora del medicamento. Cuidarte también es parte del día.',
      ]),
      normal: bank('medication', 'habit_reminder', 'normal', [
        'Recordatorio: hora de tu medicamento.',
        'Tienes pendiente tomar tu medicamento.',
        'Recordatorio de medicación programado.',
      ]),
    },
    habit_completed: {
      trusted: bank('medication', 'habit_completed', 'trusted', [
        'Medicamento tomado. Gracias por cuidarte hoy.',
        'Registro de medicamento completado.',
        'Bien hecho al mantener tu tratamiento al día.',
      ]),
      normal: bank('medication', 'habit_completed', 'normal', [
        'Medicamento registrado como tomado.',
        'Registro de medicación completado.',
        'Toma de medicamento confirmada.',
      ]),
    },
    habit_returned: {
      trusted: bank('medication', 'habit_returned', 'trusted', [
        'Bienvenido de vuelta al seguimiento de tu medicamento.',
        'Retomar el registro también es parte del cuidado.',
      ]),
      normal: bank('medication', 'habit_returned', 'normal', [
        'Registro de medicamento reanudado.',
        'De vuelta al seguimiento de medicación.',
      ]),
    },
  },
}
