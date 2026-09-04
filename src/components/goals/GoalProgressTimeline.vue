<script setup>
import { computed, ref, useId } from 'vue'
import { Check, Clock3, GitBranch, LockKeyhole, Minus, Play } from 'lucide-vue-next'

const props = defineProps({
  entries: { type: Array, default: () => [] },
  sessions: { type: Array, default: () => [] },
  actions: { type: Array, default: () => [] },
  milestones: { type: Array, default: () => [] },
})

const finishedSessions = computed(() => props.sessions.filter(session => session.status === 'finished'))
const totalSeconds = computed(() => finishedSessions.value.reduce((total, session) => total + (session.actualSeconds ?? 0), 0))
const adaptations = computed(() => props.actions.filter(action => action.status === 'adapted').length)
const requiredMilestones = computed(() => props.milestones.filter(milestone => !milestone.deletedAt && milestone.status !== 'skipped'))
const completedMilestones = computed(() => requiredMilestones.value.filter(milestone => milestone.status === 'completed').length)
const milestoneProgress = computed(() => requiredMilestones.value.length ? (completedMilestones.value / requiredMilestones.value.length) * 100 : 0)
const timeline = computed(() => [...props.entries].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)))
const actionById = computed(() => new Map(props.actions.map(action => [action.id, action])))
const sessionById = computed(() => new Map(props.sessions.map(session => [session.id, session])))
const visibleCount = ref(12)
const visibleTimeline = computed(() => timeline.value.slice(0, visibleCount.value))
const timelineId = useId()
const titleId = useId()

const KIND_META = Object.freeze({
  started: { label: 'Sesión iniciada', icon: Play, tone: 'neutral' },
  partial: { label: 'Avance guardado', icon: Minus, tone: 'progress' },
  blocked: { label: 'Bloqueo registrado', icon: LockKeyhole, tone: 'warning' },
  action_completed: { label: 'Acción completada', icon: Check, tone: 'complete' },
  stage_completed: { label: 'Hito completado', icon: Check, tone: 'complete' },
  adjusted: { label: 'Paso adaptado', icon: GitBranch, tone: 'adapted' },
})

function meta(kind) {
  return KIND_META[kind] ?? { label: 'Progreso registrado', icon: Clock3, tone: 'neutral' }
}

function actionTitle(actionId) {
  return actionById.value.get(actionId)?.title ?? ''
}

function sessionDuration(sessionId) {
  const seconds = sessionById.value.get(sessionId)?.actualSeconds
  if (seconds == null) return ''
  if (seconds < 60) return 'Menos de 1 min'
  return `${Math.round(seconds / 60)} min`
}

function totalTime(seconds) {
  if (!seconds) return '0 min'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}
</script>

