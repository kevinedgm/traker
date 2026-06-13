<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, BarChart3, ChevronRight, MoreHorizontal, PauseCircle, Pencil, Trash2 } from 'lucide-vue-next'
import { resolveHabitIcon } from '@utils/icons'
import { useHabitsStore } from '@stores/habits'
import DayGrid from '@components/habits/DayGrid.vue'
import LogModal from '@components/habits/LogModal.vue'
import CreateHabitModal from '@components/habits/CreateHabitModal.vue'

const route  = useRoute()
const router = useRouter()
const store  = useHabitsStore()

const habit      = computed(() => store.habits.find(h => h.id === route.params.id))
const currentDay = computed(() => habit.value ? store.getCurrentDay(habit.value) : 0)
const completed  = computed(() => habit.value ? store.getCompletedDays(habit.value) : 0)
const percent    = computed(() => habit.value ? Math.min(store.getProgress(habit.value), 100) : 0)
const flexibleDays = computed(() =>
  habit.value
    ? Object.values(habit.value.logs ?? {}).filter(log => log.level === 4).length
    : 0
)

// Continuity over the last 7 elapsed days (flexible days count too):
// rewards showing up this week, even if older days were rough.
const week = computed(() => {
  if (!habit.value) return { kept: 0, window: 7 }
  const cur   = currentDay.value
  const start = Math.max(1, cur - 6)
  let kept = 0
  for (let d = start; d <= cur; d++) {
    const lvl = habit.value.logs?.[d]?.level
    if (lvl >= 1 && lvl <= 4) kept++
  }
  return { kept, window: cur - start + 1 }
})

const selectedDay = ref(null)
const showLog     = ref(false)
const showOptions = ref(false)
const showEdit    = ref(false)
const showDelete  = ref(false)

function onCellTap(day) {
  if (day > currentDay.value) return
  selectedDay.value = day
  showLog.value = true
}

function onLogClose() {
  showLog.value = false
  setTimeout(() => { selectedDay.value = null }, 300)
}

function pauseHabit() {
  if (!habit.value) return
  store.updateHabit(habit.value.id, { isActive: false })
  router.push({ name: 'dashboard' })
}

function deleteHabit() {
  if (!habit.value) return
  const id = habit.value.id
  store.removeHabit(id)
  showDelete.value = false
  router.replace({ name: 'dashboard' })
}
</script>

