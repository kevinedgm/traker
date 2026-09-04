<script setup>
import { computed, ref } from 'vue'
import { BatteryMedium, Brain, Cloud, Clock3, HeartPulse, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { useHabitsStore } from '@stores/habits'
import { useCheckinsStore } from '@stores/checkins'
import { resolveHabitIcon } from '@utils/icons'
import { checkinEnergyLabel, checkinLoadLabel } from '@/features/checkins/domain.js'
import DailyCheckinSheet from '@components/checkins/DailyCheckinSheet.vue'
import { useToast } from '@/composables/useToast'

const store = useHabitsStore()
const checkinsStore = useCheckinsStore()
const toast = useToast()
const selectedCheckin = ref(null)
const activeHabits = computed(() => store.habits.filter(h => h.isActive !== false))
const recentCheckins = computed(() => checkinsStore.recentCheckins.slice(0, 7))

function checkinDateLabel(localDate) {
  const date = new Date(`${localDate}T12:00:00`)
  const value = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function checkinDescription(checkin) {
  const parts = []
  if (checkin.loadFeeling) parts.push(`Carga ${checkinLoadLabel(checkin.loadFeeling).toLowerCase()}`)
  if (checkin.energy) parts.push(`Energía ${checkinEnergyLabel(checkin.energy).toLowerCase()}`)
  if (checkin.contextCodes.length) parts.push(checkin.contextCodes.join(', '))
  return parts.join(' · ') || 'Contexto opcional guardado'
}

function checkinSyncLabel(checkin) {
  if (checkin.syncScope === 'local_only') return 'Sólo en este dispositivo'
  if (checkin.syncStatus === 'synced') return 'Sincronizado con tu cuenta'
  if (checkin.syncStatus === 'error') return 'No se pudo sincronizar; sigue guardado aquí'
  return 'Pendiente de sincronizar'
}

function saveHistoricalCheckin(values) {
  if (!selectedCheckin.value) return
  const saved = checkinsStore.saveDailyCheckin(values, selectedCheckin.value.localDate)
  selectedCheckin.value = null
  toast.show({
    message: saved.syncScope === 'local_only'
      ? 'Cambios guardados sólo en este dispositivo.'
      : 'Cambios guardados; revisa aquí el estado de sincronización.',
    tone: 'action',
  })
}

const EMOTION_LABELS = {
  motivated:  'motivación',
  calm:       'tranquilidad',
  tired:      'cansancio',
  anxious:    'ansiedad',
  overloaded: 'saturación',
  proud:      'orgullo',
  distracted: 'distracción',
  satisfied:  'satisfacción',
}

const ENERGY_LABELS = {
  high:   'alta',
  medium: 'media',
  low:    'baja',
}

const NEGATIVE_EMOTIONS = new Set(['tired', 'anxious', 'overloaded', 'distracted'])

function emptyGroup() {
  return { total: 0, built: 0 }
}

function timeBucket(reminder) {
  if (!reminder) return null
  const hour = Number(String(reminder).split(':')[0])
  if (!Number.isFinite(hour)) return null
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'night'
}

const TIME_LABELS = {
  morning:   'la mañana',
  afternoon: 'la tarde',
  night:     'la noche',
}

/* ── Global summary ─────────────────────────────────── */
const totalBuiltDays = computed(() =>
  activeHabits.value.reduce((sum, h) => sum + store.getBuiltDays(h), 0)
)

const totalLogs = computed(() =>
  activeHabits.value.reduce((sum, h) => sum + Object.keys(h.logs ?? {}).length, 0)
)

const insightRecords = computed(() =>
  activeHabits.value.flatMap(habit =>
    Object.entries(habit.logs ?? {}).map(([day, log]) => ({
      habit,
      day: Number(day),
      level: Number(log.level ?? 0),
      emotion: log.emotion ?? null,
      energy: log.energy ?? null,
      loggedAt: log.loggedAt ?? habit.createdAt,
      reminder: habit.reminder ?? null,
      built: [1, 2, 3].includes(Number(log.level ?? 0)),
      flexible: Number(log.level ?? 0) === 4,
    }))
  )
)

const insightCards = computed(() => {
  const insights = []
  const records = insightRecords.value

  if (!activeHabits.value.length) {
    return [{
      icon: Sparkles,
      title: 'Aún no hay patrones',
      body: 'Crea tu primer hábito y en unos días empezaremos a encontrar señales útiles.',
      tone: 'calm',
    }]
  }

  if (records.length < 4) {
    insights.push({
      icon: Sparkles,
      title: 'Todavía estamos aprendiendo',
      body: 'Registra unos días más para detectar energía, emociones y ritmos sin forzar conclusiones.',
      tone: 'calm',
    })
  }

  const consistency = activeHabits.value
    .map(h => {
      const currentDay = store.getCurrentDay(h)
      const built = store.getBuiltDays(h)
      return {
        habit: h,
        built,
        currentDay,
        score: currentDay > 0 ? built / currentDay : 0,
      }
    })
    .filter(item => item.built > 0)
    .sort((a, b) => b.score - a.score || b.built - a.built)

  if (consistency[0]) {
    insights.push({
      icon: ShieldCheck,
      title: 'Consistencia flexible',
      body: `Tu hábito más constante parece ser ${consistency[0].habit.name}. Ahí ya hay una base que puedes proteger.`,
      tone: 'green',
    })
  }

  const energyGroups = records.reduce((acc, record) => {
    if (!record.energy) return acc
    acc[record.energy] ??= emptyGroup()
    acc[record.energy].total += 1
    if (record.built) acc[record.energy].built += 1
    return acc
  }, {})

  const bestEnergy = Object.entries(energyGroups)
    .filter(([, group]) => group.total >= 2)
    .map(([energy, group]) => ({ energy, ...group, score: group.built / group.total }))
    .sort((a, b) => b.score - a.score || b.total - a.total)[0]

  if (bestEnergy) {
    insights.push({
      icon: BatteryMedium,
      title: 'Energía y avance',
      body: `Tus registros suelen salir mejor con energía ${ENERGY_LABELS[bestEnergy.energy]}. Úsalo como pista, no como regla.`,
      tone: 'blue',
    })
  }

  const emotionHabitGroups = {}
  for (const record of records) {
    if (!NEGATIVE_EMOTIONS.has(record.emotion)) continue
    const key = `${record.habit.id}:${record.emotion}`
    emotionHabitGroups[key] ??= { total: 0, built: 0, habit: record.habit, emotion: record.emotion }
    emotionHabitGroups[key].total += 1
    if (record.built) emotionHabitGroups[key].built += 1
  }

  const friction = Object.values(emotionHabitGroups)
    .filter(group => group.total >= 2)
    .map(group => ({ ...group, score: group.built / group.total }))
    .sort((a, b) => a.score - b.score || b.total - a.total)[0]

  if (friction) {
    insights.push({
      icon: Brain,
      title: 'Contexto emocional',
      body: `La ${EMOTION_LABELS[friction.emotion]} parece pesar más en ${friction.habit.name}. En esos días, modo mínimo puede ser suficiente.`,
      tone: 'amber',
    })
  }

  const timeGroups = records.reduce((acc, record) => {
    const bucket = timeBucket(record.reminder)
    if (!bucket) return acc
    acc[bucket] ??= emptyGroup()
    acc[bucket].total += 1
    if (record.built) acc[bucket].built += 1
    return acc
  }, {})

  const bestTime = Object.entries(timeGroups)
    .filter(([, group]) => group.total >= 2)
    .map(([bucket, group]) => ({ bucket, ...group, score: group.built / group.total }))
    .sort((a, b) => b.score - a.score || b.total - a.total)[0]

  if (bestTime) {
    insights.push({
      icon: Clock3,
      title: 'Ritmo del día',
      body: `Por ahora, ${TIME_LABELS[bestTime.bucket]} parece darte mejor tracción. Podría ser buen lugar para hábitos importantes.`,
      tone: 'violet',
    })
  }

  const recent = [...records]
    .sort((a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt))
    .slice(0, 7)
  const loadSignals = recent.filter(record =>
    record.flexible ||
    record.level === 0 ||
    record.energy === 'low' ||
    ['tired', 'overloaded', 'anxious'].includes(record.emotion)
  ).length

  if (recent.length >= 4 && loadSignals >= 3) {
    insights.unshift({
      icon: HeartPulse,
      title: 'Señal de carga alta',
      body: 'Últimamente aparecen señales de baja energía o saturación. Un día flexible también cuida tu continuidad.',
      tone: 'soft',
    })
  }

  return insights.slice(0, 4)
})

/* ── Per-habit rows with contribution board ─────────── */
const habitRows = computed(() =>
  activeHabits.value.map(h => {
    const currentDay = store.getCurrentDay(h)
    const cells = Array.from({ length: h.duration }, (_, i) => {
      const day  = i + 1
      const log  = h.logs?.[day]
      return {
        day,
        level:    log?.level ?? (day > currentDay ? -1 : 0),
        isLogged: log !== undefined,
        isToday:  day === currentDay,
        isFuture: day > currentDay,
      }
    })
    return {
      id:       h.id,
      name:     h.name,
      icon:     h.icon,
      color:    h.color,
      percent:  Math.min(store.getProgress(h), 100),
      built:    store.getBuiltDays(h),
      logs:     Object.keys(h.logs ?? {}).length,
      duration: h.duration,
      cells,
    }
  }).sort((a, b) => b.percent - a.percent)
)
</script>

<template>
  <div class="pg">

    <!-- Header -->
    <header class="pg-header">
      <h1 class="pg-header__title">Progreso</h1>
      <p class="pg-header__sub">Señales útiles para cuidarte mejor, no para exigirte más.</p>
    </header>

    <!-- Summary cards -->
    <div class="pg-summary">
      <div class="pg-summary-card pg-summary-card--primary">
        <span class="pg-summary-card__val">{{ totalBuiltDays }}</span>
        <span class="pg-summary-card__label">DÍAS CONSTRUIDOS</span>
      </div>
      <div class="pg-summary-card">
        <span class="pg-summary-card__val">{{ habitRows.length }}</span>
        <span class="pg-summary-card__label">EN MOVIMIENTO</span>
      </div>
      <div class="pg-summary-card">
        <span class="pg-summary-card__val">{{ totalLogs }}</span>
        <span class="pg-summary-card__label">CON CONTEXTO</span>
      </div>
    </div>

    <section v-if="recentCheckins.length" class="pg-checkins" aria-labelledby="checkins-heading">
      <p id="checkins-heading" class="pg-section__heading">Check-ins recientes</p>
      <div class="pg-checkins__list">
        <button v-for="checkin in recentCheckins" :key="checkin.id" type="button" class="pg-checkin-row" @click="selectedCheckin = checkin">
          <time :datetime="checkin.localDate">{{ checkinDateLabel(checkin.localDate) }}</time>
          <p>{{ checkinDescription(checkin) }}</p>
          <span :title="checkinSyncLabel(checkin)">
            <component :is="checkin.syncScope === 'cloud' ? Cloud : LockKeyhole" :size="15" aria-hidden="true" />
            <span class="sr-only">{{ checkinSyncLabel(checkin) }}. Abrir para ver o editar.</span>
          </span>
        </button>
      </div>
    </section>

    <DailyCheckinSheet
      v-if="selectedCheckin"
      :checkin="selectedCheckin"
      @save="saveHistoricalCheckin"
      @close="selectedCheckin = null"
    />

    <!-- Human insights -->
    <section class="pg-insights" aria-label="Insights útiles">
      <p class="pg-section__heading">Lecturas útiles</p>
      <div class="pg-insight-list">
        <article
          v-for="insight in insightCards"
          :key="insight.title"
          class="pg-insight"
          :class="`pg-insight--${insight.tone}`"
        >
          <div class="pg-insight__icon" aria-hidden="true">
            <component :is="insight.icon" :size="17" :stroke-width="2" />
          </div>
          <div class="pg-insight__copy">
            <h2>{{ insight.title }}</h2>
            <p>{{ insight.body }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- Per-habit contribution boards -->
    <section class="pg-section">
      <p class="pg-section__heading">Por hábito</p>

      <div v-if="habitRows.length" class="pg-habit-list">
        <div
          v-for="row in habitRows"
          :key="row.id"
          class="pg-habit-card"
          :style="{ '--hc': row.color }"
        >
          <!-- Card header -->
          <div class="pg-habit-card__header">
            <div class="pg-habit-card__icon">
              <component :is="resolveHabitIcon(row.icon)" :size="18" :stroke-width="1.8" />
            </div>
            <div class="pg-habit-card__info">
              <span class="pg-habit-card__name">{{ row.name }}</span>
              <span class="pg-habit-card__meta">
                {{ row.built }} / {{ row.duration }} días construidos
              </span>
            </div>
            <span class="pg-habit-card__pct">{{ row.built }} días</span>
          </div>

          <!-- Progress bar -->
          <div class="pg-habit-card__bar">
            <div class="pg-habit-card__bar-fill" :style="{ width: `${row.percent}%` }" />
          </div>

          <!-- Contribution board -->
          <div
            class="pg-board"
            role="img"
            :aria-label="`Tablero de ${row.name}: ${row.duration} días`"
          >
            <div
              v-for="cell in row.cells"
              :key="cell.day"
              class="pg-board__cell"
              :class="{
                'pg-board__cell--empty':  !cell.isLogged && !cell.isFuture,
                'pg-board__cell--lv0':    cell.level === 0 && cell.isLogged,
                'pg-board__cell--lv1':    cell.level === 1,
                'pg-board__cell--lv2':    cell.level === 2,
                'pg-board__cell--lv3':    cell.level === 3,
                'pg-board__cell--lv4':    cell.level === 4,
                'pg-board__cell--future': cell.isFuture && !cell.isToday,
                'pg-board__cell--today':  cell.isToday && !cell.isLogged,
              }"
              :title="`Día ${cell.day}`"
            />
          </div>
        </div>
      </div>

      <p v-else class="pg-empty">
        Crea tu primer hábito para ver el progreso aquí.
      </p>
    </section>

  </div>
</template>

<style scoped>
/* impeccable-disable design-system-font-size, design-system-radius -- tamaños y celdas reproducidos del Progress.html aprobado */
/* ── Page shell ─────────────────────────────────────────── */
.pg {
  min-height: 100svh;
  background: var(--color-bg);
  padding: var(--space-6) var(--space-5);
  padding-top: max(var(--space-6), env(safe-area-inset-top));
  padding-bottom: calc(var(--space-6) + 5rem); /* space for pill nav */
  width: 100%;
  max-width: 600px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

/* ── Header ─────────────────────────────────────────────── */
.pg-header__title {
  color: var(--color-text);
  font-size: clamp(1.6rem, 6vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.pg-header__sub {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* ── Summary cards ──────────────────────────────────────── */
.pg-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.pg-summary-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-3);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  text-align: center;
}

.pg-summary-card--primary {
  border-color: color-mix(in srgb, var(--color-brand) 35%, var(--color-border));
  box-shadow: 0 0 20px color-mix(in srgb, var(--color-brand) 8%, transparent);
}

.pg-summary-card__val {
  color: var(--color-text);
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.pg-summary-card--primary .pg-summary-card__val {
  color: var(--color-brand);
}

.pg-summary-card__label {
  color: var(--color-text-faint);
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.2;
}

/* ── Daily check-ins ─────────────────────────────────────── */
.pg-checkins__list{border-block:1px solid var(--color-border)}
.pg-checkin-row{display:grid;width:100%;grid-template-columns:7.5rem minmax(0,1fr) auto;align-items:center;gap:var(--space-3);min-height:3.5rem;padding-block:var(--space-3);border:0;border-bottom:1px solid var(--color-border);background:transparent;text-align:left;cursor:pointer}
.pg-checkin-row:last-child{border-bottom:0}
.pg-checkin-row:hover{background:var(--action-secondary-bg)}
.pg-checkin-row:focus-visible{outline:2px solid var(--color-brand);outline-offset:3px}
.pg-checkin-row time{color:var(--color-text);font-size:var(--text-xs);font-weight:760;text-transform:capitalize}
.pg-checkin-row p{margin:0;color:var(--color-text-muted);font-size:var(--text-xs);font-weight:500;line-height:1.45}
.pg-checkin-row>span{display:grid;width:2rem;height:2rem;place-items:center;color:var(--color-text-faint)}
@media(max-width:420px){.pg-checkin-row{grid-template-columns:minmax(0,1fr) auto}.pg-checkin-row p{grid-column:1/-1;grid-row:2}.pg-checkin-row>span{grid-column:2;grid-row:1}}

/* ── Human insights ──────────────────────────────────────── */
.pg-insights {
  display: flex;
  flex-direction: column;
}

.pg-insight-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pg-insight {
  --insight: var(--color-brand);
  display: grid;
  grid-template-columns: 2.25rem 1fr;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--insight) 7%, var(--color-surface)),
      var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--insight) 18%, var(--color-border));
}

.pg-insight--green { --insight: var(--color-brand); }
.pg-insight--blue  { --insight: var(--accent-focus); }
.pg-insight--amber { --insight: var(--status-warning); }
.pg-insight--violet { --insight: var(--accent-reflect); }
.pg-insight--soft { --insight: var(--text-muted); }
.pg-insight--calm { --insight: var(--text-muted); }

.pg-insight__icon {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--insight) 14%, var(--color-surface-raised));
  color: var(--insight);
}

