<script setup>
import { ref, computed, reactive } from 'vue'
import { Sprout, BicepsFlexed, Flame, Target, Check } from 'lucide-vue-next'
import { useHabitsStore } from '@stores/habits'
import { PALETTE } from '@utils/colors'
import { HABIT_ICONS, resolveHabitIcon, DEFAULT_ICON } from '@utils/icons'

const props = defineProps({
  habit: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const store = useHabitsStore()

const DURATIONS = [
  { value: 30, label: '30 días', sub: 'Un buen punto de partida', icon: Sprout       },
  { value: 60, label: '60 días', sub: 'Encuentra tu ritmo',       icon: BicepsFlexed },
  { value: 90, label: '90 días', sub: 'Avance profundo y real',   icon: Flame        },
]

const isEdit = computed(() => !!props.habit)
const isPresetDuration = computed(() => DURATIONS.some(d => d.value === props.habit?.duration))

// ── Step management ────────────────────────────────
const TOTAL = 4
const step  = ref(0)
const dir   = ref(1)   // 1 = forward, -1 = back

function goNext() {
  if (!canContinue.value || step.value >= TOTAL - 1) return
  dir.value = 1
  step.value++
}

function goBack() {
  if (step.value === 0) { emit('close'); return }
  dir.value = -1
  step.value--
}

// ── Form state ─────────────────────────────────────
const form = reactive({
  name:        props.habit?.name ?? '',
  icon:        props.habit?.icon ?? DEFAULT_ICON,
  color:       props.habit?.color ?? PALETTE[7].value,
  duration:    isPresetDuration.value ? props.habit.duration : 30,
  customMode:  props.habit ? !isPresetDuration.value : false,
  customDays:  props.habit && !isPresetDuration.value ? String(props.habit.duration) : '',
  reminder:    Boolean(props.habit?.reminder),
  time:        props.habit?.reminder ?? '08:00',
  days:        props.habit?.reminderDays ? [...props.habit.reminderDays] : [1, 2, 3, 4, 5, 6, 0],
  isActive:    props.habit?.isActive ?? true,
})

const showReduceConfirm = ref(false)

const finalDuration = computed(() =>
  form.customMode ? Math.max(1, parseInt(form.customDays) || 30) : form.duration
)

const canContinue = computed(() =>
  step.value === 0 ? form.name.trim().length >= 2 : true
)

const outOfRangeLogs = computed(() => {
  if (!props.habit || finalDuration.value >= props.habit.duration) return []
  return Object.keys(props.habit.logs ?? {})
    .map(Number)
    .filter(day => day > finalDuration.value)
})

// ── Direction-aware transition ─────────────────────
const transName = computed(() => dir.value === 1 ? 'wz-fwd' : 'wz-bwd')

// ── Save ──────────────────────────────────────────
function save() {
  if (form.name.trim().length < 2) return
  const payload = {
    name:        form.name.trim(),
    icon:        form.icon,
    color:       form.color,
    duration:    finalDuration.value,
    reminder:    form.reminder ? form.time    : null,
    reminderDays: form.reminder ? [...form.days] : null,
    isActive:    form.isActive,
  }

  if (isEdit.value) {
    if (outOfRangeLogs.value.length && !showReduceConfirm.value) {
      showReduceConfirm.value = true
      return
    }
    store.updateHabit(props.habit.id, payload)
  } else {
    store.addHabit(payload)
  }
  emit('close')
}

// ── Static data ────────────────────────────────────
const WEEK = [
  { v: 1, l: 'L' }, { v: 2, l: 'M' }, { v: 3, l: 'X' },
  { v: 4, l: 'J' }, { v: 5, l: 'V' }, { v: 6, l: 'S' }, { v: 0, l: 'D' },
]

function toggleDay(v) {
  const i = form.days.indexOf(v)
  i >= 0 ? form.days.splice(i, 1) : form.days.push(v)
}

const colorName = computed(() => PALETTE.find(p => p.value === form.color)?.name ?? '')
</script>

<template>
  <Teleport to="body">

    <!-- Scrim -->
    <div class="wz-scrim" @click="emit('close')" />

    <!-- Panel -->
    <div
      class="wz-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="isEdit ? 'Editar hábito' : 'Crear nuevo hábito'"
      :style="{ '--wc': form.color }"
    >
      <!-- Mobile handle -->
      <div class="wz-handle" aria-hidden="true">
        <div class="wz-handle__line" />
      </div>

      <!-- ── Header ── -->
      <header class="wz-header">
        <button
          class="btn-icon wz-header__back"
          :aria-label="step === 0 ? 'Cerrar' : 'Volver'"
          @click="goBack"
        >
          <svg v-if="step === 0" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <svg v-else width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Progress segments -->
        <div
          class="wz-progress"
          role="progressbar"
          aria-label="Progreso del formulario"
          aria-valuemin="1"
          :aria-valuenow="step + 1"
          :aria-valuemax="TOTAL"
        >
          <div
            v-for="i in TOTAL"
            :key="i"
            class="wz-progress__seg"
            :class="{
              'wz-progress__seg--done':   i - 1 < step,
              'wz-progress__seg--active': i - 1 === step,
            }"
          />
        </div>

        <span class="wz-header__count">{{ step + 1 }}/{{ TOTAL }}</span>
      </header>

      <!-- ── Animated step body ── -->
      <div class="wz-body">
        <Transition :name="transName">
          <div :key="step" class="wz-step">

            <!-- ═══════════════════════════════════════ -->
            <!-- Step 0 — Nombre e Ícono                -->
            <!-- ═══════════════════════════════════════ -->
            <template v-if="step === 0">
              <div class="wz-intro">
                <h2 class="wz-intro__title">¿Cómo lo<br>llamarás?</h2>
                <p class="wz-intro__sub">
                  {{ isEdit ? 'Ajusta el nombre o el ícono del hábito' : 'Ponle nombre e ícono a tu nuevo hábito' }}
                </p>
              </div>

              <!-- Name + icon preview row -->
              <div class="wz-name-field">
                <div
                  class="wz-name-field__icon"
                  :style="{ background: `color-mix(in srgb, ${form.color} 18%, transparent)` }"
                >
                  <component :is="resolveHabitIcon(form.icon)" :size="26" :stroke-width="1.7" :style="{ color: form.color }" />
                </div>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="Ej. Ir al gimnasio"
                  maxlength="40"
                  autofocus
                  class="wz-name-field__input"
                  @keydown.enter="goNext"
                />
              </div>

              <!-- Icon picker -->
              <div>
                <p class="ds-label wz-section-label">Ícono</p>
                <div class="wz-icon-grid">
                  <button
                    v-for="entry in HABIT_ICONS"
                    :key="entry.key"
                    class="wz-icon-btn"
                    :class="{ 'wz-icon-btn--active': form.icon === entry.key }"
                    :style="form.icon === entry.key
                      ? { background: `color-mix(in srgb, ${form.color} 18%, transparent)`,
                          borderColor: form.color, color: form.color }
                      : {}"
                    type="button"
                    :aria-label="`Seleccionar icono ${entry.key}`"
                    :aria-pressed="form.icon === entry.key"
                    @click="form.icon = entry.key"
                  >
                    <component :is="entry.component" :size="20" :stroke-width="1.75" />
                  </button>
                </div>
              </div>
            </template>

            <!-- ═══════════════════════════════════════ -->
            <!-- Step 1 — Color                         -->
            <!-- ═══════════════════════════════════════ -->
            <template v-else-if="step === 1">
              <div class="wz-intro">
                <h2 class="wz-intro__title">Elige tu<br>color</h2>
                <p class="wz-intro__sub">El color te acompañará cada día</p>
              </div>

              <!-- Live preview card -->
              <div class="wz-color-preview">
                <div class="wz-color-preview__splash" :style="{ background: form.color }" />
                <div class="wz-color-preview__body">
                  <div
                    class="wz-color-preview__icon"
                    :style="{ background: `color-mix(in srgb, ${form.color} 20%, transparent)`, color: form.color }"
                  >
                    <component :is="resolveHabitIcon(form.icon)" :size="20" :stroke-width="1.75" />
                  </div>
                  <div>
                    <p
                      class="wz-color-preview__color-name"
                      :style="{ color: form.color }"
                    >{{ colorName }}</p>
                    <p class="wz-color-preview__habit-name">{{ form.name || 'Mi hábito' }}</p>
                  </div>
                </div>
              </div>

              <!-- Color swatches -->
              <div class="wz-color-grid">
                <button
                  v-for="c in PALETTE"
                  :key="c.value"
                  class="wz-color-swatch"
                  :class="{ 'wz-color-swatch--active': form.color === c.value }"
                  :style="{ '--cc': c.value, background: c.value }"
                  :title="c.name"
                  :aria-label="c.name"
                  :aria-pressed="form.color === c.value"
                  type="button"
                  @click="form.color = c.value"
                />
              </div>
            </template>

            <!-- ═══════════════════════════════════════ -->
            <!-- Step 2 — Duración                      -->
            <!-- ═══════════════════════════════════════ -->
            <template v-else-if="step === 2">
              <div class="wz-intro">
                <h2 class="wz-intro__title">Duración<br>objetivo</h2>
                <p class="wz-intro__sub">¿Por cuántos días quieres sostenerlo?</p>
              </div>

              <div class="wz-duration-list" role="radiogroup" aria-label="Duración objetivo">
                <!-- Quick options -->
                <button
                  v-for="d in DURATIONS"
                  :key="d.value"
                  class="wz-dur-card"
                  :class="{ 'wz-dur-card--active': !form.customMode && form.duration === d.value }"
                  :style="!form.customMode && form.duration === d.value
                    ? { borderColor: form.color,
                        background:  `color-mix(in srgb, ${form.color} 9%, var(--color-surface))` }
                    : {}"
                  type="button"
                  role="radio"
                  :aria-checked="!form.customMode && form.duration === d.value"
                  @click="form.customMode = false; form.duration = d.value"
                >
                  <component :is="d.icon" class="wz-dur-card__icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
                  <div class="wz-dur-card__text">
                    <span class="wz-dur-card__label">{{ d.label }}</span>
                    <span class="wz-dur-card__sub">{{ d.sub }}</span>
                  </div>
                  <div
                    class="wz-dur-card__radio"
                    :style="!form.customMode && form.duration === d.value
                      ? { borderColor: form.color, background: form.color }
                      : {}"
                  >
                    <div class="wz-dur-card__radio-dot" />
                  </div>
                </button>

                <!-- Custom option -->
                <div
                  class="wz-dur-card wz-dur-card--custom"
                  :class="{ 'wz-dur-card--active': form.customMode }"
                  :style="form.customMode
                    ? { borderColor: form.color,
                        background:  `color-mix(in srgb, ${form.color} 9%, var(--color-surface))` }
                    : {}"
                  role="radio"
                  tabindex="0"
                  :aria-checked="form.customMode"
                  aria-label="Duración personalizada"
                  @click="!form.customMode && (form.customMode = true)"
                  @keydown.enter.prevent="form.customMode = true"
                  @keydown.space.prevent="form.customMode = true"
                >
                  <Target class="wz-dur-card__icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
                  <div class="wz-dur-card__text">
                    <span class="wz-dur-card__label">Personalizado</span>
                    <span class="wz-dur-card__sub">Define tus propios días</span>
                  </div>
                  <Transition name="wz-swap">
                    <input
                      v-if="form.customMode"
                      v-model="form.customDays"
                      type="number"
                      min="1"
                      max="365"
                      placeholder="días"
                      class="wz-custom-days"
                      aria-label="Duración personalizada en días"
                      :style="{ borderColor: form.color, color: form.color }"
                      @click.stop
                    />
                    <span
                      v-else
                      class="wz-dur-card__activate"
                      :style="{ color: form.color }"
                    >Elegir →</span>
                  </Transition>
                </div>
              </div>

              <div v-if="outOfRangeLogs.length" class="wz-warning" role="status">
                <p>Hay registros después del día {{ finalDuration }}.</p>
                <span>No se borrarán automáticamente, pero quedarán fuera del rango visible si guardas esta duración.</span>
              </div>
            </template>

            <!-- ═══════════════════════════════════════ -->
            <!-- Step 3 — Horario + Confirmar           -->
            <!-- ═══════════════════════════════════════ -->
            <template v-else>
              <div class="wz-intro">
                <h2 class="wz-intro__title">¿Cuándo<br>lo harás?</h2>
                <p class="wz-intro__sub">Activa un recordatorio para mantenerte enfocado</p>
              </div>

              <!-- Habit summary preview -->
              <div class="wz-summary">
                <div class="wz-summary__topline" />
                <div class="wz-summary__content">
                  <div
                    class="wz-summary__icon"
                    :style="{ background: `color-mix(in srgb, ${form.color} 18%, transparent)`, color: form.color }"
                  >
                    <component :is="resolveHabitIcon(form.icon)" :size="20" :stroke-width="1.75" />
                  </div>
                  <div class="wz-summary__info">
                    <p class="wz-summary__name">{{ form.name }}</p>
                    <p class="wz-summary__meta">{{ finalDuration }} días · Lista para avanzar</p>
                  </div>
                  <div
                    class="wz-summary__dot"
                    :style="{ background: form.color }"
                  />
                </div>
              </div>

              <!-- Reminder toggle -->
              <div class="wz-toggle-wrap">
                <div v-if="isEdit" class="wz-toggle-row wz-toggle-row--status">
                  <div class="wz-toggle-row__text">
                    <p class="wz-toggle-row__label">Hábito activo</p>
                    <p class="wz-toggle-row__sub">Si lo pausas, se oculta sin perder historial</p>
                  </div>
                  <button
                    class="wz-ios-toggle"
                    :class="{ 'wz-ios-toggle--on': form.isActive }"
                    role="switch"
                    :aria-checked="form.isActive"
                    aria-label="Activar o pausar hábito"
                    type="button"
                    @click="form.isActive = !form.isActive"
                  />
                </div>

                <div class="wz-toggle-row">
                  <div class="wz-toggle-row__text">
                    <p class="wz-toggle-row__label">Recordatorio diario</p>
                    <p class="wz-toggle-row__sub">Un pequeño recordatorio amable</p>
                  </div>
                  <button
                    class="wz-ios-toggle"
                    :class="{ 'wz-ios-toggle--on': form.reminder }"
                    role="switch"
                    :aria-checked="form.reminder"
                    aria-label="Activar recordatorio diario"
                    type="button"
                    @click="form.reminder = !form.reminder"
                  />
                </div>

                <Transition name="wz-expand">
                  <div v-if="form.reminder" class="wz-reminder-body">
                    <!-- Time picker -->
                    <div>
                      <p class="ds-label wz-section-label">Hora</p>
                      <input
                        v-model="form.time"
                        type="time"
                        class="input wz-time-input"
                        aria-label="Hora del recordatorio"
                        :style="{ borderColor: `color-mix(in srgb, ${form.color} 45%, transparent)`,
                                  color: form.color }"
                      />
                    </div>

                    <!-- Day chips -->
                    <div>
                      <p class="ds-label wz-section-label">Días</p>
                      <div class="wz-days">
                        <button
                          v-for="d in WEEK"
                          :key="d.v"
                          class="wz-day-chip"
                          :class="{ 'wz-day-chip--on': form.days.includes(d.v) }"
                          :style="form.days.includes(d.v)
                            ? { background: form.color, borderColor: form.color, color: 'white' }
                            : {}"
                          type="button"
                          :aria-pressed="form.days.includes(d.v)"
                          :aria-label="`Recordatorio día ${d.l}`"
                          @click="toggleDay(d.v)"
                        >{{ d.l }}</button>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </template>

          </div>
        </Transition>
      </div>

      <!-- ── Footer CTA ── -->
      <div v-if="showReduceConfirm" class="wz-confirm" role="alertdialog" aria-label="Confirmar nueva duración">
        <p>¿Guardar duración más corta?</p>
        <span>Los registros fuera del nuevo rango se conservarán, pero no aparecerán en el grid actual.</span>
        <div class="wz-confirm__actions">
          <button type="button" class="wz-confirm__btn" @click="showReduceConfirm = false">Cancelar</button>
          <button type="button" class="wz-confirm__btn wz-confirm__btn--primary" @click="save">Guardar cambios</button>
        </div>
      </div>

      <footer class="wz-footer">
        <button
          class="wz-cta"
          type="button"
          :disabled="!canContinue"
          @click="step < TOTAL - 1 ? goNext() : save()"
        >
          <span>{{ step < TOTAL - 1 ? 'Continuar' : (isEdit ? 'Guardar cambios' : 'Crear hábito') }}</span>
          <svg
            v-if="step < TOTAL - 1"
            class="wz-cta__arrow"
            width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 12h14m-6-6l6 6-6 6" />
          </svg>
          <Check v-else class="wz-cta__sparkle" :size="18" :stroke-width="2.5" aria-hidden="true" />
        </button>
      </footer>
    </div>

  </Teleport>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════
   SCRIM
   ═══════════════════════════════════════════════════ */