<template>
  <!-- Not found -->
  <div v-if="!habit" class="not-found">
    <p>Hábito no encontrado</p>
    <button class="btn-ghost" @click="router.push({ name: 'dashboard' })">← Volver</button>
  </div>

  <!-- Detail -->
  <main v-else class="detail" :style="{ '--hc': habit.color }">

    <!-- Accent line top -->
    <div class="detail__topline" aria-hidden="true" />

    <!-- ─── Full-width nav ─────────────────────────── -->
    <nav class="detail__nav">
      <button
        class="detail__nav-btn"
        aria-label="Volver"
        @click="router.push({ name: 'dashboard' })"
      >
        <ArrowLeft :size="18" :stroke-width="2" />
        <span class="detail__nav-back-label">Volver</span>
      </button>

      <span class="detail__nav-title">{{ habit.name }}</span>

      <div class="detail__nav-actions">
        <span class="detail__nav-pct" :style="{ color: habit.color }">{{ percent }}%</span>
        <button
          class="detail__nav-btn detail__nav-btn--icon"
          type="button"
          aria-label="Opciones del hábito"
          :aria-expanded="showOptions"
          @click="showOptions = !showOptions"
        >
          <MoreHorizontal :size="18" :stroke-width="2" />
        </button>

        <div v-if="showOptions" class="detail__menu" role="menu">
          <button type="button" role="menuitem" class="detail__menu-item" @click="showEdit = true; showOptions = false">
            <Pencil :size="15" :stroke-width="2" aria-hidden="true" />
            Editar hábito
          </button>
          <button type="button" role="menuitem" class="detail__menu-item" @click="pauseHabit">
            <PauseCircle :size="15" :stroke-width="2" aria-hidden="true" />
            Pausar hábito
          </button>
          <button type="button" role="menuitem" class="detail__menu-item detail__menu-item--danger" @click="showDelete = true; showOptions = false">
            <Trash2 :size="15" :stroke-width="2" aria-hidden="true" />
            Eliminar hábito
          </button>
        </div>
      </div>
    </nav>

    <!-- ─── Two-column body ────────────────────────── -->
    <div class="detail__body">

      <!-- LEFT: info panel -->
      <aside class="detail__left">

        <!-- Identity -->
        <div class="detail__identity">
          <div class="detail__emoji">
          <component :is="resolveHabitIcon(habit.icon)" :size="28" :stroke-width="1.6" />
        </div>
          <div class="detail__identity-text">
            <h1 class="detail__name">{{ habit.name }}</h1>
            <p class="detail__meta">{{ habit.duration }} días · {{ habit.isActive === false ? 'pausado' : 'en camino' }}</p>
          </div>
        </div>

        <!-- Big percent + progress -->
        <div class="detail__prog-block">
          <div class="detail__prog-header">
            <span class="detail__prog-label">Progreso</span>
            <span class="detail__prog-pct">{{ percent }}%</span>
          </div>
          <div class="detail__progress-track">
            <div class="detail__progress-fill" :style="{ width: `${percent}%` }" />
          </div>
          <div class="detail__progress-labels">
            <span>{{ completed }} / {{ habit.duration }} días construidos</span>
            <span>Podemos seguir desde aquí</span>
          </div>
        </div>

        <!-- Stat boxes -->
        <div class="detail__stat-boxes">
          <div class="detail__stat-box">
            <span class="detail__stat-box__val">{{ currentDay }}</span>
            <span class="detail__stat-box__label">Día actual</span>
          </div>
          <div class="detail__stat-box detail__stat-box--accent">
            <span class="detail__stat-box__val">{{ completed }}</span>
            <span class="detail__stat-box__label">Construidos</span>
          </div>
          <div class="detail__stat-box">
            <span class="detail__stat-box__val">{{ flexibleDays }}</span>
            <span class="detail__stat-box__label">Flexibles</span>
          </div>
          <div class="detail__stat-box">
            <span class="detail__stat-box__val">{{ week.kept }}/{{ week.window }}</span>
            <span class="detail__stat-box__label">Esta semana</span>
          </div>
        </div>

        <!-- Stats link -->
        <button class="detail__stats-link" type="button">
          <span class="detail__stats-icon">
            <BarChart3 :size="16" :stroke-width="2" />
          </span>
          <span>Ver estadísticas</span>
          <ChevronRight :size="15" :stroke-width="2" style="color: var(--color-text-faint); margin-left: auto" />
        </button>

      </aside>

      <!-- RIGHT: grid panel -->
      <section class="detail__right">
        <p class="detail__section-label">Tu registro</p>

        <!-- Legend -->
        <div class="detail__legend" aria-label="Leyenda de colores">
          <span class="detail__legend-item">
            <span class="detail__legend-swatch detail__legend-swatch--3" :style="{ background: habit.color }" />
            Excelente
          </span>
          <span class="detail__legend-item">
            <span class="detail__legend-swatch detail__legend-swatch--2"
              :style="{ background: `color-mix(in srgb, ${habit.color} 60%, var(--color-surface))` }" />
            Bien
          </span>
          <span class="detail__legend-item">
            <span class="detail__legend-swatch detail__legend-swatch--1"
              :style="{ background: `color-mix(in srgb, ${habit.color} 28%, var(--color-surface-raised))` }" />
            Mínimo
          </span>
          <span class="detail__legend-item">
            <span class="detail__legend-swatch detail__legend-swatch--4" />
            Flexible
          </span>
          <span class="detail__legend-item">
            <span class="detail__legend-swatch detail__legend-swatch--0" />
            No realizado
          </span>
        </div>

        <p class="detail__tap-hint">Toca un día para registrar cómo estuvo</p>

        <DayGrid
          :habit="habit"
          :current-day="currentDay"
          :selected-day="selectedDay"
          @cell-tap="onCellTap"
        />
      </section>

    </div><!-- /detail__body -->

    <!-- Log modal -->
    <LogModal
      v-if="showLog && selectedDay !== null"
      :habit="habit"
      :day="selectedDay"
      @close="onLogClose"
    />

    <CreateHabitModal
      v-if="showEdit"
      :habit="habit"
      @close="showEdit = false"
    />

    <div v-if="showDelete" class="detail-confirm__scrim" @click="showDelete = false" />
    <section
      v-if="showDelete"
      class="detail-confirm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Eliminar hábito"
    >
      <div class="detail-confirm__icon" aria-hidden="true">
        <Trash2 :size="20" :stroke-width="2" />
      </div>
      <h2>¿Eliminar este hábito?</h2>
      <p>Esta acción eliminará también su progreso registrado.</p>
      <div class="detail-confirm__actions">
        <button type="button" class="detail-confirm__btn" @click="showDelete = false">Cancelar</button>
        <button type="button" class="detail-confirm__btn detail-confirm__btn--danger" @click="deleteHabit">Eliminar</button>
      </div>
    </section>

  </main>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════
   NOT FOUND
   ══════════════════════════════════════════════════════ */
.not-found {
  display: flex;
  min-height: 100svh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--color-text-muted);
}

/* ══════════════════════════════════════════════════════
   PAGE SHELL
   ══════════════════════════════════════════════════════ */
