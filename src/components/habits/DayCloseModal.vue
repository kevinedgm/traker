<script setup>
/**
 * DayCloseModal — "¿Cómo cerramos hoy?"
 *
 * Evening ritual for ADHD users: every active habit on one sheet,
 * one tap per habit, zero forms. Logging a minimal version (or an
 * honest "hoy no") closes the day without guilt — the goal is that
 * no day ends *unregistered*, not that every day is perfect.
 */
import { computed } from 'vue'
import { Moon, X } from 'lucide-vue-next'
import { useHabitsStore } from '@stores/habits'
import { resolveHabitIcon } from '@utils/icons'

const emit  = defineEmits(['close'])
const store = useHabitsStore()

// Same scale as LogModal / HabitRow
const LEVELS = [
  { value: 3, label: 'Completo' },
  { value: 2, label: 'Bien' },
  { value: 1, label: 'Mínimo' },
  { value: 0, label: 'Hoy no' },
]

/** Active habits whose challenge window includes today. */
const todayHabits = computed(() =>
  store.habits
    .filter(h => h.isActive)
    .map(h => {
      const day = store.getCurrentDay(h)
      return { habit: h, day, level: h.logs?.[day]?.level }
    })
    .filter(({ habit, day }) => day >= 1 && day <= habit.duration)
)

const registered = computed(() => todayHabits.value.filter(t => t.level !== undefined).length)
const total      = computed(() => todayHabits.value.length)
const allClosed  = computed(() => total.value > 0 && registered.value === total.value)

function setLevel(habit, day, value) {
  const existing = habit.logs?.[day] ?? {}
  store.logDay(habit.id, day, {
    level: value,
    emotion: existing.emotion ?? null,
    energy: existing.energy ?? null,
    note: existing.note ?? '',
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="dc-scrim" @click="emit('close')" />

    <div class="dc-sheet" role="dialog" aria-modal="true" aria-label="Cierre del día">

      <div class="dc-handle" aria-hidden="true"><div class="dc-handle__bar" /></div>

      <header class="dc-header">
        <div class="dc-header__icon" aria-hidden="true">
          <Moon :size="20" :stroke-width="1.8" />
        </div>
        <div class="dc-header__text">
          <h2 class="dc-header__title">¿Cómo cerramos hoy?</h2>
          <p class="dc-header__sub">Sin presión: un mínimo o un "hoy no" honesto también cierran el día.</p>
        </div>
        <button class="dc-close" type="button" aria-label="Cerrar" @click="emit('close')">
          <X :size="18" :stroke-width="2" />
        </button>
      </header>

      <div class="dc-body">
        <div
          v-for="{ habit, day, level } in todayHabits"
          :key="habit.id"
          class="dc-item"
          :style="{ '--hc': habit.color }"
        >
          <div class="dc-item__head">
            <span class="dc-item__icon" aria-hidden="true">
              <component :is="resolveHabitIcon(habit.icon)" :size="16" :stroke-width="1.8" />
            </span>
            <span class="dc-item__name">{{ habit.name }}</span>
            <span v-if="level !== undefined" class="dc-item__done">✓</span>
          </div>

          <div class="dc-item__levels" role="radiogroup" :aria-label="`¿Cómo fue ${habit.name} hoy?`">
            <button
              v-for="lvl in LEVELS"
              :key="lvl.value"
              class="dc-lvl"
              :class="{
                [`dc-lvl--lv${lvl.value}`]: level === lvl.value,
                'dc-lvl--selected': level === lvl.value,
              }"
              type="button"
              role="radio"
              :aria-checked="level === lvl.value"
              @click="setLevel(habit, day, lvl.value)"
            >
              {{ lvl.label }}
            </button>
          </div>
        </div>

        <p v-if="!total" class="dc-empty">No hay hábitos activos hoy.</p>
      </div>

      <footer class="dc-footer">
        <p class="dc-footer__summary" role="status">
          <template v-if="allClosed">Día cerrado: {{ registered }} de {{ total }} con registro. Bien hecho.</template>
          <template v-else>{{ registered }} de {{ total }} con registro</template>
        </p>
        <button class="dc-done" :class="{ 'dc-done--ready': allClosed }" type="button" @click="emit('close')">
          {{ allClosed ? 'Listo ✓' : 'Cerrar' }}
        </button>
      </footer>

    </div>
  </Teleport>
</template>

<style scoped>
.dc-scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(0 0 0 / 0.58);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.dc-sheet {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 51;
  display: flex;
  flex-direction: column;
  width: min(100%, 34rem);
  max-height: 88svh;
  margin-inline: auto;
  border-radius: var(--radius-card-lg) var(--radius-card-lg) 0 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-float);
  overflow: hidden;
  animation: dc-up 360ms var(--ease-emphasis) both;
}

@media (min-width: 720px) {
  .dc-sheet {
    inset-inline: unset;
    bottom: unset;
    left: 50%;
    top: 50%;
    width: min(92vw, 33rem);
    max-height: 84svh;
    border-radius: var(--radius-card-lg);
    transform: translate(-50%, -50%);
    animation: none;
  }
  .dc-handle { display: none; }
}

@keyframes dc-up {
  from { transform: translateY(100%); opacity: 0.4; }
  to   { transform: translateY(0);    opacity: 1;   }
}

.dc-handle {
  display: flex;
  justify-content: center;
  padding: var(--space-3) 0 0;
  flex-shrink: 0;
}

.dc-handle__bar {
  width: 2.5rem;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-border);
}