.wz-scrim {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgb(0 0 0 / 0.55);
  backdrop-filter: blur(6px) saturate(1.2);
  -webkit-backdrop-filter: blur(6px) saturate(1.2);
  animation: wz-fade-in var(--duration-base) var(--ease-standard) both;
}

@keyframes wz-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ═══════════════════════════════════════════════════
   PANEL
   ═══════════════════════════════════════════════════ */
.wz-panel {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 61;
  display: flex;
  flex-direction: column;
  width: min(100%, 30rem);
  max-height: 94svh;
  margin-inline: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-lg) var(--radius-card-lg) 0 0;
  box-shadow: var(--shadow-float);
  overflow: hidden;
  animation: wz-slide-up 400ms cubic-bezier(0.32, 0.72, 0, 1) both;
}

@keyframes wz-slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0);    }
}

@media (min-width: 640px) {
  .wz-panel {
    inset-inline: unset;
    bottom: unset;
    left: 50%;
    top: 50%;
    border-radius: var(--radius-card-lg);
    max-height: 88svh;
    animation: wz-scale-in 360ms cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  @keyframes wz-scale-in {
    from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) scale(0.96); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
}

@media (min-width: 1024px) {
  .wz-panel {
    width: min(100%, 38rem);
  }
}

/* ═══════════════════════════════════════════════════
   HANDLE (mobile only)
   ═══════════════════════════════════════════════════ */
.wz-handle {
  display: flex;
  justify-content: center;
  padding: var(--space-3) 0 0;
  flex-shrink: 0;
}

.wz-handle__line {
  width: 2.25rem;
  height: 0.25rem;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
}

@media (min-width: 640px) {
  .wz-handle { display: none; }
}

/* ═══════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════ */
.wz-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  flex-shrink: 0;
}