.detail {
  position: relative;
  min-height: 100svh;
  background:
    radial-gradient(ellipse 70% 50% at 30% 0%,
      color-mix(in srgb, var(--hc) 6%, transparent),
      transparent 55%),
    var(--color-bg);
  padding-bottom: var(--space-10);
}

/* ══════════════════════════════════════════════════════
   ACCENT LINE
   ══════════════════════════════════════════════════════ */
.detail__topline {
  position: fixed;
  inset: 0 0 auto;
  height: 2px;
  background: var(--hc);
  z-index: 20;
  box-shadow: 0 0 12px color-mix(in srgb, var(--hc) 50%, transparent);
}

/* ══════════════════════════════════════════════════════
   NAV — full width, sticky
   ══════════════════════════════════════════════════════ */
.detail__nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: max(1rem, env(safe-area-inset-top)) 1.25rem 0.75rem;
  background: color-mix(in srgb, var(--color-bg) 80%, transparent);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border-bottom: 1px solid var(--color-border);
}

.detail__nav-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem 0.375rem 0.5rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition:
    background var(--duration-base) var(--ease-standard),
    color      var(--duration-base) var(--ease-standard),
    transform  var(--duration-fast) var(--ease-standard);
}
.detail__nav-btn:hover  { background: var(--color-surface-raised); color: var(--color-text); }
.detail__nav-btn:active { transform: scale(0.98); }

/* Title in nav — hidden on mobile (shown in header), visible on tablet+ */
.detail__nav-title {
  flex: 1;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: none; /* shown at tablet+ */
}

.detail__nav-pct {
  font-size: 0.875rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  display: none; /* shown at tablet+ */
}

.detail__nav-actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.detail__nav-btn--icon {
  width: 2.25rem;
  height: 2.25rem;
  justify-content: center;
  padding: 0;
}

.detail__menu {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: 30;
  min-width: 13rem;
  padding: var(--space-2);
  border-radius: var(--radius-card-md);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  box-shadow: var(--shadow-float);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
}

.detail__menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  border-radius: var(--radius-input);
  color: var(--color-text);
  font-size: var(--text-xs);
  font-weight: 720;
  text-align: left;
  transition:
    background var(--duration-base) var(--ease-standard),
    color var(--duration-base) var(--ease-standard);
}

.detail__menu-item:hover {
  background: var(--color-surface-raised);
}

.detail__menu-item--danger {
  color: color-mix(in srgb, var(--color-danger) 78%, var(--color-text));
}

.detail__menu-item--danger:hover {
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface-raised));
}

/* Back label hidden on very small screens */
.detail__nav-back-label {
  display: none;
}

/* ══════════════════════════════════════════════════════
   TWO-COLUMN BODY
   ══════════════════════════════════════════════════════ */
.detail__body {
  display: flex;
  flex-direction: column; /* mobile: stack */
  width: 100%;
  max-width: 430px;
  margin-inline: auto;
}

/* ══════════════════════════════════════════════════════
   LEFT PANEL — info / identity
   ══════════════════════════════════════════════════════ */
.detail__left {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5) 1.25rem;
}

/* Identity row */
.detail__identity {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.detail__emoji {
  width: 3.25rem;
  height: 3.25rem;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--hc) 12%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--hc) 20%, var(--color-border));
  border-radius: var(--radius-xl);
  color: var(--hc);
  flex-shrink: 0;
}

.detail__identity-text { min-width: 0; }

.detail__name {
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.03em;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail__meta {
  font-size: 0.75rem;
  color: var(--color-text-faint);
  margin-top: 3px;
  font-weight: 500;
}

/* Progress block */
.detail__prog-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.detail__prog-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.detail__prog-label {
  font-size: 0.625rem;
  font-weight: 800;
  color: var(--color-text-faint);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.detail__prog-pct {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--hc);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.detail__progress-track {
  height: 6px;
  background: var(--color-surface-raised);
  border-radius: 99px;
  overflow: hidden;
}

.detail__progress-fill {
  height: 100%;
  background: var(--hc);
  border-radius: 99px;
  box-shadow: 0 0 8px color-mix(in srgb, var(--hc) 40%, transparent);
  transition: width 700ms var(--ease-standard);
}

.detail__progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--color-text-faint);
  font-weight: 500;
}

/* Stat boxes — 4-col row */
.detail__stat-boxes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.detail__stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  text-align: center;
}

.detail__stat-box--accent {
  background: color-mix(in srgb, var(--hc) 8%, var(--color-surface));
  border-color: color-mix(in srgb, var(--hc) 22%, var(--color-border));
}

.detail__stat-box__val {
  display: block;
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.detail__stat-box--accent .detail__stat-box__val {
  color: var(--hc);
}

.detail__stat-box__label {
  display: block;
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--color-text-faint);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}

