<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ChevronRight } from 'lucide-vue-next'
import { useHabitsStore } from '@stores/habits'
import { resolveHabitIcon } from '@utils/icons'

const props  = defineProps({ habit: { type: Object, required: true } })
const router = useRouter()
const store  = useHabitsStore()
let pressTimer = null

const currentDay = computed(() => store.getCurrentDay(props.habit))
const percent    = computed(() => Math.min(store.getProgress(props.habit), 100))
const justLogged = ref(false)
const longPressConsumed = ref(false)
const todayLogged = computed(() => (props.habit.logs?.[currentDay.value]?.level ?? 0) > 0)

// Reminder label: show time if set, else "Todo el día"
const timeLabel = computed(() => props.habit.reminder ?? 'Todo el día')

// Mini cells: first 10 days
const CELLS = 10
const miniCells = computed(() =>
  Array.from({ length: CELLS }, (_, i) => {
    const day = i + 1
    if (day > props.habit.duration || day > currentDay.value) return { key: i, level: -1 }
    return { key: i, level: props.habit.logs?.[day]?.level ?? 0 }
  })
)

function navigate() {
  if (longPressConsumed.value) {
    longPressConsumed.value = false
    return
  }
  router.push({ name: 'habit', params: { id: props.habit.id } })
}

function quickLog() {
  const existing = props.habit.logs?.[currentDay.value] ?? {}
  store.logDay(props.habit.id, currentDay.value, {
    level: 3,
    emotion: existing.emotion ?? null,
    energy: existing.energy ?? null,
    note: existing.note ?? '',
  })

  justLogged.value = true
  window.setTimeout(() => { justLogged.value = false }, 720)
}

function startLongPress() {
  clearLongPress()
  longPressConsumed.value = false
  pressTimer = window.setTimeout(() => {
    longPressConsumed.value = true
    quickLog()
  }, 520)
}

function clearLongPress() {
  if (!pressTimer) return
  window.clearTimeout(pressTimer)
  pressTimer = null
}
</script>

<template>
  <div
    class="hr"
    :class="{
      'hr--today-logged': todayLogged,
      'hr--just-logged': justLogged,
    }"
    :style="{ '--hc': habit.color }"
    role="button"
    tabindex="0"
    :aria-label="`${habit.name} — ${percent}% avanzado`"
    @click="navigate"
    @keydown.enter="navigate"
    @keydown.space.prevent="navigate"
    @pointerdown="startLongPress"
    @pointerup="clearLongPress"
    @pointerleave="clearLongPress"
    @pointercancel="clearLongPress"
  >
    <!-- ── Icon ── -->
    <div class="hr__icon" aria-hidden="true">
      <component :is="resolveHabitIcon(habit.icon)" :size="22" :stroke-width="1.75" />
    </div>

    <!-- ── Body ── -->
    <div class="hr__body">

      <!-- Row 1: name + reminder time -->
      <div class="hr__row-top">
        <h3 class="hr__name">{{ habit.name }}</h3>
        <span class="hr__time">
          <span class="hr__dot" aria-hidden="true" />
          {{ timeLabel }}
        </span>
      </div>

      <!-- Row 2: days counter + percentage -->
      <div class="hr__row-meta">
        <span class="hr__days">Día {{ currentDay }} / {{ habit.duration }}</span>
        <span class="hr__pct">{{ percent }}%</span>
      </div>

      <!-- Progress bar -->
      <div class="hr__bar" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
        <div class="hr__bar-fill" :style="{ width: `${percent}%` }" />
      </div>

      <!-- Mini contribution grid -->
      <div class="hr__mini" aria-hidden="true">
        <div
          v-for="cell in miniCells"
          :key="cell.key"
          class="hr__mini-cell"
          :class="
            cell.level < 0
              ? 'hr__mini-cell--future'
              : cell.level === 0
                ? 'hr__mini-cell--empty'
                : `hr__mini-cell--lv${cell.level}`
          "
        />
      </div>

    </div>

    <button
      class="hr__quick"
      :class="{ 'hr__quick--done': todayLogged }"
      type="button"
      :aria-label="todayLogged ? `${habit.name} registrado hoy` : `Registrar ${habit.name} ahora`"
      :title="todayLogged ? 'Registrado hoy' : 'Registrar ahora'"
      @click.stop="quickLog"
      @pointerdown.stop
    >
      <Check :size="15" :stroke-width="2.6" aria-hidden="true" />
      <span class="hr__sr">{{ todayLogged ? 'Registrado' : 'Registrar' }}</span>
    </button>

    <!-- ── Chevron ── -->
    <ChevronRight class="hr__chevron" :size="16" :stroke-width="2" aria-hidden="true" />
  </div>