.wz-progress {
  display: flex;
  flex: 1;
  gap: 5px;
}

.wz-progress__seg {
  flex: 1;
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--color-surface-raised);
  transition: background 300ms var(--ease-standard);
}

.wz-progress__seg--done   { background: var(--wc); opacity: 0.45; }
.wz-progress__seg--active { background: var(--wc); }

.wz-header__count {
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 760;
  font-variant-numeric: tabular-nums;
  min-width: 2rem;
  text-align: right;
}

/* ═══════════════════════════════════════════════════
   STEP BODY + TRANSITIONS
   ═══════════════════════════════════════════════════ */
.wz-body {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.wz-step {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  padding: var(--space-5) var(--space-4) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.wz-step::-webkit-scrollbar { display: none; }

/* Forward transition */
.wz-fwd-enter-active,
.wz-fwd-leave-active {
  transition:
    transform 360ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity   260ms ease;
  will-change: transform;
}
.wz-fwd-leave-active { position: absolute; inset: 0; overflow: hidden; }
.wz-fwd-enter-from   { transform: translateX(100%); opacity: 0; }
.wz-fwd-leave-to     { transform: translateX(-22%); opacity: 0; }

/* Back transition */
.wz-bwd-enter-active,
.wz-bwd-leave-active {
  transition:
    transform 360ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity   260ms ease;
  will-change: transform;
}
.wz-bwd-leave-active { position: absolute; inset: 0; overflow: hidden; }
.wz-bwd-enter-from   { transform: translateX(-100%); opacity: 0; }
.wz-bwd-leave-to     { transform: translateX(22%);   opacity: 0; }

/* ═══════════════════════════════════════════════════
   STEP INTRO (title + subtitle)
   ═══════════════════════════════════════════════════ */
.wz-intro__title {
  font-family: var(--font-sans);
  font-size: clamp(1.875rem, 7vw, 2.5rem);
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.03em;
  color: var(--color-text);
}

.wz-intro__sub {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: var(--leading-body);
}

/* ═══════════════════════════════════════════════════
   STEP 0 — Name + Icon
   ═══════════════════════════════════════════════════ */
.wz-name-field {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-card-md);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
}

.wz-name-field__icon {
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--radius-input);
  transition: background 250ms var(--ease-standard);
}

