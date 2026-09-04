<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { ArrowLeft, Check, Pause, Play, RotateCcw, Trash2, Unplug } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import GoalNextStepCard from '@/components/goals/GoalNextStepCard.vue'
import GoalActionForm from '@/components/goals/GoalActionForm.vue'
import GoalMilestonesPanel from '@/components/goals/GoalMilestonesPanel.vue'
import GoalProgressTimeline from '@/components/goals/GoalProgressTimeline.vue'
import { useGoalsStore } from '@/stores/goals.js'
import { useCopy } from '@/composables/useCopy'

const route = useRoute()
const router = useRouter()
const store = useGoalsStore()
const { getPhrase } = useCopy()
const busy = ref(false)
const showMinimum = ref(false)
const showActionForm = ref(false)
const actionFormReturnTarget = ref('next')
const confirmCompletion = ref(false)
const confirmClosure = ref(false)
const confirmDeletion = ref(false)
const closeReason = ref('')
const successorGoalId = ref('')
const saveAnnouncement = ref('')
const goal = computed(() => store.goals.find(item => item.id === route.params.id && !item.deletedAt))
const action = computed(() => store.actionForGoal(route.params.id))
const goalActions = computed(() => store.actions.filter(item => item.goalId === route.params.id))
const goalSessions = computed(() => store.sessions.filter(item => item.goalId === route.params.id))
const goalProgress = computed(() => store.progressEntries.filter(item => item.goalId === route.params.id))
const goalMilestones = computed(() => store.milestonesForGoal(route.params.id))
const completion = computed(() => store.completionReadiness(route.params.id))
const reformulationSource = computed(() => goal.value?.reformulatedFromGoalId
  ? store.goals.find(item => item.id === goal.value.reformulatedFromGoalId)
  : null)
const reformulationSuccessor = computed(() => store.goals.find(item => item.reformulatedFromGoalId === goal.value?.id))
const closureSuccessor = computed(() => goal.value?.successorGoalId
  ? store.goals.find(item => item.id === goal.value.successorGoalId)
  : null)
const successorOptions = computed(() => store.goals.filter(item =>
  item.id !== goal.value?.id && !item.deletedAt && ['active', 'paused'].includes(item.status),
))
const actionSupport = computed(() => {
  if (action.value?.status === 'in_progress') return 'Ya está en marcha. Volver también cuenta.'
  const time = ({ '5m': '5 min', '15m': '15 min', '30m': '30 min', '60m': '1 h', open: 'sin reloj' })[action.value?.estimateBucket]
  return time ? `Un bloque de ${time}. No necesitas terminar todo hoy.` : 'Un paso pequeño es suficiente.'
})
const statusLabel = computed(() => ({ active: 'Meta en curso', paused: 'En pausa', completed: 'Meta completada', reformulated: 'Meta reformulada', abandoned: 'Meta cerrada', archived: 'Archivada' })[goal.value?.status] ?? '')

onMounted(async () => {
  if (!store.loaded) await store.load().catch(() => {})
})

function openActionForm(target) {
  actionFormReturnTarget.value = target
  showActionForm.value = true
}

async function closeActionForm() {
  showActionForm.value = false
  await nextTick()
  const selector = actionFormReturnTarget.value === 'blocked'
    ? '.goal-detail__blocked button'
    : '.goal-detail__next-choice button'
  document.querySelector(selector)?.focus()
}

async function start() {
  if (!goal.value) return
  busy.value = true
  try {
    await store.startSession(goal.value.id)
    await router.push(`/goals/${goal.value.id}/session`)
  } catch (_) {} finally { busy.value = false }
}

async function pauseGoal() {
  if (!goal.value || goal.value.status !== 'active') return
  busy.value = true
  try {
    if (store.runningSession?.goalId === goal.value.id) {
      await store.finishSession(store.runningSession.id, 'stopped_intentionally')
    }
    await store.transition(goal.value.id, 'paused')
    saveAnnouncement.value = getPhrase('goal_paused', { vars: { goalName: goal.value.title } }).text
  } catch (_) {} finally { busy.value = false }
}

