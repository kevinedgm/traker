<script setup>
import { ref, computed, watch } from 'vue'
import {
  CheckCircle2, Smile, Meh, X,
  Zap, Leaf, Battery, AlertCircle, Frown, ThumbsUp, Moon, Focus, Gauge,
} from 'lucide-vue-next'
import { useHabitsStore } from '@stores/habits'

const props = defineProps({
  habit: { type: Object, required: true },
  day:   { type: Number, required: true },
  isInline: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const store = useHabitsStore()

/* ── Seed from existing log ──────────────────────── */
const existing = computed(() => props.habit.logs?.[props.day])
const level    = ref(existing.value?.level   ?? 3)
const emotion  = ref(existing.value?.emotion ?? null)
const energy   = ref(existing.value?.energy  ?? null)
const note     = ref(existing.value?.note    ?? '')

watch(
  () => [props.habit.id, props.day, existing.value],
  () => {
    level.value   = existing.value?.level   ?? 3
    emotion.value = existing.value?.emotion ?? null
    energy.value  = existing.value?.energy  ?? null
    note.value    = existing.value?.note    ?? ''
  },
  { deep: true }
)

const NOTE_MAX = 120

/* ── Level data ───────────────────────────────────── */
const LEVELS = [
  { value: 3, label: 'Excelente',    sub: 'Lo hice completo',     icon: CheckCircle2 },
  { value: 2, label: 'Bien',         sub: 'Buen avance',          icon: Smile        },
  { value: 1, label: 'Mínimo',       sub: 'Versión reducida',     icon: Meh          },
  { value: 4, label: 'Día flexible', sub: 'Descanso consciente',  icon: Moon         },
  { value: 0, label: 'No realizado', sub: 'Sin castigo',          icon: X            },
]

/* ── Emotion data ─────────────────────────────────── */
const EMOTIONS = [
  { key: 'motivated',  icon: Zap,         label: 'Motivado'   },
  { key: 'calm',       icon: Leaf,        label: 'Tranquilo'  },
  { key: 'tired',      icon: Battery,     label: 'Cansado'    },
  { key: 'anxious',    icon: Frown,       label: 'Ansioso'    },
  { key: 'overloaded', icon: AlertCircle, label: 'Saturado'   },
  { key: 'proud',      icon: ThumbsUp,    label: 'Orgulloso'  },
  { key: 'distracted', icon: Focus,       label: 'Distraído'  },
  { key: 'satisfied',  icon: Smile,       label: 'Satisfecho' },
]

const ENERGY_LEVELS = [
  { key: 'high',   label: 'Alta'  },
  { key: 'medium', label: 'Media' },
  { key: 'low',    label: 'Baja'  },
]

/* ── Level button style (selected state) ──────────── */
function lvlStyle(val) {
  if (level.value !== val) return {}
  if (val === 3) {
    return {
      borderColor:     'var(--color-brand)',
      backgroundColor: 'var(--color-brand)',
      borderWidth:     '2px',
      boxShadow:       'none',
    }
  }
  if (val === 0) {
    return {
      borderColor:     'color-mix(in srgb, var(--hc) 0%, var(--color-border-strong))',
      backgroundColor: 'var(--color-surface-raised)',
      borderWidth:     '2px',
    }
  }
  if (val === 4) {
    return {
      borderColor:     'rgba(143, 144, 152, 0.55)',
      backgroundColor: 'rgba(143, 144, 152, 0.10)',
      borderWidth:     '2px',
    }
  }
  return {
    borderColor:     `color-mix(in srgb, ${props.habit.color} 60%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${props.habit.color} 12%, var(--color-surface))`,
    borderWidth:     '2px',
  }
}

/* ── Save ─────────────────────────────────────────── */
function save() {
  const effectiveLevel = level.value < 0 ? 0 : level.value
  store.logDay(props.habit.id, props.day, {
    level:   effectiveLevel,
    emotion: emotion.value,
    energy:  energy.value,
    note:    note.value.trim(),
  })
  emit('close')
}

const canSave = computed(() => level.value >= 0)

/* ── Save button colour ───────────────────────────── */
const saveStyle = computed(() => {
  if (!canSave.value) return {}
  // Level 3 (Excelente) → full neon; flexible/no realizado stay calm.
  if (level.value === 3) {
    return {
      backgroundColor: 'var(--color-brand)',
      color:           'var(--color-brand-contrast)',
      boxShadow:       'none',
    }
  }
  if (level.value === 4) {
    return { backgroundColor: 'rgba(143, 144, 152, 0.22)', color: '#fff' }
  }
  if (level.value === 0) {
    return { backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text)' }
  }
  return { backgroundColor: props.habit.color, color: '#fff' }
})
</script>

<template>
  <Teleport to="body" :disabled="isInline">

    <!-- Scrim -->
    <div v-if="!isInline" class="lm-scrim" @click="emit('close')" />

    <!-- Sheet -->
    <div
      class="lm-sheet"
      :class="{ 'lm-sheet--inline': isInline }"
      role="dialog"
      aria-modal="true"
      :aria-label="`Registrar día ${day} de ${habit.name}`"
      :style="{ '--hc': habit.color }"
    >

      <!-- Handle -->
      <div v-if="!isInline" class="lm-handle" aria-hidden="true">
        <div class="lm-handle__bar" />
      </div>

      <!-- Header del modal/panel -->
      <div class="flex justify-between items-start mb-4 p-4 pb-0 relative">
        <div class="flex flex-col items-center mx-auto">
          <div class="w-12 h-12 rounded-xl border-2 flex items-center justify-center mb-2" :style="{ borderColor: habit.color }">
            <span class="text-xl font-bold" :style="{ color: habit.color }">{{ day }}</span>
          </div>
          <div class="text-white text-sm font-medium">{{ habit.name }}</div>
        </div>
        <button class="text-app-subtext absolute right-4 top-4 hover:text-white" @click="emit('close')">✕</button>
      </div>

      <!-- ── Scrollable body ── -->
      <div class="lm-body">

        <!-- Performance: 2×2 grid -->
        <section aria-label="¿Cómo fue el día?">
          <p class="lm-section-label">¿Cómo fue este día?</p>
          <div class="lm-levels" role="radiogroup" aria-label="Nivel de desempeño">
            <button
              v-for="lvl in LEVELS"
              :key="lvl.value"
              class="lm-lvl"
              :class="{
                'lm-lvl--active': level === lvl.value,
                'lm-lvl--neon': level === lvl.value && lvl.value === 3,
                'lm-lvl--flexible': level === lvl.value && lvl.value === 4,
                'lm-lvl--not-done': level === lvl.value && lvl.value === 0,
              }"
              :style="lvlStyle(lvl.value)"
              role="radio"
              :aria-checked="level === lvl.value"
              type="button"
              @click="level = lvl.value"
            >
              <component :is="lvl.icon" class="lm-lvl__icon" :size="22" :stroke-width="1.9" aria-hidden="true" />
              <span class="lm-lvl__label">{{ lvl.label }}</span>
              <span class="lm-lvl__sub">{{ lvl.sub }}</span>
            </button>
          </div>
        </section>

        <!-- Emotions -->
        <section aria-label="¿Cómo te sentiste?">
          <p class="lm-section-label">
            ¿Cómo te sentiste?
          </p>
          <div class="lm-emotions" role="group">
            <button
              v-for="em in EMOTIONS"
              :key="em.key"
              class="lm-emotion"
              :class="{ 'lm-emotion--active': emotion === em.key }"
              :style="emotion === em.key
                ? { borderColor: `color-mix(in srgb, var(--hc) 55%, var(--color-border))`,
                    backgroundColor: `color-mix(in srgb, var(--hc) 10%, var(--color-surface))` }
                : {}"
              :aria-pressed="emotion === em.key"
              type="button"
              @click="emotion = emotion === em.key ? null : em.key"
            >
              <component :is="em.icon" class="lm-emotion__icon" :size="15" :stroke-width="2" aria-hidden="true" />
              <span class="lm-emotion__label">{{ em.label }}</span>
            </button>
          </div>
        </section>

        <!-- Energy -->
        <section aria-label="Nivel de energía">
          <p class="lm-section-label">Energía</p>
          <div class="lm-energy" role="group" aria-label="Seleccionar nivel de energía">
            <button
              v-for="item in ENERGY_LEVELS"
              :key="item.key"
              class="lm-energy__pill"
              :class="{ 'lm-energy__pill--active': energy === item.key }"
              type="button"
              :aria-pressed="energy === item.key"
              @click="energy = energy === item.key ? null : item.key"
            >
              <Gauge :size="14" :stroke-width="2" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </section>

        <!-- Note -->
        <section>
          <div class="lm-note-header">
            <p class="lm-section-label">
              Nota opcional
            </p>
            <span
              class="lm-note-count"
              :class="{ 'lm-note-count--warn': note.length > NOTE_MAX * 0.85 }"
            >{{ note.length }}/{{ NOTE_MAX }}</span>
          </div>
          <textarea
            v-model="note"
            class="lm-note"
            :maxlength="NOTE_MAX"
            placeholder="Algo breve, si quieres..."
            rows="3"
          />
        </section>

      </div>

      <!-- ── Save footer ── -->
      <footer class="lm-footer">
        <button
          class="lm-save"
          type="button"
          :class="{ 'lm-save--ready': canSave }"
          :style="saveStyle"
          @click="save"
        >
          Guardar
        </button>
      </footer>

    </div>
  </Teleport>
</template>

<style scoped>
/* ═══════════════════════════════════
   SCRIM
   ═══════════════════════════════════ */
.lm-scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(0 0 0 / 0.58);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* ═══════════════════════════════════
   SHEET
   ═══════════════════════════════════ */
.lm-sheet {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 51;
  display: flex;
  flex-direction: column;
  width: min(100%, 34rem);
  max-height: 94svh;
  margin-inline: auto;
  border-radius: var(--radius-card-lg) var(--radius-card-lg) 0 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-float);
  overflow: hidden;
  animation: lm-up 360ms var(--ease-emphasis) both;
}

