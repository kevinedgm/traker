<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { ArrowLeft, Check, CircleStop, LockKeyhole, Minus } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import GoalMinimumCompletionFeedback from '@/components/goals/GoalMinimumCompletionFeedback.vue'
import { useGoalsStore } from '@/stores/goals.js'
import { useCopy } from '@/composables/useCopy'

const route = useRoute()
const router = useRouter()
const store = useGoalsStore()
const { getPhrase } = useCopy()
const now = ref(Date.now())
const choosing = ref(false)
const busy = ref(false)
const note = ref('')
const result = ref(null)
const completedMinimum = ref(false)
const resultMessage = ref('')
const finishButton = ref(null)
const finishHeading = ref(null)
const resultHeading = ref(null)
const noteId = `${useId()}-note`
let ticker

const goal = computed(() => store.goals.find(item => item.id === route.params.id))
const action = computed(() => store.actionForGoal(route.params.id)
  ?? store.actions.find(item => item.goalId === route.params.id && item.status === 'in_progress'))
const session = computed(() => store.runningSession?.goalId === route.params.id ? store.runningSession : null)
const elapsedSeconds = computed(() => session.value
  ? Math.max(0, Math.floor((now.value - Date.parse(session.value.startedAt)) / 1000))
  : 0)
const elapsed = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