.pg-insight__copy {
  min-width: 0;
}

.pg-insight__copy h2 {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 760;
  letter-spacing: -0.01em;
  line-height: 1.15;
}

.pg-insight__copy p {
  margin-top: 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.5;
}

/* ── Section ────────────────────────────────────────────── */
.pg-section__heading {
  color: var(--color-text-faint);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  margin-bottom: var(--space-4);
}

/* ── Habit list ─────────────────────────────────────────── */
.pg-habit-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Habit card ─────────────────────────────────────────── */
.pg-habit-card {
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pg-habit-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.pg-habit-card__icon {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--hc) 16%, var(--color-surface-raised));
  color: var(--hc);
}

.pg-habit-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pg-habit-card__name {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 720;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pg-habit-card__meta {
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 600;
}

.pg-habit-card__pct {
  flex-shrink: 0;
  color: var(--hc);
  font-size: var(--text-xs);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

/* Progress bar */
.pg-habit-card__bar {
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--color-surface-raised);
  overflow: hidden;
}

.pg-habit-card__bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--hc);
}

/* ── Contribution board ─────────────────────────────────── */
.pg-board {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
}

.pg-board__cell {
  aspect-ratio: 1;
  border-radius: 4px;
  transition: background-color var(--duration-base) var(--ease-standard);
}