.lm-sheet--inline {
  position: relative !important;
  inset: auto !important;
  transform: none !important;
  width: 100% !important;
  max-height: none !important;
  margin: 0 !important;
  border-radius: var(--radius-card-lg) !important;
  box-shadow: var(--shadow-float) !important;
  border: 1px solid var(--color-border) !important;
  animation: none !important;
  z-index: auto !important;
}

@media (min-width: 720px) {
  .lm-sheet {
    inset-inline: unset;
    bottom: unset;
    left: 50%;
    top: 50%;
    width: min(92vw, 35rem);
    max-height: 88svh;
    border-radius: var(--radius-card-lg);
    transform: translate(-50%, -50%);
    animation: lm-center 320ms var(--ease-emphasis) both;
  }

  @keyframes lm-center {
    from { opacity: 0; transform: translate(-50%, calc(-50% + 18px)) scale(0.96); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  /* Hide drag handle — it's a modal, not a sheet */
  .lm-handle { display: none; }
}

@keyframes lm-up {
  from { transform: translateY(100%); opacity: 0.4; }
  to   { transform: translateY(0);    opacity: 1;   }
}

/* ═══════════════════════════════════
   HANDLE
   ═══════════════════════════════════ */
.lm-handle {
  display: flex;
  justify-content: center;
  padding: var(--space-3) 0 0;
  flex-shrink: 0;
}

.lm-handle__bar {
  width: 2.25rem;
  height: 0.25rem;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
}

.lm-titlebar {
  display: grid;
  grid-template-columns: 2.25rem 1fr 2.25rem;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4) 0;
}

.lm-titlebar h2 {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 800;
  text-align: center;
}

.lm-nav-btn {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-full);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
}