/* ── Header ── */
.dc-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-3);
  flex-shrink: 0;
}

.dc-header__icon {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-input);
  background: color-mix(in srgb, var(--color-brand) 14%, var(--color-surface-raised));
  color: var(--color-brand);
}

.dc-header__text { flex: 1; min-width: 0; }

.dc-header__title {
  color: var(--color-text);
  font-size: var(--text-lg);
  font-weight: 780;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.dc-header__sub {
  margin-top: 3px;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 500;
  line-height: 1.45;
}

.dc-close {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  cursor: pointer;
  touch-action: manipulation;
}

/* ── Body ── */
.dc-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-2) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  scrollbar-width: none;
}

.dc-body::-webkit-scrollbar { display: none; }

.dc-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--color-bg);
}

.dc-item__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.dc-item__icon {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--hc) 16%, var(--color-surface-raised));
  color: var(--hc);
}

.dc-item__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 700;
}

.dc-item__done {
  flex-shrink: 0;
  color: var(--hc);
  font-size: var(--text-sm);
  font-weight: 800;
}

.dc-item__levels {
  display: flex;
  gap: var(--space-2);
}

.dc-lvl {
  flex: 1;
  min-height: 2.5rem;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: 0.6563rem;
  font-weight: 800;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
  padding: 0 var(--space-1);
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    background   var(--duration-fast) var(--ease-standard),
    transform    var(--duration-fast) var(--ease-standard);
}

.dc-lvl:active { transform: scale(0.95); }

.dc-lvl--lv3 {
  border-color: var(--hc);
  background: var(--hc);
  color: var(--color-brand-contrast);
}

.dc-lvl--lv2 {
  border-color: color-mix(in srgb, var(--hc) 55%, var(--color-border));
  background: color-mix(in srgb, var(--hc) 18%, var(--color-surface-raised));
  color: var(--color-text);
}

.dc-lvl--lv1 {
  border-color: color-mix(in srgb, var(--hc) 38%, var(--color-border));
  background: color-mix(in srgb, var(--hc) 8%, var(--color-surface-raised));
  color: var(--color-text);
}

.dc-lvl--lv0 {
  border-color: var(--color-border-strong, var(--color-border));
  background: var(--color-surface);
  color: var(--color-text);
}

.dc-empty {
  text-align: center;
  color: var(--color-text-faint);
  font-size: var(--text-sm);
  padding: var(--space-6) 0;
}

/* ── Footer ── */
.dc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.dc-footer__summary {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
}

.dc-done {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0 var(--space-5);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: var(--text-xs);
  font-weight: 800;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background var(--duration-base) var(--ease-standard),
    color      var(--duration-base) var(--ease-standard);
}

.dc-done--ready {
  border-color: var(--color-brand);
  background: var(--color-brand);
  color: var(--color-brand-contrast);
}
</style>