onMounted(async () => {
  if (!store.loaded) await store.load().catch(() => {})
  if (!store.runningSession && goal.value) await store.startSession(goal.value.id).catch(() => {})
  ticker = window.setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => window.clearInterval(ticker))

async function finish(outcome, { minimum = false } = {}) {
  if (!session.value) return
  busy.value = true
  try {
    const finished = await store.finishSession(session.value.id, outcome, note.value)
    result.value = finished
    completedMinimum.value = minimum
    resultMessage.value = getPhrase('session_completed', {
      vars: {
        goalName: finished.goal.title,
        minutes: Math.max(1, Math.ceil(finished.session.actualSeconds / 60)),
      },
    }).text
    choosing.value = false
    await nextTick()
    resultHeading.value?.focus()
  } catch (_) {} finally { busy.value = false }
}

async function openFinishChoices() {
  choosing.value = true
  await nextTick()
  finishHeading.value?.focus()
}

async function closeFinishChoices() {
  if (busy.value) return
  choosing.value = false
  await nextTick()
  finishButton.value?.focus()
}

function resultCopy(outcome) {
  return ({
    action_completed: ['Acción completada', resultMessage.value || 'Ese movimiento ya cuenta en tu meta.'],
    partial: ['Avance guardado', resultMessage.value || 'Puedes volver exactamente desde aquí.'],
    blocked: ['Bloqueo registrado', resultMessage.value || 'Nombrarlo ayuda a elegir un paso más viable.'],
    stopped_intentionally: ['Sesión cerrada', resultMessage.value || 'Detenerte con intención también protege tu energía.'],
  })[outcome]
}
</script>

<template>
  <main class="session-page">
    <button class="session-page__back" type="button" @click="router.push(`/goals/${route.params.id}`)"><ArrowLeft :size="18" /> Salir de la sesión</button>

    <GoalMinimumCompletionFeedback
      v-if="result && completedMinimum && result.action.minimumVersion"
      :goal-title="result.goal.title"
      :minimum-version="result.action.minimumVersion"
      :return-title="result.action.title"
      :minutes="Math.max(1, Math.ceil(result.session.actualSeconds / 60))"
      @continue="router.push(`/goals/${route.params.id}`)"
    />

    <section v-else-if="result" class="session-result" aria-live="polite">
      <span class="session-result__mark"><Check :size="28" /></span>
      <h1 ref="resultHeading" tabindex="-1">{{ resultCopy(result.session.outcome)[0] }}</h1>
      <p>{{ resultCopy(result.session.outcome)[1] }}</p>
      <strong>{{ Math.max(1, Math.ceil(result.session.actualSeconds / 60)) }} min dedicados</strong>
      <button type="button" @click="router.push(`/goals/${route.params.id}`)">Volver a la meta</button>
    </section>

    <template v-else-if="goal && action && session">
      <header class="session-page__header">
        <p>{{ goal.title }}</p>
        <h1>{{ action.title }}</h1>
      </header>

      <section class="session-clock" aria-label="Tiempo de sesión">
        <time :datetime="`PT${elapsedSeconds}S`">{{ elapsed }}</time>
        <p>El tiempo orienta; no califica tu esfuerzo.</p>
      </section>

      <section v-if="choosing" class="session-finish" aria-labelledby="finish-title" @keydown.esc="closeFinishChoices">
        <h2 id="finish-title" ref="finishHeading" tabindex="-1">¿Cómo quieres cerrar este bloque?</h2>
        <p>Elige lo que describe mejor lo ocurrido.</p>
        <label class="session-finish__note-label" :for="noteId">Nota para retomar <span>(opcional)</span></label>
        <textarea :id="noteId" v-model="note" rows="2" maxlength="300" placeholder="Algo que quieras recordar al volver" />
        <div class="session-finish__choices">
          <button type="button" :disabled="busy" @click="finish('action_completed')"><Check :size="19" /><span><strong>Terminé esta acción</strong><small>La siguiente quedará por definir</small></span></button>
          <button v-if="action.minimumVersion" type="button" :disabled="busy" @click="finish('partial', { minimum: true })"><Check :size="19" /><span><strong>Completé la versión mínima</strong><small>{{ action.minimumVersion }}</small></span></button>
          <button type="button" :disabled="busy" @click="finish('partial')"><Minus :size="19" /><span><strong>Avancé algo</strong><small>Conservar este punto de entrada</small></span></button>
          <button type="button" :disabled="busy" @click="finish('blocked')"><LockKeyhole :size="19" /><span><strong>Me bloqueé</strong><small>Registrar el obstáculo sin juicio</small></span></button>
          <button type="button" :disabled="busy" @click="finish('stopped_intentionally')"><CircleStop :size="19" /><span><strong>Detener por ahora</strong><small>Cerrar la sesión conscientemente</small></span></button>
        </div>
        <button class="session-finish__cancel" type="button" :disabled="busy" @click="closeFinishChoices">Seguir trabajando</button>
      </section>
      <button v-else ref="finishButton" class="session-page__finish" type="button" @click="openFinishChoices"><CircleStop :size="19" /> Cerrar este bloque</button>
    </template>

    <section v-else class="session-page__missing">
      <h1>No hay una sesión activa</h1>
      <p v-if="store.error">{{ store.error.message }}</p>
      <button type="button" @click="router.push(`/goals/${route.params.id}`)">Volver a la meta</button>
    </section>
  </main>
</template>

<style scoped>
.session-page { min-height: 100svh; padding: 28px 20px 64px; color: var(--color-text); background: transparent; }
.session-page__back { display: inline-flex; min-height: 44px; align-items: center; gap: 7px; border: 0; color: var(--color-text-muted); background: transparent; }
.session-page__header { width: min(100%, 720px); margin: 8vh auto 0; text-align: center; }
.session-page__header p { margin: 0 0 14px; color: var(--color-text-muted); }
.session-page__header h1 { max-width: 18ch; margin: auto; font-size: clamp(30px, 6vw, 52px); line-height: 1.08; letter-spacing: -.04em; text-wrap: balance; overflow-wrap: anywhere; }
.session-clock { width: min(100%, 520px); margin: clamp(48px, 10vh, 100px) auto 44px; text-align: center; }
.session-clock time { display: block; color: var(--color-brand); font: 700 clamp(64px, 16vw, 112px)/.9 var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: -.04em; }
.session-clock p { margin: 22px 0 0; color: var(--color-text-faint); font-size: 13px; }
.session-page__finish { display: flex; min-width: min(100%, 280px); min-height: 50px; margin: auto; align-items: center; justify-content: center; gap: 9px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-full); color: var(--color-text); background: var(--color-surface); font-weight: 800; }
.session-finish { width: min(100%, 600px); margin: 44px auto 0; padding-top: 28px; border-top: 1px solid var(--color-border); }
.session-finish h2 { margin: 0; font-size: 25px; letter-spacing: -.025em; }
.session-finish > p { margin: 8px 0 20px; color: var(--color-text-muted); }
.session-finish__note-label { display: block; margin-bottom: 8px; color: var(--color-text-muted); font-size: 13px; font-weight: 700; }
.session-finish__note-label span { color: var(--color-text-faint); font-weight: 500; }
.session-finish textarea { box-sizing: border-box; width: 100%; padding: 14px 16px; border: 1px solid var(--color-border-strong); border-radius: 14px; color: var(--color-text); background: var(--color-surface); font: inherit; resize: vertical; }
.session-finish__choices { display: grid; margin-top: 14px; border-top: 1px solid var(--color-border); }
.session-finish__choices button { display: flex; min-height: 70px; align-items: center; gap: 14px; padding: 12px 4px; border: 0; border-bottom: 1px solid var(--color-border); color: var(--color-text); background: transparent; text-align: left; }
.session-finish__choices button:hover { color: var(--color-brand); }
.session-finish__choices span { display: grid; gap: 4px; }
.session-finish__choices strong { font-size: 15px; }
.session-finish__choices small { color: var(--color-text-muted); font-size: 12px; }
.session-finish__cancel { min-height: 44px; margin-top: 14px; padding: 0; border: 0; color: var(--color-text-muted); background: transparent; font-weight: 700; }
.session-result, .session-page__missing { display: grid; width: min(100%, 560px); min-height: 68vh; margin: auto; align-content: center; justify-items: center; text-align: center; }
.session-result__mark { display: grid; width: 58px; height: 58px; margin-bottom: 24px; place-items: center; border-radius: 50%; color: var(--color-brand-contrast); background: var(--color-brand); }
.session-result h1, .session-page__missing h1 { margin: 0; font-size: clamp(34px, 7vw, 54px); letter-spacing: -.04em; }
.session-result p, .session-page__missing p { max-width: 42ch; margin: 14px 0; color: var(--color-text-muted); line-height: 1.5; }
.session-result strong { color: var(--color-brand); font-size: 14px; }
.session-result button, .session-page__missing button { min-height: 48px; margin-top: 30px; padding: 0 20px; border: 0; border-radius: var(--radius-full); color: var(--color-brand-contrast); background: var(--color-brand); font-weight: 800; }
@media (max-width: 520px) { .session-page__header { margin-top: 5vh; } .session-clock { margin-block: 54px 38px; } }
</style>