/* ═══════════════════════════════════
   HEADER
   ═══════════════════════════════════ */
.lm-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4) var(--space-4);
  border-bottom: none;
  flex-shrink: 0;
  position: relative;
}

/* Big day number badge */
.lm-header__date-badge {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: var(--radius-input);
  background: transparent;
  border: 3px solid var(--hc);
  box-shadow: var(--shadow-glow);
  gap: 1px;
}

.lm-header__day-num {
  color: var(--hc);
  font-size: 1.65rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.lm-header__name {
  color: var(--color-text);
  font-size: var(--text-2xl);
  font-weight: 800;
  line-height: 1.15;
  text-align: center;
}

/* Close button */
.lm-close {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background var(--duration-base) var(--ease-standard),
    color var(--duration-base) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.lm-close:hover  { background: var(--color-border-strong); color: var(--color-text); }
.lm-close:active { transform: scale(0.98); }

/* ═══════════════════════════════════
   SCROLLABLE BODY
   ═══════════════════════════════════ */
.lm-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  padding: var(--space-4) var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.lm-body::-webkit-scrollbar { display: none; }

/* ── Section labels ── */
.lm-section-label {
  color: var(--color-text-faint);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}

.lm-section-opt {
  font-weight: 500;
  color: var(--color-text-faint);
  text-transform: none;
  letter-spacing: 0;
  font-size: var(--text-xs);
}

/* ═══════════════════════════════════
   LEVEL GRID — 4 columns always
   ═══════════════════════════════════ */
.lm-levels {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.lm-lvl {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-1);
  border-radius: var(--radius-input);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface-raised);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  text-align: center;
  transition:
    border-color var(--duration-base) var(--ease-standard),
    background var(--duration-base) var(--ease-standard),
    transform       var(--duration-fast) var(--ease-standard);
}

.lm-lvl:active {
  transform: scale(0.98);
}

.lm-lvl__icon {
  flex-shrink: 0;
}

.lm-lvl__label {
  display: block;
  color: var(--color-text-muted);
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.01em;
}

/* hide sub-text — too cramped in 4-col layout */
.lm-lvl__sub { display: none; }

.lm-lvl--active .lm-lvl__label {
  color: var(--hc);
}

.lm-lvl--flexible .lm-lvl__label,
.lm-lvl--flexible .lm-lvl__icon {
  color: rgba(255, 255, 255, 0.78);
}

.lm-lvl--not-done .lm-lvl__label,
.lm-lvl--not-done .lm-lvl__icon {
  color: var(--color-text-muted);
}

.lm-lvl--neon .lm-lvl__emoji,
.lm-lvl--neon .lm-lvl__label,
.lm-lvl--neon .lm-lvl__icon {
  color: var(--color-brand-contrast);
}

@media (min-width: 540px) {
  .lm-levels {
    grid-template-columns: repeat(5, 1fr);
  }
}

/* ═══════════════════════════════════
   EMOTION CHIPS
   ═══════════════════════════════════ */
.lm-emotions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.lm-emotion {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color var(--duration-base) var(--ease-standard),
    background var(--duration-base) var(--ease-standard),
    transform     var(--duration-fast) var(--ease-standard);
}

.lm-emotion:active {
  transform: scale(0.98);
}

.lm-emotion__icon {
  flex-shrink: 0;
}

.lm-emotion__label {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 720;
  white-space: nowrap;
}

.lm-emotion--active .lm-emotion__label {
  color: var(--hc);
}

/* ═══════════════════════════════════
   ENERGY PILLS
   ═══════════════════════════════════ */
.lm-energy {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.lm-energy__pill {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-raised) 70%, transparent);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 760;
  touch-action: manipulation;
  transition:
    border-color var(--duration-base) var(--ease-standard),
    background var(--duration-base) var(--ease-standard),
    color var(--duration-base) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.lm-energy__pill:active {
  transform: scale(0.98);
}

.lm-energy__pill--active {
  border-color: var(--primary-border);
  background: var(--primary-soft);
  color: var(--color-brand);
}

/* ═══════════════════════════════════
   NOTE + CHARACTER COUNTER
   ═══════════════════════════════════ */
.lm-note-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.lm-note-header .lm-section-label {
  margin-bottom: 0;
}

.lm-note-count {
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: color var(--duration-base) ease;
}

.lm-note-count--warn {
  color: var(--color-warning);
}

.lm-note {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-input);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: inherit;
  line-height: var(--leading-body);
  resize: none;
  outline: none;
  transition: border-color var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard);
}

.lm-note::placeholder { color: var(--color-text-faint); }

.lm-note:focus {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

/* ═══════════════════════════════════
   FOOTER
   ═══════════════════════════════════ */
.lm-footer {
  flex-shrink: 0;
  padding: var(--space-3) var(--space-4) max(var(--space-6), env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.lm-save {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  min-height: 3.25rem;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: var(--text-md);
  font-weight: 760;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--duration-base) var(--ease-standard),
    color var(--duration-base) var(--ease-standard),
    transform        var(--duration-fast) var(--ease-standard);
}

.lm-save--ready {
  background: var(--color-brand) !important;
  color: var(--color-brand-contrast) !important;
  box-shadow: none;
}

.lm-save:active {
  transform: scale(0.98);
}
</style>