async function resumeGoal() {
  if (!goal.value || goal.value.status !== 'paused') return
  busy.value = true
  try {
    await store.transition(goal.value.id, 'active')
    saveAnnouncement.value = getPhrase('goal_returned', { vars: { goalName: goal.value.title } }).text
  } catch (_) {} finally { busy.value = false }
}

async function saveNextAction(input, adaptCurrent = false) {
  if (!goal.value) return
  busy.value = true
  try {
    await store.setNextAction(goal.value.id, input, { adaptCurrent })
    showActionForm.value = false
    saveAnnouncement.value = adaptCurrent ? 'La adaptación quedó guardada.' : 'El siguiente paso quedó guardado.'
  } catch (_) {} finally { busy.value = false }
}

async function completeGoal() {
  if (!goal.value || !completion.value.ready) return
  busy.value = true
  try {
    await store.transition(goal.value.id, 'completed')
    confirmCompletion.value = false
    saveAnnouncement.value = getPhrase('goal_closed', { vars: { goalName: goal.value.title } }).text
  } catch (_) {} finally { busy.value = false }
}

async function closeGoal() {
  if (!goal.value || !['active', 'paused'].includes(goal.value.status)) return
  busy.value = true
  try {
    await store.closeConsciously(goal.value.id, {
      closeReason: closeReason.value,
      successorGoalId: successorGoalId.value || null,
    })
    confirmClosure.value = false
    saveAnnouncement.value = 'La meta quedó cerrada conscientemente. Su avance permanece en el historial.'
  } catch (_) {} finally { busy.value = false }
}

async function createMilestone(input) {
  if (!goal.value) return
  busy.value = true
  try {
    await store.addMilestone(goal.value.id, input)
    saveAnnouncement.value = 'El hito quedó guardado.'
  } catch (_) {} finally { busy.value = false }
}

async function updateMilestone(input) {
  busy.value = true
  try {
    await store.editMilestone(input.id, input)
    saveAnnouncement.value = 'El hito quedó actualizado.'
  } catch (_) {} finally { busy.value = false }
}

async function changeMilestoneStatus(input) {
  busy.value = true
  try {
    await store.setMilestoneStatus(input.id, input.status, input)
    saveAnnouncement.value = input.status === 'completed' ? 'Hito completado con evidencia.' : 'El estado del hito quedó guardado.'
  } catch (_) {} finally { busy.value = false }
}

async function removeMilestone(id) {
  busy.value = true
  try {
    await store.deleteMilestone(id)
    saveAnnouncement.value = 'El hito se quitó de la meta.'
  } catch (_) {} finally { busy.value = false }
}

async function moveMilestone(input) {
  busy.value = true
  try {
    await store.moveMilestone(input.id, input.direction)
    saveAnnouncement.value = 'El orden de los hitos quedó guardado.'
  } catch (_) {} finally { busy.value = false }
}

async function deleteGoal() {
  if (!goal.value) return
  busy.value = true
  try {
    if (store.runningSession?.goalId === goal.value.id) {
      await store.finishSession(store.runningSession.id, 'stopped_intentionally')
    }
    await store.deleteGoal(goal.value.id)
    await router.replace('/goals')
  } catch (_) {} finally { busy.value = false }
}
</script>