<template>
  <section class="goal-progress" :aria-labelledby="titleId">
    <header>
      <h2 :id="titleId">Trayectoria</h2>
      <p>Movimiento acumulado, sin rachas ni días perdidos.</p>
    </header>

    <dl class="goal-progress__summary">
      <div><dt>Tiempo dedicado</dt><dd>{{ totalTime(totalSeconds) }}</dd></div>
      <div><dt>Sesiones cerradas</dt><dd>{{ finishedSessions.length }}</dd></div>
      <div><dt>Hitos completos</dt><dd>{{ completedMilestones }}/{{ requiredMilestones.length }}</dd></div>
      <div><dt>Adaptaciones</dt><dd>{{ adaptations }}</dd></div>
    </dl>

    <div v-if="requiredMilestones.length" class="goal-progress__milestones">
      <div><strong>Progreso por hitos</strong><span>{{ completedMilestones }} de {{ requiredMilestones.length }}</span></div>
      <div class="goal-progress__bar" role="progressbar" aria-label="Hitos completados" :aria-valuenow="completedMilestones" aria-valuemin="0" :aria-valuemax="requiredMilestones.length"><span :style="{ '--milestone-progress': milestoneProgress / 100 }" /></div>
    </div>

    <p v-if="timeline.length === 0" class="goal-progress__empty">Tu primer bloque de trabajo aparecerá aquí.</p>
    <ol v-else :id="timelineId" class="goal-progress__timeline">
      <li
        v-for="(entry, index) in visibleTimeline"
        :key="entry.id"
        :class="`is-${meta(entry.kind).tone}`"
        :style="{ '--event-index': Math.min(index, 4) }"
      >
        <div class="goal-progress__rail" aria-hidden="true">
          <svg class="goal-progress__thread" viewBox="0 0 48 100" preserveAspectRatio="none">
            <path pathLength="1" d="M24 18 C4 38 44 62 24 100" />
          </svg>
          <span class="goal-progress__icon"><component :is="meta(entry.kind).icon" :size="16" /></span>
        </div>
        <div class="goal-progress__event">
          <div class="goal-progress__line"><strong>{{ meta(entry.kind).label }}</strong><time :datetime="entry.occurredAt">{{ dateLabel(entry.occurredAt) }}</time></div>
          <p v-if="actionTitle(entry.actionId)">{{ actionTitle(entry.actionId) }}</p>
          <blockquote v-if="entry.note">{{ entry.note }}</blockquote>
          <p v-if="entry.evidenceText" class="goal-progress__evidence"><strong>Evidencia</strong>{{ entry.evidenceText }}</p>
          <small v-if="sessionDuration(entry.sessionId)">{{ sessionDuration(entry.sessionId) }}</small>
        </div>
      </li>
    </ol>
    <button
      v-if="timeline.length > visibleCount"
      class="goal-progress__more"
      type="button"
      :aria-controls="timelineId"
      @click="visibleCount += 12"
    >
      Ver movimientos anteriores
    </button>
  </section>
</template>