.wz-name-field__input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text);
  font-size: var(--text-lg);
  font-weight: 700;
}
.wz-name-field__input::placeholder {
  color: var(--color-text-faint);
  font-weight: 500;
}

.wz-section-label {
  margin-bottom: var(--space-3);
}

.wz-icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-2);
}

@media (min-width: 640px) {
  .wz-icon-grid {
    grid-template-columns: repeat(8, 1fr);
  }
}

.wz-icon-btn {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius-input);
  background: var(--color-surface-raised);
  border: 1px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    transform      var(--duration-base) var(--ease-standard),
    background     var(--duration-base) var(--ease-standard),
    border-color   var(--duration-base) var(--ease-standard),
    color          var(--duration-base) var(--ease-standard);
  touch-action: manipulation;
}

.wz-icon-btn:active {
  transform: scale(0.98);
}

.wz-icon-btn--active {
  transform: scale(1);
  box-shadow: var(--shadow-glow);
}

/* ═══════════════════════════════════════════════════
   STEP 1 — Color
   ═══════════════════════════════════════════════════ */
.wz-color-preview {
  position: relative;
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2xl);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.wz-color-preview__splash {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 5.5rem;
  opacity: 0.14;
  transition: background 250ms var(--ease-standard);
}

.wz-color-preview__body {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
}