.pg-board__cell--empty  { background: transparent; box-shadow: inset 0 0 0 1px var(--color-border); }
.pg-board__cell--lv0    { background: var(--text-muted); opacity: .5; }
.pg-board__cell--lv1    { background: color-mix(in srgb, var(--hc) 22%, var(--color-surface-raised)); }
.pg-board__cell--lv2    { background: color-mix(in srgb, var(--hc) 60%, var(--color-surface)); }
.pg-board__cell--lv3    {
  background: var(--hc);
  box-shadow: 0 0 4px color-mix(in srgb, var(--hc) 40%, transparent);
}
.pg-board__cell--lv4 {
  background: var(--progress-skipped);
  box-shadow: inset 0 0 0 1px var(--border-strong);
}
.pg-board__cell--future {
  background: var(--color-surface-raised);
  opacity: 0.25;
}
.pg-board__cell--today  {
  background: var(--color-surface-raised);
  box-shadow:
    0 0 0 1.5px var(--color-bg),
    0 0 0 2.5px var(--color-brand);
}

/* ── Empty ──────────────────────────────────────────────── */
.pg-empty {
  color: var(--color-text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-12) 0;
}

/* ══ TABLET (768px+) ════════════════════════════════════ */
@media (min-width: 768px) {
  .pg {
    padding-bottom: var(--space-10);
  }

  .pg-board {
    grid-template-columns: repeat(15, 1fr);
  }
}