<template>
  <main class="goal-detail">
    <p v-if="store.loading" class="goal-detail__state" role="status">Cargando meta…</p>
    <section v-else-if="!goal" class="goal-detail__state"><h1>Esta meta no está disponible</h1><RouterLink to="/goals">Volver a Metas</RouterLink></section>
    <template v-else>
      <div class="goal-detail__flow">
      <button class="goal-detail__back" type="button" @click="router.push('/goals')"><ArrowLeft :size="18" /> Metas</button>
      <header>
        <span>{{ statusLabel }}</span>
        <h1>{{ goal.title }}</h1>
        <p v-if="goal.personalWhy">{{ goal.personalWhy }}</p>
      </header>

      <GoalNextStepCard
        v-if="action && action.status !== 'blocked'"
        :title="action.title"
        :support="actionSupport"
        :primary-label="action.status === 'in_progress' ? 'Continuar' : 'Comenzar'"
        :secondary-label="action.minimumVersion ? 'Hacerlo más sencillo' : ''"
        :busy="busy"
        :disabled="goal.status !== 'active'"
        @primary="start"
        @secondary="showMinimum = !showMinimum"
      />
      <section v-else-if="action?.status === 'blocked' && !showActionForm" class="goal-detail__blocked">
        <Unplug :size="24" aria-hidden="true" />
        <h2>Este paso encontró un bloqueo</h2>
        <p>{{ action.title }}</p>
        <button v-if="goal.status === 'active'" type="button" @click="openActionForm('blocked')">Elegir una versión más viable</button>
        <small v-else>Retoma la meta para adaptar este paso.</small>
      </section>

      <section v-else-if="!action && goal.status === 'active' && !showActionForm" class="goal-detail__next-choice">
        <h2>¿Qué sigue para esta meta?</h2>
        <p v-if="completion.ready">El avance quedó guardado. Todos los hitos vigentes están completos; ahora puedes confirmar la definición final.</p>
        <p v-else-if="completion.total">El avance quedó guardado. Completa los hitos pendientes o elige el siguiente movimiento.</p>
        <p v-else>El avance quedó guardado. Puedes elegir otro movimiento o cerrar la meta si ya cumple su definición.</p>
        <div><button type="button" @click="openActionForm('next')">Definir siguiente paso</button><button type="button" :disabled="!completion.ready" @click="confirmCompletion = true">La meta ya está terminada</button></div>
      </section>

      <GoalActionForm
        v-if="showActionForm"
        :title="action?.status === 'blocked' ? 'Haz el paso más viable' : 'Define el siguiente paso'"
        :submit-label="action?.status === 'blocked' ? 'Guardar adaptación' : 'Guardar siguiente paso'"
        :busy="busy"
        :initial-minimum-version="action?.minimumVersion ?? ''"
        @submit="saveNextAction($event, action?.status === 'blocked')"
        @cancel="closeActionForm"
      />
      <p v-if="saveAnnouncement && !showActionForm" class="goal-detail__saved" role="status">{{ saveAnnouncement }}</p>

      <GoalMilestonesPanel
        :milestones="goalMilestones"
        :editable="['active', 'paused', 'draft'].includes(goal.status)"
        :busy="busy"
        @create="createMilestone"
        @update="updateMilestone"
        @status="changeMilestoneStatus"
        @delete="removeMilestone"
        @move="moveMilestone"
      />

      <section v-if="confirmCompletion" class="goal-detail__confirm" aria-labelledby="complete-title">
        <Check :size="24" aria-hidden="true" />
        <h2 id="complete-title">¿La definición ya se cumple?</h2>
        <p>{{ goal.doneDefinition }}</p>
        <div><button type="button" :disabled="busy" @click="completeGoal">Sí, completar meta</button><button type="button" :disabled="busy" @click="confirmCompletion = false">Todavía no</button></div>
      </section>

      <section v-if="goal.status === 'completed'" class="goal-detail__completed">
        <span><Check :size="24" /></span><h2>Completada</h2><p>El resultado y todo el progreso permanecen en tu historial.</p>
      </section>
      <section v-if="goal.status === 'abandoned'" class="goal-detail__completed goal-detail__closed">
        <span><Check :size="24" /></span><h2>Cerrada conscientemente</h2>
        <p>{{ goal.closeReason || 'Sin motivo registrado. El avance permanece en tu historial.' }}</p>
        <RouterLink v-if="closureSuccessor" :to="`/goals/${closureSuccessor.id}`">Continuó en “{{ closureSuccessor.title }}”</RouterLink>
      </section>
      <section v-if="reformulationSource || reformulationSuccessor" class="goal-detail__lineage" aria-labelledby="goal-lineage-title">
        <span id="goal-lineage-title">Trazabilidad</span>
        <p v-if="reformulationSource">Esta meta reformuló “<RouterLink :to="`/goals/${reformulationSource.id}`">{{ reformulationSource.title }}</RouterLink>”.</p>
        <p v-if="reformulationSuccessor">Continuó como “<RouterLink :to="`/goals/${reformulationSuccessor.id}`">{{ reformulationSuccessor.title }}</RouterLink>”.</p>
      </section>
      <section v-if="showMinimum && action?.minimumVersion" class="goal-detail__minimum" aria-live="polite">
        <span>Versión mínima</span><p>{{ action.minimumVersion }}</p>
      </section>

      <section class="goal-detail__definition">
        <span>Se considera terminada cuando</span>
        <p>{{ goal.doneDefinition }}</p>
      </section>
      <section v-if="confirmClosure" class="goal-detail__close-confirm" aria-labelledby="close-goal-title">
        <h2 id="close-goal-title">Cerrar esta meta conscientemente</h2>
        <p>No borra lo que hiciste ni convierte el cierre en un fracaso.</p>
        <p v-if="action" class="goal-detail__close-warning" role="status">Hay un siguiente paso abierto. Se conservará en el historial, pero dejará de aparecer como acción actual.</p>
        <label>Motivo <em>opcional</em><textarea v-model.trim="closeReason" rows="3" maxlength="500" placeholder="Algo que quieras recordar sobre esta decisión" /></label>
        <label>Meta sucesora <em>opcional</em><select v-model="successorGoalId"><option value="">Sin meta sucesora</option><option v-for="candidate in successorOptions" :key="candidate.id" :value="candidate.id">{{ candidate.title }}</option></select></label>
        <div><button type="button" :disabled="busy" @click="closeGoal">Confirmar cierre</button><button type="button" :disabled="busy" @click="confirmClosure = false">Seguir con la meta</button></div>
      </section>
      <p v-if="store.error" class="goal-detail__error" role="alert">{{ store.error.message }}</p>
      <section v-if="confirmDeletion" class="goal-detail__delete-confirm" role="alert" aria-labelledby="delete-title">
        <Trash2 :size="22" aria-hidden="true" />
        <div><h2 id="delete-title">¿Eliminar esta meta?</h2><p>Se quitará de Metas e Inicio. Esta acción no se puede deshacer desde la aplicación.</p></div>
        <div class="goal-detail__delete-actions"><button type="button" :disabled="busy" :aria-busy="busy" @click="deleteGoal">{{ busy ? 'Eliminando…' : 'Sí, eliminar meta' }}</button><button type="button" :disabled="busy" @click="confirmDeletion = false">Cancelar</button></div>
      </section>
      <footer>
        <button v-if="goal.status === 'active'" type="button" :disabled="busy" @click="pauseGoal"><Pause :size="17" /> Pausar sin perder progreso</button>
        <button v-if="goal.status === 'paused'" type="button" :disabled="busy" @click="resumeGoal"><Play :size="17" /> Retomar meta</button>
        <RouterLink v-if="['active', 'paused'].includes(goal.status)" :to="`/goals/new?from=${goal.id}`"><RotateCcw :size="17" /> Reformular como una meta nueva</RouterLink>
        <button v-if="['active', 'paused'].includes(goal.status)" type="button" :disabled="busy" @click="confirmClosure = true"><Pause :size="17" /> Cerrar conscientemente</button>
        <button class="goal-detail__delete" type="button" :disabled="busy" @click="confirmDeletion = true"><Trash2 :size="17" /> Eliminar meta</button>
      </footer>
      </div>
      <GoalProgressTimeline :entries="goalProgress" :sessions="goalSessions" :actions="goalActions" :milestones="goalMilestones" />
    </template>
  </main>