.wz-color-preview__icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-lg);
  transition: background 250ms var(--ease-standard), color 250ms var(--ease-standard);
}

.wz-color-preview__color-name {
  font-size: var(--text-md);
  font-weight: 760;
  transition: color 250ms var(--ease-standard);
}

.wz-color-preview__habit-name {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
}

.wz-color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

@media (min-width: 640px) {
  .wz-color-grid {
    grid-template-columns: repeat(7, 1fr);
  }
}

.wz-color-swatch {
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  transition:
    transform var(--duration-base) var(--ease-standard),
    box-shadow var(--duration-base) var(--ease-standard);
  box-shadow: none;
  touch-action: manipulation;
}

.wz-color-swatch:active {
  transform: scale(0.98);
}

.wz-color-swatch--active {
  transform: scale(1);
  box-shadow:
    0 0 0 3px var(--color-surface),
    0 0 0 5px var(--cc);
}

.wz-warning {
  padding: var(--space-4);
  border-radius: var(--radius-card-md);
  border: 1px solid color-mix(in srgb, var(--color-warning) 24%, var(--color-border));
  background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface));
}

.wz-warning p {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 760;
}

.wz-warning span {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: 1.5;
}

/* ═══════════════════════════════════════════════════
   STEP 2 — Duration
   ═══════════════════════════════════════════════════ */