/* ══ DESKTOP (1024px+) ══════════════════════════════════ */
@media (min-width: 1024px) {
  .pg {
    max-width: 680px;
    padding-bottom: var(--space-12);
  }

  .pg-board {
    grid-template-columns: repeat(20, 1fr);
    gap: 4px;
  }
}

/* Dashboard Hoy design reference */
.pg{box-sizing:border-box;width:100%;max-width:640px;min-height:100svh;margin-inline:auto;padding:52px 20px 40px;gap:28px;background:transparent}
.pg-header__title{margin:0;color:var(--text-primary);font:600 30px/1.15 var(--font-core);letter-spacing:-.02em}
.pg-header__sub{margin:6px 0 0;color:var(--text-secondary);font:400 14px/1.5 var(--font-core);text-wrap:pretty}
.pg-summary{gap:10px}
.pg-summary-card{padding:14px 10px;gap:4px;border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:var(--surface-primary);box-shadow:none}
.pg-summary-card--primary{border-color:var(--border-accent);background:var(--aurora-veil),var(--surface-primary)}
.pg-summary-card__val{color:var(--text-primary);font:600 24px/1 var(--font-numeric);font-variant-numeric:tabular-nums;letter-spacing:0}
.pg-summary-card--primary .pg-summary-card__val{color:var(--action-primary)}
.pg-summary-card__label{color:var(--text-muted);font:600 10px/1.3 var(--font-core);letter-spacing:.06em}
.pg-insights,.pg-section{display:flex;flex-direction:column;gap:12px}
.pg-section__heading{margin:0;color:var(--text-muted);font:600 11px/1 var(--font-core);letter-spacing:.08em}
.pg-insight-list{gap:10px}
.pg-insight{display:flex;padding:14px;align-items:flex-start;gap:12px;border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:var(--surface-primary)}
.pg-insight__icon{width:36px;height:36px;flex:none;border-radius:14px;background:color-mix(in srgb,var(--insight) 14%,transparent)}
.pg-insight__copy h2{margin:0;color:var(--text-primary);font:600 14px/1.25 var(--font-core);letter-spacing:-.01em}
.pg-insight__copy p{margin:4px 0 0;color:var(--text-secondary);font:400 13px/1.5 var(--font-core);text-wrap:pretty}
.pg-habit-list{gap:14px}
.pg-habit-card{padding:16px;gap:12px;border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:var(--surface-primary)}
.pg-habit-card__header{gap:10px}.pg-habit-card__icon{width:36px;height:36px;border-radius:14px;background:color-mix(in srgb,var(--hc) 14%,transparent);color:var(--hc)}
.pg-habit-card__name{color:var(--text-primary);font:600 14px/1.3 var(--font-core)}
.pg-habit-card__meta{color:var(--text-muted);font:500 12px/1.3 var(--font-core)}
.pg-habit-card__pct{color:var(--hc);font:600 12px/1 var(--font-numeric);letter-spacing:0}
.pg-habit-card__bar{height:3px;background:var(--progress-none)}
.pg-board{grid-template-columns:repeat(10,1fr);gap:4px}.pg-board__cell{border-radius:3px;box-shadow:none}
.pg-board__cell--lv0{border:1px solid var(--border-subtle);background:var(--progress-none)}
.pg-board__cell--lv1{background:color-mix(in srgb,var(--hc) 30%,var(--progress-none))}
.pg-board__cell--lv2{background:color-mix(in srgb,var(--hc) 65%,transparent)}
.pg-board__cell--lv3{background:var(--hc);box-shadow:none}
.pg-board__cell--lv4{border:1.5px dashed var(--progress-adapted);background:transparent;box-shadow:none}
.pg-board__cell--future{border:0;background:var(--progress-none);opacity:.28}
.pg-board__cell--today{border:2px solid var(--action-primary);background:var(--progress-none);box-shadow:none}
.pg-empty{padding:32px 0;color:var(--text-muted);font:400 14px/1.5 var(--font-core)}
@media(min-width:768px){.pg{padding:48px}.pg-board{grid-template-columns:repeat(15,1fr)}}
</style>