<style scoped>
.goal-progress { width: min(100%, var(--content-max)); box-sizing: border-box; margin: var(--section-gap-desktop) auto 0 !important; padding-top: var(--section-gap-mobile); border-top: 1px solid var(--border-subtle); }
.goal-progress header h2 { margin: 0; color: var(--text-primary); font: var(--h1-weight) var(--h1-size)/var(--h1-line) var(--font-core); letter-spacing: var(--h1-track); }
.goal-progress header p { max-width: 65ch; margin: 8px 0 0; color: var(--text-secondary); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); }
.goal-progress__summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: var(--space-6) 0 var(--section-gap-mobile); border-block: 1px solid var(--border-subtle); }
.goal-progress__summary div { min-width: 0; padding: 20px 14px; border-inline-end: 1px solid var(--border-subtle); }
.goal-progress__summary div:first-child { padding-left: 0; }
.goal-progress__summary div:last-child { border-inline-end: 0; }
.goal-progress__summary div:nth-child(2) { border-inline-end: 0; }
.goal-progress__summary div:nth-child(-n+2) { border-bottom: 1px solid var(--border-subtle); }
.goal-progress__summary div:nth-child(3) { padding-inline-start: 0; }
.goal-progress__summary dt { min-height: 2.4em; color: var(--text-muted); font: var(--label-weight) var(--label-size)/var(--label-line) var(--font-core); }
.goal-progress__summary dd { margin: 8px 0 0; color: var(--text-primary); font: 500 40px/1 var(--font-numeric); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.goal-progress__milestones{display:grid;gap:10px;margin:calc(var(--section-gap-mobile) * -1 + var(--space-4)) 0 var(--section-gap-mobile)}
.goal-progress__milestones>div:first-child{display:flex;justify-content:space-between;gap:var(--space-3);color:var(--text-secondary);font:600 var(--label-size)/1.4 var(--font-core)}
.goal-progress__milestones span{font-family:var(--font-numeric);font-variant-numeric:tabular-nums}
.goal-progress__bar{height:4px;overflow:hidden;border-radius:var(--radius-pill);background:var(--surface-secondary)}
.goal-progress__bar span{display:block;width:100%;height:100%;border-radius:inherit;background:var(--progress-complete);transform:scaleX(var(--milestone-progress));transform-origin:left;transition:transform var(--dur-panel) var(--ease-calm)}
.goal-progress__timeline { margin: 0; padding: 0; list-style: none; }
.goal-progress__timeline li { --event-color: var(--text-muted); position: relative; display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: var(--space-4); min-height: 96px; }
.goal-progress__timeline .is-complete { --event-color: var(--progress-complete); }
.goal-progress__timeline .is-warning { --event-color: var(--progress-paused); }
.goal-progress__timeline .is-adapted { --event-color: var(--progress-adapted); }
.goal-progress__timeline .is-progress { --event-color: var(--progress-complete); }
.goal-progress__rail { position: relative; min-height: 100%; }
.goal-progress__thread { position: absolute; inset: 0; width: 48px; height: 100%; overflow: visible; color: var(--border-strong); }
.goal-progress__thread path { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-dasharray: 1 8; vector-effect: non-scaling-stroke; }
.goal-progress__timeline li:nth-child(even) .goal-progress__thread { transform: scaleX(-1); }
.goal-progress__timeline li:last-child .goal-progress__thread { display: none; }
.goal-progress__icon { position: relative; z-index: 1; display: grid; width: 32px; height: 32px; margin: 0 auto; place-items: center; border: 1px solid color-mix(in srgb, var(--event-color) 48%, var(--border-subtle)); border-radius: var(--radius-pill); color: var(--event-color); background: var(--surface-primary); }
.goal-progress__event { min-width: 0; padding: 4px 0 28px; }
.goal-progress__line { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.goal-progress__line strong { color: var(--text-primary); font: var(--title-weight) var(--title-size)/var(--title-line) var(--font-core); letter-spacing: var(--title-track); }
.goal-progress__line time, .goal-progress__timeline small { color: var(--text-muted); font: 400 var(--label-size)/1.4 var(--font-core); font-variant-numeric: tabular-nums; }
.goal-progress__timeline p { margin: 5px 0 0; color: var(--text-secondary); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); overflow-wrap: break-word; hyphens: auto; }
.goal-progress__timeline blockquote { margin: 8px 0 0; color: var(--text-secondary); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); font-style: italic; overflow-wrap: break-word; }
.goal-progress__timeline .goal-progress__evidence{display:grid;gap:3px;margin-top:8px;padding:10px;border:1px solid color-mix(in srgb,var(--progress-complete) 28%,var(--border-subtle));border-radius:var(--radius-md);background:var(--surface-secondary);font-size:var(--body-small-size)}
.goal-progress__timeline .goal-progress__evidence strong{color:var(--progress-complete);font:700 var(--caption-size)/1 var(--font-core);letter-spacing:.06em;text-transform:uppercase}
.goal-progress__timeline small { display: block; margin-top: 6px; }
.goal-progress__empty { margin: 0; color: var(--text-muted); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); }
.goal-progress__more { min-height: 44px; margin-block-start: var(--space-2); margin-inline-start: 62px; padding-inline: var(--space-4); border: 1px solid var(--border-subtle); border-radius: var(--radius-pill); color: var(--text-secondary); background: var(--action-secondary-bg); font: var(--label-weight) var(--label-size)/1 var(--font-core); cursor: pointer; transition: transform var(--dur-instant) var(--ease-calm), background var(--dur-fast) var(--ease-calm), border-color var(--dur-fast) var(--ease-calm); }
.goal-progress__more:active { transform: scale(var(--press-scale)); }
@media (hover: hover) { .goal-progress__more:hover { border-color: var(--border-strong); background: var(--surface-secondary); } }
@media (prefers-reduced-motion: no-preference) {
  .goal-progress__thread { clip-path: inset(0 0 100% 0); animation: trajectory-reveal 420ms cubic-bezier(.16, 1, .3, 1) calc(var(--event-index) * 70ms) forwards; }
  .goal-progress__icon { animation: trajectory-node 240ms cubic-bezier(.16, 1, .3, 1) calc(var(--event-index) * 70ms + 90ms) both; }
}
@keyframes trajectory-reveal { to { clip-path: inset(0); } }
@keyframes trajectory-node { from { opacity: .4; transform: scale(.78); } to { opacity: 1; transform: scale(1); } }
@media (min-width: 720px) { .goal-progress { padding-top: var(--section-gap-desktop); } .goal-progress__summary { margin-bottom: var(--section-gap-desktop); } }
@media (max-width: 580px) { .goal-progress__summary dd { font-size: 32px; } .goal-progress__line { align-items: start; flex-direction: column; gap: var(--space-1); } .goal-progress__more { width: calc(100% - 62px); } }
</style>