.wz-duration-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.wz-dur-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2xl);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  text-align: left;
  transition:
    border-color var(--duration-base) var(--ease-standard),
    background   var(--duration-base) var(--ease-standard),
    transform    var(--duration-fast)  var(--ease-standard),
    color        var(--duration-base)  var(--ease-standard);
  touch-action: manipulation;
}

.wz-dur-card:active { transform: scale(0.985); transition-duration: 55ms; }

.wz-dur-card--active {
  color: var(--color-text);
}

.wz-dur-card--custom { cursor: default; }

.wz-dur-card__icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.wz-dur-card__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.wz-dur-card__label {
  color: var(--color-text);
  font-size: var(--text-md);
  font-weight: 720;
}

.wz-dur-card__sub {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
}

.wz-dur-card__radio {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-border-strong);
  display: grid;
  place-items: center;
  transition: all 200ms var(--ease-standard);
}

.wz-dur-card__radio-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: white;
  opacity: 0;
  transition: opacity 150ms ease;
}
.wz-dur-card--active .wz-dur-card__radio-dot { opacity: 1; }

.wz-dur-card__activate {
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

.wz-custom-days {
  width: 5.5rem;
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  border: 1.5px solid;
  background: transparent;
  font-size: var(--text-sm);
  font-weight: 760;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
  appearance: textfield;
}
.wz-custom-days::-webkit-outer-spin-button,
.wz-custom-days::-webkit-inner-spin-button { -webkit-appearance: none; }

/* Swap transition (button ↔ input in custom card) */
.wz-swap-enter-active { transition: all 200ms var(--ease-standard); }
.wz-swap-leave-active { transition: all 140ms ease; position: absolute; }
.wz-swap-enter-from   { opacity: 0; transform: translateX(10px); }
.wz-swap-leave-to     { opacity: 0; transform: translateX(-6px); }

/* ═══════════════════════════════════════════════════
   STEP 3 — Schedule + Summary
   ═══════════════════════════════════════════════════ */
.wz-summary {
  position: relative;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2xl);
  overflow: hidden;
  background: color-mix(in srgb, var(--wc) 8%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--wc) 22%, transparent);
  transition: background 300ms ease, border-color 300ms ease;
}