</template>

<style scoped>
/* ── Card ──────────────────────────────────────────── */
.hr {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: var(--radius-card-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    background var(--duration-base) var(--ease-standard),
    border-color var(--duration-base) var(--ease-standard),
    box-shadow var(--duration-base) var(--ease-standard),
    transform    var(--duration-fast) var(--ease-standard);
}

.hr:hover {
  background: color-mix(in srgb, var(--hc) 5%, var(--color-surface));
  border-color: color-mix(in srgb, var(--hc) 22%, var(--color-border));
  box-shadow: var(--shadow-hover-glow);
}

.hr:active { transform: scale(0.98); }

.hr--today-logged {
  border-color: color-mix(in srgb, var(--hc) 28%, var(--color-border));
}

.hr--just-logged {
  animation: quick-done 720ms var(--ease-emphasis) both;
}

/* ── Icon ────────────────────────────────────────── */
.hr__icon {
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-input);
  background: color-mix(in srgb, var(--hc) 16%, var(--color-surface-raised));
  color: var(--hc);
}

/* ── Body ────────────────────────────────────────── */
.hr__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

/* Row 1: name + time */
.hr__row-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.hr__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.hr__time {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-faint);
  font-size: 0.6rem;
  font-weight: 600;
  white-space: nowrap;
}

.hr__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--hc);
  flex-shrink: 0;
}

/* Row 2: days + percent */
.hr__row-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.hr__days {
  color: var(--color-text-muted);
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
}

.hr__pct {
  color: var(--color-text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  flex-shrink: 0;
}

/* Progress bar */
.hr__bar {
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--color-surface-raised);
  overflow: hidden;
}

.hr__bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--hc);
  transition: width 700ms var(--ease-standard);
}

/* Mini cells */
.hr__mini {
  display: flex;
  gap: 3px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.hr__mini-cell {
  width: 9px;
  height: 9px;
  border-radius: 4px;
  flex-shrink: 0;
}

.hr__mini-cell--future {
  background: transparent;
}

.hr__mini-cell--empty {
  background: var(--color-surface-raised);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.hr__mini-cell--lv1 {
  background: color-mix(in srgb, var(--hc) 28%, var(--color-surface-raised));
}

.hr__mini-cell--lv2 {
  background: color-mix(in srgb, var(--hc) 65%, var(--color-surface));
}

.hr__mini-cell--lv3 {
  background: var(--hc);
}

.hr__mini-cell--lv4 {
  background: rgba(143, 144, 152, 0.18);
  box-shadow: inset 0 0 0 1px rgba(143, 144, 152, 0.36);
}

/* ── Quick entry ──────────────────────────────────── */
.hr__quick {
  position: relative;
  flex-shrink: 0;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--hc) 36%, var(--color-border));
  background: color-mix(in srgb, var(--hc) 9%, var(--color-surface-raised));
  color: var(--hc);
  touch-action: manipulation;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

.hr__quick:hover {
  background: color-mix(in srgb, var(--hc) 16%, var(--color-surface-raised));
  border-color: color-mix(in srgb, var(--hc) 60%, var(--color-border));
}

.hr__quick:active {
  transform: scale(0.98);
}

.hr__quick--done {
  background: var(--hc);
  border-color: var(--hc);
  color: var(--color-brand-contrast);
}

.hr__quick--done::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 1px solid color-mix(in srgb, var(--hc) 22%, transparent);
  pointer-events: none;
}

.hr__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Chevron ──────────────────────────────────────── */
.hr__chevron {
  flex-shrink: 0;
  color: var(--color-text-faint);
  align-self: center;
}

@keyframes quick-done {
  0% {
    background: var(--color-surface);
    transform: scale(1);
  }
  36% {
    background: color-mix(in srgb, var(--hc) 16%, var(--color-surface));
    border-color: color-mix(in srgb, var(--hc) 65%, var(--color-border));
    transform: scale(0.992);
  }
  100% {
    background: var(--color-surface);
    transform: scale(1);
  }
}

/* ── Desktop ──────────────────────────────────────── */
@media (min-width: 1024px) {
  .hr {
    padding: 1rem;
    border-radius: var(--radius-card-lg);
  }

  .hr__icon {
    width: 3rem;
    height: 3rem;
    font-size: 1.375rem;
  }

  .hr__name    { font-size: 0.9375rem; }
  .hr__days    { font-size: 0.75rem; }
  .hr__pct     { font-size: 0.75rem; }

  .hr__mini-cell {
    width: 11px;
    height: 11px;
    border-radius: 4px;
  }
}
</style>
