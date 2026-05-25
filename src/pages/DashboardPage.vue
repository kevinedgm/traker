<script setup>
import { ref, computed } from 'vue'
import { useHabitsStore }   from '@stores/habits'
import { useAuthStore }     from '@stores/auth'
import { useSettingsStore } from '@stores/settings'
import { Sparkles } from 'lucide-vue-next'
import HabitRow          from '@components/habits/HabitRow.vue'
import CreateHabitModal  from '@components/habits/CreateHabitModal.vue'

const store    = useHabitsStore()
const auth     = useAuthStore()
const settings = useSettingsStore()

const showCreate = ref(false)
const habits     = computed(() => store.habits.filter(h => h.isActive !== false))
const hasHabits  = computed(() => habits.value.length > 0)

// ── Greeting name ──────────────────────────────────────
const userName = computed(() => {
  if (settings.displayName?.trim()) return settings.displayName.trim()
  const email = auth.cloudUser?.user_metadata?.full_name
    ?? auth.cloudUser?.email
  if (email) return email.split('@')[0]
  return null
})

// ── Date label  "27 FEB, 2026" ─────────────────────────
const dateLabel = computed(() => {
  const d   = new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleDateString('es-MX', { month: 'short' })
    .toUpperCase().replace('.', '')
  const yr  = d.getFullYear()
  return `${day} ${mon}, ${yr}`
})

// ── Primary metric: días construidos ──────────────────
// Sum of active progress days across ALL habits.
// This is the ADHD-first metric: it only grows, never resets.
const totalBuiltDays = computed(() =>
  habits.value.reduce((sum, h) => sum + store.getBuiltDays(h), 0)
)

// Total elapsed days across all habits (denominator).
const totalElapsedDays = computed(() =>
  habits.value.reduce((sum, h) => sum + store.getCurrentDay(h), 0)
)

const latestLogAt = computed(() => {
  const dates = habits.value
    .flatMap(h => Object.values(h.logs ?? {}))
    .map(log => Date.parse(log.loggedAt))
    .filter(Number.isFinite)

  if (!dates.length) return null
  return Math.max(...dates)
})

const hasLoggedToday = computed(() =>
  habits.value.some(h => {
    const day = store.getCurrentDay(h)
    return h.logs?.[day]?.level !== undefined
  })
)

const needsGentleRestart = computed(() => {
  if (!hasHabits.value || hasLoggedToday.value) return false
  if (!latestLogAt.value) return true

  const threeDays = 3 * 86_400_000
  return Date.now() - latestLogAt.value > threeDays
})

const totalHabits = computed(() => habits.value.length)

// Mini bars for stat card (one per habit, max 8)
const miniBarHabits = computed(() => habits.value.slice(0, 8))
</script>

<template>
  <div class="dash">

    <!-- ─── Header ─────────────────────────────────── -->
    <header class="dash__header">
      <div class="dash__greeting-block">
        <p class="dash__date">{{ dateLabel }}</p>
        <h1 class="dash__name">
          {{ userName ? `Hola, ${userName}` : 'Hola' }}
          <Sparkles class="dash__wave-icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
        </h1>
        <p class="dash__sub">
          {{ needsGentleRestart ? 'Podemos retomar desde aquí.' : 'Cada registro es un paso adelante.' }}
        </p>
      </div>

      <button
        class="dash__new-btn"
        type="button"
        aria-label="Crear nuevo hábito"
        @click="showCreate = true"
      >
        <span class="dash__new-plus">+</span>
        <span>NUEVO</span>
      </button>
    </header>

    <!-- ─── Stats cards ─────────────────────────────── -->
    <div v-if="hasHabits" class="dash__stats">

      <!-- Días construidos — primary ADHD-first metric -->
      <div class="dash__stat">
        <p class="dash__stat-label">CONSTRUIDOS</p>
        <p class="dash__stat-val">
          {{ totalBuiltDays }}
          <span class="dash__stat-unit">/ {{ totalElapsedDays }} días</span>
        </p>
        <p class="dash__stat-hint">progreso construido, sin reinicios</p>
      </div>

      <!-- Hábitos en curso -->
      <div class="dash__stat">
        <p class="dash__stat-label">EN CURSO</p>
        <div class="dash__stat-row">
          <p class="dash__stat-val">
            {{ totalHabits }}
            <span class="dash__stat-unit">{{ totalHabits === 1 ? 'hábito' : 'hábitos' }}</span>
          </p>
          <!-- Mini bar chart -->
          <div class="dash__mini-bars" aria-hidden="true">
            <div
              v-for="h in miniBarHabits"
              :key="h.id"
              class="dash__mini-bar"
              :style="{
                height: `${Math.max(18, store.getProgress(h))}%`,
                background: h.color,
              }"
            />
          </div>
        </div>
      </div>

    </div>

    <div v-if="needsGentleRestart" class="dash__restart" role="status">
      <p>¿Quieres continuar hoy?</p>
      <span>Un registro pequeño también cuenta.</span>
    </div>

    <!-- ─── Habit list ───────────────────────────────── -->
    <section v-if="hasHabits" class="dash__list" aria-label="Tus hábitos">
      <h2 class="dash__section-label">CONTINÚA HOY</h2>
      <div class="dash__rows">
        <HabitRow
          v-for="h in habits"
          :key="h.id"
          :habit="h"
        />
      </div>
    </section>

    <!-- ─── Empty state ──────────────────────────────── -->
    <div v-else class="dash__empty">
      <div class="dash__empty-glyph" aria-hidden="true">
        <Sparkles :size="40" :stroke-width="1.5" />
      </div>
      <h2 class="dash__empty-title">Empieza hoy</h2>
      <p class="dash__empty-desc">
        Elige algo pequeño y empieza hoy.<br>
        Cada día que registras suma, sin importar cuánto.
      </p>
      <button
        class="dash__new-btn dash__new-btn--lg"
        type="button"
        @click="showCreate = true"
      >
        <span class="dash__new-plus">+</span>
        <span>Crear mi primer hábito</span>
      </button>
    </div>

    <!-- ─── Modal ────────────────────────────────────── -->
    <CreateHabitModal v-if="showCreate" @close="showCreate = false" />

  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════
   SHELL
   ══════════════════════════════════════════════ */