.wz-summary__topline {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--wc);
  transition: background 300ms ease;
}

.wz-summary__content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.wz-summary__icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-lg);
  transition: background 300ms ease, color 300ms ease;
}

.wz-summary__info {
  flex: 1;
  min-width: 0;
}

.wz-summary__name {
  color: var(--color-text);
  font-size: var(--text-md);
  font-weight: 720;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wz-summary__meta {
  margin-top: 3px;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
}

.wz-summary__dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  transition: background 300ms ease, box-shadow 300ms ease;
}

/* Toggle row */
.wz-toggle-wrap {
  border-radius: var(--radius-2xl);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.wz-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.wz-toggle-row__label {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 720;
}

.wz-toggle-row__sub {
  margin-top: 3px;
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 600;
}

/* iOS-style toggle */
.wz-ios-toggle {
  flex-shrink: 0;
  position: relative;
  width: 2.75rem;
  height: 1.625rem;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-border-strong);
  cursor: pointer;
  transition: background 220ms var(--ease-standard);
  touch-action: manipulation;
}

.wz-ios-toggle--on {
  background: var(--wc);
}

.wz-ios-toggle::after {
  content: '';
  position: absolute;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: white;
  top: 0.1875rem;
  left: 0.1875rem;
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.22);
}

.wz-ios-toggle--on::after {
  transform: translateX(1.125rem);
}

/* Reminder detail */
.wz-reminder-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 0 var(--space-4) var(--space-4);
  border-top: 1px solid var(--color-border);
}

.wz-time-input {
  font-size: var(--text-2xl);
  font-weight: 760;
  letter-spacing: -0.02em;
  padding: var(--space-3) var(--space-4);
  max-width: 12rem;
  transition: border-color 250ms ease, color 250ms ease;
}

.wz-days {
  display: flex;
  gap: var(--space-2);
}

.wz-day-chip {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 800;
  cursor: pointer;
  transition: all var(--duration-base) var(--ease-standard);
  touch-action: manipulation;
}

.wz-day-chip:active {
  transform: scale(0.98);
}

/* Expand transition (reminder detail) */
.wz-expand-enter-active { transition: all 300ms var(--ease-standard); }
.wz-expand-leave-active { transition: all 200ms ease; }
.wz-expand-enter-from   { opacity: 0; transform: translateY(-10px); }
.wz-expand-leave-to     { opacity: 0; transform: translateY(-6px);  }

/* ═══════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════ */
.wz-footer {
  flex-shrink: 0;
  padding: var(--space-3) var(--space-4) max(var(--space-6), env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.wz-confirm {
  margin: 0 var(--space-4) var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-card-md);
  border: 1px solid color-mix(in srgb, var(--color-warning) 26%, var(--color-border));
  background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface));
}

.wz-confirm p {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 800;
}

.wz-confirm span {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.wz-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.wz-confirm__btn {
  min-height: 2.25rem;
  padding: 0 var(--space-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-xs);
  font-weight: 760;
}

.wz-confirm__btn--primary {
  border-color: var(--color-brand);
  background: var(--color-brand);
  color: var(--color-brand-contrast);
}

.wz-cta {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-full);
  border: none;
  background: var(--wc);
  color: var(--color-brand-contrast);
  font-size: var(--text-md);
  font-weight: 760;
  cursor: pointer;
  transition:
    background var(--duration-base) var(--ease-standard),
    transform  var(--duration-fast) var(--ease-standard),
    opacity    var(--duration-base) ease;
  touch-action: manipulation;
}

.wz-cta:active:not(:disabled) {
  transform: scale(0.98);
}

.wz-cta:disabled {
  opacity: 0.38;
  pointer-events: none;
}

.wz-cta__arrow {
  flex-shrink: 0;
  transition: transform 200ms var(--ease-standard);
}

.wz-cta:not(:disabled):hover .wz-cta__arrow {
  transform: translateX(3px);
}

.wz-cta__sparkle {
  flex-shrink: 0;
}
</style>