.detail-confirm__scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgb(0 0 0 / 0.58);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.detail-confirm {
  position: fixed;
  inset: auto var(--space-5) max(var(--space-5), env(safe-area-inset-bottom));
  z-index: 81;
  max-width: 28rem;
  margin-inline: auto;
  padding: var(--space-5);
  border-radius: var(--radius-card-lg);
  border: 1px solid color-mix(in srgb, var(--color-danger) 24%, var(--color-border));
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
}

@media (min-width: 720px) {
  .detail-confirm {
    inset: 50% auto auto 50%;
    width: min(92vw, 28rem);
    transform: translate(-50%, -50%);
  }
}

.detail-confirm__icon {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-input);
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface-raised));
  color: color-mix(in srgb, var(--color-danger) 80%, var(--color-text));
}

.detail-confirm h2 {
  margin-top: var(--space-4);
  color: var(--color-text);
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.detail-confirm p {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.detail-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-5);
}

.detail-confirm__btn {
  min-height: 2.5rem;
  padding: 0 var(--space-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: var(--text-xs);
  font-weight: 760;
  transition:
    border-color var(--duration-base) var(--ease-standard),
    background var(--duration-base) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.detail-confirm__btn:active {
  transform: scale(0.98);
}

.detail-confirm__btn--danger {
  border-color: color-mix(in srgb, var(--color-danger) 34%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface-raised));
  color: color-mix(in srgb, var(--color-danger) 82%, var(--color-text));
}

/* Stats link */
.detail__stats-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background      var(--duration-base) var(--ease-standard),
    border-color    var(--duration-base) var(--ease-standard);
}

.detail__stats-link:hover {
  background: var(--color-surface-raised);
  border-color: color-mix(in srgb, var(--hc) 30%, var(--color-border));
}

.detail__stats-icon {
  width: 1.875rem;
  height: 1.875rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--hc) 12%, transparent);
  color: var(--hc);
  flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════
   RIGHT PANEL — grid
   ══════════════════════════════════════════════════════ */
.detail__right {
  padding: 0 1.25rem var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.detail__section-label {
  font-size: 0.625rem;
  font-weight: 800;
  color: var(--color-text-faint);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.detail__tap-hint {
  font-size: 0.7rem;
  color: var(--color-text-faint);
  font-weight: 500;
  opacity: 0.7;
}

/* ── Legend ─────────────────────────────────────────── */
.detail__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.detail__legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.detail__legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 4px;
  flex-shrink: 0;
}

.detail__legend-swatch--0 {
  background: var(--color-surface-raised);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.detail__legend-swatch--4 {
  background: rgba(143, 144, 152, 0.18);
  box-shadow: inset 0 0 0 1px rgba(143, 144, 152, 0.42);
}

/* ══════════════════════════════════════════════════════
   TABLET (≥ 768px) — two real columns
   ══════════════════════════════════════════════════════ */
@media (min-width: 768px) {
  .detail__nav-title  { display: block; }
  .detail__nav-pct    { display: block; }
  .detail__nav-back-label { display: inline; }

  /* Two-column grid: fixed info panel + fluid grid panel */
  .detail__body {
    flex-direction: row;
    align-items: flex-start;
    padding: var(--space-6) var(--space-6) 0;
    gap: var(--space-6);
    max-width: 820px;
  }

  /* Left panel: fixed width, sticky below the nav */
  .detail__left {
    flex: 0 0 260px;
    width: 260px;
    padding: 0;
    position: sticky;
    top: 5rem; /* below sticky nav */
  }

  /* Name can wrap on desktop since we have enough space */
  .detail__name {
    white-space: normal;
    font-size: 1.5rem;
  }

  /* Icon bigger on tablet */
  .detail__emoji {
    width: 3.75rem;
    height: 3.75rem;
  }

  /* Right panel: fluid, takes remaining space */
  .detail__right {
    flex: 0 1 420px;
    min-width: 0;
    padding: 0;
  }
}

/* ══════════════════════════════════════════════════════
   DESKTOP (≥ 1024px) — wider left panel
   ══════════════════════════════════════════════════════ */
@media (min-width: 1024px) {
  .detail__body {
    padding: var(--space-8) var(--space-8) 0;
    gap: var(--space-8);
    max-width: 900px;
  }

  .detail__left {
    flex: 0 0 300px;
    width: 300px;
    top: 5.5rem;
  }

  .detail__right {
    flex-basis: 430px;
  }

  .detail__name { font-size: 1.75rem; }

  .detail__emoji {
    width: 4.25rem;
    height: 4.25rem;
    border-radius: var(--radius-2xl);
  }

  .detail__stat-box__val {
    font-size: var(--text-2xl);
  }
}
</style>
