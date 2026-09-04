<script setup>
import { ref, computed, watch } from 'vue'
import { AlertCircle, Battery, Check, ChevronDown, CircleOff, Focus, Frown, Leaf, Minus, Smile, ThumbsUp, Zap } from 'lucide-vue-next'
import { useHabitsStore } from '@stores/habits'
import { useCopy } from '@/composables/useCopy'
import { normalizeHabitLogOutcome } from '@/features/habits/domain.js'
import {
  AuroraBottomSheet,
  AuroraChip,
  AuroraSegmentedControl,
  AuroraInput,
  AuroraButton,
} from '@components/aurora/index.js'

const props = defineProps({
  habit: { type: Object, required: true },
  day:   { type: Number, required: true },
})
const emit = defineEmits(['close', 'saved'])

const store = useHabitsStore()
const { getPhrase } = useCopy()
const NOTE_MAX = 120

/* ── Seed from existing log ──────────────────────── */
const existing = computed(() => props.habit.logs?.[props.day])
const decision = ref(null)
const minimumUsed = ref(false)
const consciousRest = ref(false)
const emotion  = ref(existing.value?.emotion ?? null)
const energy   = ref(existing.value?.energy  ?? null)
const note     = ref(existing.value?.note    ?? '')
const contextOpen = ref(Boolean(existing.value?.emotion || existing.value?.energy || existing.value?.note))

function seedFromExisting() {
  if (!existing.value) {
    decision.value = null
    minimumUsed.value = false
    consciousRest.value = false
    emotion.value = null
    energy.value = null
    note.value = ''
    contextOpen.value = false
    return
  }
  const outcome = normalizeHabitLogOutcome(existing.value)
  decision.value = outcome.status === 'conscious_skip' ? 'not_done' : outcome.status
  minimumUsed.value = outcome.minimumUsed
  consciousRest.value = outcome.status === 'conscious_skip'
  emotion.value = existing.value.emotion ?? null
  energy.value = existing.value.energy ?? null
  note.value = existing.value.note ?? ''
  contextOpen.value = Boolean(emotion.value || energy.value || note.value)
}

watch(
  () => [props.habit.id, props.day, existing.value],
  seedFromExisting,
  { deep: true, immediate: true }
)

watch(note, v => { if (v.length > NOTE_MAX) note.value = v.slice(0, NOTE_MAX) })