.dash {
  min-height: 100svh;
  padding: var(--space-6) var(--space-5);
  padding-bottom: calc(var(--space-6) + 5.5rem);
  width: 100%;
  max-width: 600px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

@media (min-width: 768px) {
  .dash { padding-bottom: var(--space-10); }
}

@media (min-width: 1024px) {
  .dash {
    max-width: 680px;
    padding: var(--space-10) var(--space-6) var(--space-10);
  }
}

/* ══════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════ */
.dash__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: max(var(--space-3), env(safe-area-inset-top));
}

.dash__date {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-text-faint);
  letter-spacing: 0.10em;
  margin-bottom: var(--space-1);
}

.dash__name {
  font-size: clamp(1.75rem, 6.5vw, 2.4rem);
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin-bottom: var(--space-1);
}

.dash__sub {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-weight: 450;
}

/* ── "+ NUEVO" button ─────────────────────────── */
.dash__new-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  height: 2.25rem;
  padding: 0 0.875rem;
  border-radius: var(--radius-full);
  background: var(--color-brand);
  color: var(--color-brand-contrast);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  border: none;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    opacity   var(--duration-base) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
  margin-top: var(--space-2);
}

.dash__new-btn:hover  { box-shadow: var(--shadow-hover-glow); }
.dash__new-btn:active { transform: scale(0.98); }

.dash__new-btn--lg {
  height: 2.75rem;
  font-size: 0.8125rem;
  margin-top: 0;
}

.dash__new-plus {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1;
}

/* ══════════════════════════════════════════════
   STATS — two cards side by side
   ══════════════════════════════════════════════ */
.dash__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.dash__stat {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-lg);
  padding: var(--space-4) var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow: hidden;
  position: relative;
}

.dash__stat-label {
  font-size: 0.5875rem;
  font-weight: 800;
  color: var(--color-text-faint);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  line-height: 1;
}

.dash__stat-val {
  font-size: 1.625rem;
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.03em;
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.dash__stat-icon {
  color: var(--color-brand);
  flex-shrink: 0;
  align-self: center;
}

.dash__wave-icon {
  display: inline-block;
  vertical-align: middle;
  color: var(--color-brand);
  margin-left: 0.25rem;
  position: relative;
  top: -2px;
}

.dash__stat-unit {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  letter-spacing: 0;
}

.dash__stat-hint {
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--color-text-faint);
  letter-spacing: 0.04em;
  margin-top: 2px;
}

.dash__stat-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
}

/* Mini bar chart */
.dash__mini-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 2rem;
  flex-shrink: 0;
}

.dash__mini-bar {
  width: 5px;
  border-radius: 99px 99px 3px 3px;
  min-height: 4px;
  opacity: 0.85;
  transition: height 700ms var(--ease-standard);
}

.dash__restart {
  padding: var(--space-4);
  border-radius: var(--radius-card-md);
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--color-brand) 9%, var(--color-surface)),
      var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-brand) 18%, var(--color-border));
}

.dash__restart p {
  color: var(--color-text);
  font-size: 0.95rem;
  font-weight: 760;
  letter-spacing: -0.01em;
}

.dash__restart span {
  display: block;
  margin-top: 0.25rem;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
}

/* ══════════════════════════════════════════════
   HABIT LIST
   ══════════════════════════════════════════════ */
.dash__section-label {
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--color-text-faint);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}

.dash__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ══════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════ */
.dash__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-4);
  padding: var(--space-12) 0;
}

.dash__empty-glyph {
  color: var(--color-brand);
  line-height: 1;
  display: flex;
}

.dash__empty-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.03em;
}

.dash__empty-desc {
  font-size: 0.875rem;
  color: var(--color-text-faint);
  line-height: 1.65;
  max-width: 22rem;
}
</style>