</template>

<style scoped>
.goal-detail { min-height: 100svh; padding: 32px 20px 80px; color: var(--color-text); background: transparent; }
.goal-detail__flow { width: min(100%, 680px); margin-inline: auto; }
.goal-detail__back { display: inline-flex; min-height: 44px; align-items: center; gap: 7px; border: 0; color: var(--color-text-muted); background: transparent; }
header { padding: 42px 0 34px; }
header span, .goal-detail__definition span, .goal-detail__minimum span { color: var(--color-brand); font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
header h1 { max-width: 15ch; margin: 8px 0 14px; font-size: clamp(38px, 8vw, 64px); line-height: 1; letter-spacing: -.05em; overflow-wrap: anywhere; }
header p { max-width: 56ch; margin: 0; color: var(--color-text-muted); line-height: 1.55; }
.goal-detail__minimum { box-sizing: border-box; margin-top: 12px !important; padding: 18px 20px; border-left: 1px solid var(--color-brand); background: color-mix(in srgb, var(--action-primary) 6%, transparent); }
.goal-detail__minimum p, .goal-detail__definition p { margin: 7px 0 0; line-height: 1.5; }
.goal-detail__definition { box-sizing: border-box; margin-top: 40px !important; padding-top: 24px; border-top: 1px solid var(--color-border); }
.goal-detail__saved { width: min(100%, 680px); box-sizing: border-box; margin: 16px auto 0; color: var(--state-complete-fg); font: 600 13px/1.4 var(--font-core); }
.goal-detail__definition span { color: var(--color-text-faint); }
.goal-detail__blocked, .goal-detail__next-choice, .goal-detail__confirm, .goal-detail__completed { box-sizing: border-box; padding: 24px 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
.goal-detail__blocked > svg { color: var(--color-warning); }
.goal-detail__blocked h2, .goal-detail__next-choice h2, .goal-detail__confirm h2, .goal-detail__completed h2 { margin: 10px 0 7px; font-size: 24px; letter-spacing: -.025em; }
.goal-detail__blocked p, .goal-detail__next-choice p, .goal-detail__confirm p, .goal-detail__completed p { max-width: 58ch; margin: 0; color: var(--color-text-muted); line-height: 1.5; }
.goal-detail__blocked button, .goal-detail__next-choice button, .goal-detail__confirm button { min-height: 46px; margin-top: 18px; padding: 0 17px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-full); color: var(--color-text); background: var(--color-surface); font-weight: 800; }
.goal-detail__blocked small { display: block; margin-top: 14px; color: var(--color-text-faint); }
.goal-detail__next-choice div, .goal-detail__confirm div { display: flex; flex-wrap: wrap; gap: 10px; }
.goal-detail__next-choice button:first-child, .goal-detail__confirm button:first-child { border-color: transparent; color: var(--color-brand-contrast); background: var(--color-brand); }
.goal-detail__next-choice button:disabled { cursor: not-allowed; opacity: .42; }
.goal-detail__completed { text-align: center; }
.goal-detail__completed > span { display: grid; width: 52px; height: 52px; margin: auto; place-items: center; border-radius: 50%; color: var(--color-brand-contrast); background: var(--color-brand); }
.goal-detail__completed a,.goal-detail__lineage a{color:var(--action-primary);font-weight:700}
.goal-detail__lineage{margin-top:var(--space-5)!important;padding:var(--space-4) 0;border-block:1px solid var(--border-subtle)}
.goal-detail__lineage>span{color:var(--text-muted);font:700 var(--caption-size)/1.2 var(--font-core);letter-spacing:.08em;text-transform:uppercase}
.goal-detail__lineage p{margin:8px 0 0;color:var(--text-secondary);line-height:1.5}
.goal-detail__close-confirm{display:grid;gap:var(--space-4);margin-top:var(--space-6)!important;padding:var(--space-5) 0;border-block:1px solid var(--border-strong)}
.goal-detail__close-confirm h2{margin:0;font-size:24px;letter-spacing:-.025em}.goal-detail__close-confirm>p{margin:0;color:var(--text-secondary);line-height:1.5}
.goal-detail__close-confirm .goal-detail__close-warning{padding:var(--space-3);border:1px solid color-mix(in srgb,var(--status-warning) 38%,var(--border-subtle));border-radius:var(--radius-md);background:var(--surface-secondary)}
.goal-detail__close-confirm label{display:grid;gap:8px;color:var(--text-secondary);font-size:13px;font-weight:700}.goal-detail__close-confirm label em{color:var(--text-muted);font-style:normal;font-weight:400}
.goal-detail__close-confirm textarea,.goal-detail__close-confirm select{box-sizing:border-box;width:100%;min-height:48px;padding:12px 14px;border:1px solid var(--border-strong);border-radius:var(--radius-md);color:var(--text-primary);background:var(--surface-primary);font:500 14px/1.45 var(--font-core)}
.goal-detail__close-confirm>div{display:flex;flex-wrap:wrap;gap:10px}.goal-detail__close-confirm button{min-height:46px;padding:0 17px;border:1px solid var(--border-strong);border-radius:var(--radius-pill);color:var(--text-primary);background:var(--surface-primary);font-weight:800}.goal-detail__close-confirm button:first-child{border-color:transparent;color:var(--action-primary-fg);background:var(--action-primary)}
footer { display: flex; flex-wrap: wrap; gap: 10px 22px; margin-top: 34px !important; }
footer button, footer a { display: inline-flex; min-height: 44px; align-items: center; gap: 7px; padding: 0; border: 0; color: var(--color-text-muted); background: transparent; font-size: 13px; font-weight: 700; text-decoration: none; }
.goal-detail__error { width: min(100%, 680px); margin: 18px auto 0; color: var(--color-danger); }
.goal-detail__delete { margin-left:auto; color:var(--color-danger) !important; }
.goal-detail__delete-confirm { box-sizing:border-box; display:grid; grid-template-columns:auto minmax(0,1fr); gap:var(--space-3); margin-top:var(--space-6) !important; padding:var(--space-4) 0; border-block:1px solid var(--color-danger); color:var(--color-danger); }
.goal-detail__delete-confirm h2 { margin:0; color:var(--color-text); font-size:18px; }
.goal-detail__delete-confirm p { margin:var(--space-1) 0 0; color:var(--color-text-muted); line-height:1.5; }
.goal-detail__delete-actions { grid-column:2; display:flex; flex-wrap:wrap; gap:var(--space-2); }
.goal-detail__delete-actions button { min-height:44px; padding:0 var(--space-4); border:1px solid var(--color-border-strong); border-radius:var(--radius-full); background:transparent; color:var(--color-text); font-weight:700; }
.goal-detail__delete-actions button:first-child { border-color:var(--color-danger); color:var(--color-danger); }
@media (max-width:520px) { .goal-detail__delete { width:100%; margin-left:0; } .goal-detail__delete-confirm { grid-template-columns:1fr; } .goal-detail__delete-actions { grid-column:1; } }
.goal-detail__state { display: grid; gap: 16px; margin-top: 15vh !important; }
.goal-detail__state h1 { margin: 0; }
.goal-detail__state a { color: var(--color-brand); }

/* ══ DESKTOP (960px+): the decision flow (next step, definition,
   actions) stays a single focused column on the left; history and
   context (Trayectoria) move into a persistent side panel instead of
   trailing at the bottom of one long scroll. ══ */
@media (min-width: 960px) {
  .goal-detail {
    display: grid;
    grid-template-columns: minmax(0, 680px) minmax(280px, 1fr);
    column-gap: var(--section-gap-desktop);
    align-content: start;
    align-items: start;
    max-width: 1120px;
    margin-inline: auto;
    padding: var(--screen-pad-desktop) var(--screen-pad-desktop) 80px;
  }
  .goal-detail__flow {
    grid-column: 1;
    width: auto;
    margin-inline: 0;
  }
  .goal-detail > .goal-progress {
    grid-column: 2;
    align-self: start;
    margin-top: 0 !important;
    padding-top: 0;
    border-top: 0;
    padding-left: var(--section-gap-desktop);
    border-left: 1px solid var(--color-border);
  }
}
</style>