const DECISIONS = [
  { value: 'done', label: 'Sí', help: 'Lo hice', icon: Check, color: 'var(--progress-complete)' },
  { value: 'partial', label: 'A medias', help: 'Hubo avance', icon: Minus, color: 'var(--progress-partial)' },
  { value: 'not_done', label: 'No', help: 'Hoy no pasó', icon: CircleOff, color: 'var(--text-muted)' },
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

const ENERGY_ITEMS = [
  { value: 'high',   label: 'Alta'  },
  { value: 'medium', label: 'Media' },
  { value: 'low',    label: 'Baja'  },
]

/* ── Rescue (when starting is the hard part) ──────── */
// Shown only when the day has no log yet — once something is registered,
// the battle is already won. Resolved via the copy engine (task_started),
// with real anti-repetition instead of the old date-modulo rotation.
const rescueMsg = !existing.value
  ? getPhrase('task_started', { habit: props.habit, vars: { habitName: props.habit.name } }).text
  : ''

function selectDecision(value) {
  decision.value = value
  if (value !== 'partial') minimumUsed.value = false
  if (value !== 'not_done') consciousRest.value = false
}

/* ── Save ─────────────────────────────────────────── */
function save() {
  if (!decision.value) return
  const status = decision.value === 'not_done' && consciousRest.value ? 'conscious_skip' : decision.value
  const outcome = normalizeHabitLogOutcome({ status, minimumUsed: minimumUsed.value })
  store.logDay(props.habit.id, props.day, {
    status: outcome.status,
    minimumUsed: outcome.minimumUsed,
    contextCodes: existing.value?.contextCodes ?? [],
    emotion: emotion.value,
    energy:  energy.value,
    note:    note.value.trim(),
  })
  emit('saved', { habitId: props.habit.id, day: props.day, ...outcome })
  emit('close')
}

const canSave = computed(() => Boolean(decision.value))
const noteHint = computed(() => `${note.value.length}/${NOTE_MAX}`)
</script>

<template>
  <div :style="{ '--hc': habit.color }">
    <AuroraBottomSheet open :title="`Día ${day} · ${habit.name}`" @close="emit('close')">
      <div class="lm-body">

        <fieldset class="lm-decisions">
          <legend>¿Pasó hoy?</legend>
          <button
            v-for="item in DECISIONS"
            :key="item.value"
            type="button"
            :class="{ 'is-selected': decision === item.value }"
            :style="{ '--decision-color': item.color }"
            :aria-pressed="decision === item.value"
            @click="selectDecision(item.value)"
          >
            <component :is="item.icon" :size="19" :stroke-width="2" aria-hidden="true" />
            <span><strong>{{ item.label }}</strong><small>{{ item.help }}</small></span>
          </button>
        </fieldset>

        <section v-if="decision === 'partial'" class="lm-secondary" aria-label="Contexto de avance parcial">
          <label>
            <input v-model="minimumUsed" type="checkbox" />
            <span><strong>Usé mi versión mínima</strong><small>{{ habit.minimumVersion || rescueMsg }}</small></span>
          </label>
        </section>

        <section v-if="decision === 'not_done'" class="lm-secondary" aria-label="Contexto de hoy no">
          <label>
            <input v-model="consciousRest" type="checkbox" />
            <span><strong>Fue un descanso consciente</strong><small>Lo elegí para cuidarme; no queda como deuda.</small></span>
          </label>
        </section>

        <button class="lm-context-toggle" type="button" :aria-expanded="contextOpen" aria-controls="log-context" @click="contextOpen = !contextOpen">
          <span>{{ contextOpen ? 'Ocultar contexto' : 'Añadir contexto opcional' }}</span>
          <ChevronDown :size="17" aria-hidden="true" />
        </button>

        <div v-if="contextOpen" id="log-context" class="lm-context">
          <section aria-label="¿Cómo te sentiste?">
            <p class="lm-section-label">¿Cómo te sentiste?</p>
            <div class="lm-emotions" role="group">
              <AuroraChip
                v-for="em in EMOTIONS"
                :key="em.key"
                :selected="emotion === em.key"
                @click="emotion = emotion === em.key ? null : em.key"
              >
                <template #icon><component :is="em.icon" :size="14" :stroke-width="2" aria-hidden="true" /></template>
                {{ em.label }}
              </AuroraChip>
            </div>
          </section>

          <section aria-label="Nivel de energía">
            <p class="lm-section-label">Energía</p>
            <AuroraSegmentedControl v-model="energy" :items="ENERGY_ITEMS" full-width />
          </section>

          <AuroraInput
            v-model="note"
            label="Nota opcional"
            multiline
            :rows="3"
            placeholder="Algo breve, si quieres..."
            :hint="noteHint"
          />
        </div>

      </div>

      <template #footer>
        <AuroraButton variant="primary" size="lg" full-width :disabled="!canSave" @click="save">Guardar registro</AuroraButton>
      </template>
    </AuroraBottomSheet>
  </div>
</template>

<style scoped>
.lm-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.lm-decisions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.lm-decisions legend {
  grid-column: 1 / -1;
  margin-bottom: 4px;
  color: var(--text-primary);
  font: 600 15px/1.4 var(--font-core);
}

.lm-decisions button {
  display: grid;
  min-width: 0;
  min-height: 84px;
  place-items: center;
  gap: 7px;
  padding: 10px 6px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  background: var(--surface-primary);
  text-align: center;
  cursor: pointer;
}

.lm-decisions button > svg { color: var(--decision-color); }
.lm-decisions button span { display: grid; gap: 2px; min-width: 0; }
.lm-decisions strong { color: var(--text-primary); font: 650 14px/1.2 var(--font-core); }
.lm-decisions small { color: var(--text-muted); font: 400 11px/1.25 var(--font-core); }
.lm-decisions button.is-selected {
  border-color: color-mix(in srgb, var(--decision-color) 62%, var(--border-strong));
  background: color-mix(in srgb, var(--decision-color) 10%, var(--surface-primary));
}
.lm-decisions button:focus-visible,.lm-context-toggle:focus-visible,.lm-secondary input:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

.lm-section-label {
  margin-bottom: 10px;
  font: 600 12px/1 var(--font-core);
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lm-secondary {
  padding-block: 12px;
  border-block: 1px solid var(--border-subtle);
}

.lm-secondary label {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 12px;
  color: var(--text-primary);
  cursor: pointer;
}
.lm-secondary input { width: 21px; height: 21px; flex: none; accent-color: var(--action-primary); }
.lm-secondary span { display: grid; gap: 3px; }
.lm-secondary strong { font: 600 14px/1.3 var(--font-core); }
.lm-secondary small { color: var(--text-muted); font: 400 12px/1.4 var(--font-core); }

.lm-context-toggle {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0;
  border: 0;
  color: var(--text-secondary);
  background: transparent;
  font: 600 13px/1.3 var(--font-core);
  cursor: pointer;
}
.lm-context-toggle svg { transition: transform var(--dur-fast) var(--ease-calm); }
.lm-context-toggle[aria-expanded='true'] svg { transform: rotate(180deg); }
.lm-context { display: grid; gap: 22px; }

.lm-emotions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 360px) {
  .lm-decisions { grid-template-columns: 1fr; }
  .lm-decisions button { min-height: 54px; grid-template-columns: auto 1fr; justify-items: start; padding-inline: 14px; text-align: left; }
}

@media (prefers-reduced-motion: reduce) {
  .lm-context-toggle svg { transition-duration: 1ms; }
}
</style>
