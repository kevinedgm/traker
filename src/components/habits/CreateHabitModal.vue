<script setup>
import { ref, computed, reactive, onMounted, nextTick, watch } from 'vue'
import { Sprout, BicepsFlexed, CalendarRange, Target, Check } from 'lucide-vue-next'
import { MAX_HABIT_DURATION, normalizeHabitDuration, useHabitsStore } from '@stores/habits'
import { useGoalsStore } from '@stores/goals'
import { features } from '@/config/features.js'
import { habitColorForeground, PALETTE } from '@utils/colors'
import { HABIT_ICONS, resolveHabitIcon, DEFAULT_ICON } from '@utils/icons'
import { useModalFocus } from '@/composables/useModalFocus'
import { CATEGORIES as COPY_CATEGORIES } from '@/features/copy/catalog.js'
import { useCopy } from '@/composables/useCopy'
import { sendTestNotification } from '@services/notifications.service'
import {
  currentTimezone,
  localDateKey,
  normalizeGoalIds,
  normalizeScheduleDays,
} from '@/features/habits/domain.js'

const props = defineProps({
  habit: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const store = useHabitsStore()
const goalsStore = features.goals ? useGoalsStore() : null
const availableGoals = computed(() => goalsStore?.activeGoals ?? [])
const goalsLoading = ref(false)
const goalsError = ref('')

async function loadGoals() {
  if (!goalsStore || goalsStore.loaded) return
  goalsLoading.value = true
  goalsError.value = ''
  try {
    await goalsStore.load()
  } catch {
    goalsError.value = 'No pudimos cargar tus metas.'
  } finally {
    goalsLoading.value = false
  }
}

onMounted(loadGoals)
const dialogRef = ref(null)
const footerCtaRef = ref(null)
const reduceCancelRef = ref(null)
const discardCancelRef = ref(null)
useModalFocus(dialogRef, {
  initialFocus: '[data-modal-initial]',
  onClose: () => {
    if (showReduceConfirm.value) cancelReduce()
    else if (showDiscardConfirm.value) cancelDiscard()
    else requestClose()
  },
})

const COPY_CATEGORY_LABELS = {
  generic: 'General',
  gym: 'Gym',
  cardio: 'Cardio',
  hydration: 'Hidratación',
  sleep: 'Sueño',
  nutrition: 'Nutrición',
  english: 'Inglés',
  study: 'Estudio',
  programming: 'Programación',
  tidiness: 'Orden',
  medication: 'Medicamento',
  family: 'Familia',
  health: 'Salud',
  finance: 'Finanzas',
  work: 'Trabajo',
}

const DURATIONS = [
  { value: 30, label: '30 días', sub: 'Primer ciclo', icon: Sprout },
  { value: 60, label: '60 días', sub: 'Consolidar el ritmo', icon: BicepsFlexed },
  { value: 90, label: '90 días', sub: 'Periodo extendido', icon: CalendarRange },
]

const isEdit = computed(() => !!props.habit)
const isPresetDuration = computed(() => DURATIONS.some(d => d.value === props.habit?.duration))

// ── Step management ────────────────────────────────
const TOTAL = 4
const STEPS = ['Esencia', 'Identidad', 'Ritmo', 'Contexto']
const step  = ref(0)
const dir   = ref(1)   // 1 = forward, -1 = back
const attemptedStep = ref(false)

async function focusStepTitle() {
  await nextTick()
  dialogRef.value?.querySelector('.wz-intro__title')?.focus({ preventScroll: true })
}

async function goNext() {
  attemptedStep.value = true
  if (!canContinue.value || step.value >= TOTAL - 1) return
  dir.value = 1
  step.value++
  attemptedStep.value = false
  await focusStepTitle()
}

async function goBack() {
  if (step.value === 0) { requestClose(); return }
  dir.value = -1
  step.value--
  await focusStepTitle()
}

// ── Form state ─────────────────────────────────────
const form = reactive({
  name:        props.habit?.name ?? '',
  minimumVersion: props.habit?.minimumVersion ?? '',
  goalIds:     normalizeGoalIds(props.habit?.goalIds, props.habit?.goalId),
  icon:        props.habit?.icon ?? DEFAULT_ICON,
  color:       props.habit?.color ?? PALETTE[7].value,
  duration:    isPresetDuration.value ? props.habit.duration : 30,
  customMode:  props.habit ? !isPresetDuration.value : false,
  customDays:  props.habit && !isPresetDuration.value ? String(props.habit.duration) : '',
  reminder:    Boolean(props.habit?.reminder),
  time:        props.habit?.reminder ?? '08:00',
  scheduleId:  props.habit?.schedule?.id ?? null,
  scheduleKind: props.habit?.schedule?.kind ?? 'weekdays',
  scheduleTimezone: props.habit?.schedule?.timezone ?? currentTimezone(),
  scheduleEffectiveFrom: props.habit?.schedule?.effectiveFrom ?? null,
  scheduleDays: normalizeScheduleDays(props.habit?.schedule?.daysOfWeek ?? props.habit?.reminderDays),
  scheduleIntervalDays: props.habit?.schedule?.intervalDays ?? 2,
  scheduleMinimum: props.habit?.schedule?.periodMinimum ?? 3,
  scheduleTarget: props.habit?.schedule?.periodTarget ?? 4,
  scheduleExtra: props.habit?.schedule?.periodExtra ?? 5,
  scheduleWindowStart: props.habit?.schedule?.windowStart ?? '08:00',
  scheduleWindowEnd: props.habit?.schedule?.windowEnd ?? '20:00',
  isActive:    props.habit?.isActive ?? true,
  copySettings: {
    category:         props.habit?.copySettings?.category ?? 'generic',
    toneOverride:      props.habit?.copySettings?.toneOverride ?? null,
    carrillaEnabled:   props.habit?.copySettings?.carrillaEnabled ?? true,
    customPhrases: {
      habit_reminder:  [...(props.habit?.copySettings?.customPhrases?.habit_reminder ?? [])],
      habit_completed: [...(props.habit?.copySettings?.customPhrases?.habit_completed ?? [])],
      habit_returned:  [...(props.habit?.copySettings?.customPhrases?.habit_returned ?? [])],
    },
    preferCustomPhrases: props.habit?.copySettings?.preferCustomPhrases ?? false,
    disabledEventIds:    [...(props.habit?.copySettings?.disabledEventIds ?? [])],
  },
})

function scheduleSignature(value) {
  return JSON.stringify({
    kind: value.kind,
    timezone: value.timezone,
    daysOfWeek: value.daysOfWeek,
    intervalDays: value.intervalDays,
    periodMinimum: value.periodMinimum,
    periodTarget: value.periodTarget,
    periodExtra: value.periodExtra,
    windowStart: value.windowStart,
    windowEnd: value.windowEnd,
  })
}

const initialScheduleSignature = scheduleSignature({
  kind: props.habit?.schedule?.kind ?? 'weekdays',
  timezone: props.habit?.schedule?.timezone ?? form.scheduleTimezone,
  daysOfWeek: props.habit?.schedule?.daysOfWeek ?? form.scheduleDays,
  intervalDays: props.habit?.schedule?.intervalDays ?? form.scheduleIntervalDays,
  periodMinimum: props.habit?.schedule?.periodMinimum ?? form.scheduleMinimum,
  periodTarget: props.habit?.schedule?.periodTarget ?? form.scheduleTarget,
  periodExtra: props.habit?.schedule?.periodExtra ?? form.scheduleExtra,
  windowStart: props.habit?.schedule?.windowStart ?? form.scheduleWindowStart,
  windowEnd: props.habit?.schedule?.windowEnd ?? form.scheduleWindowEnd,
})
const scheduleWasChanged = computed(() => initialScheduleSignature !== scheduleSignature({
  kind: form.scheduleKind,
  timezone: form.scheduleTimezone,
  daysOfWeek: form.scheduleDays,
  intervalDays: form.scheduleIntervalDays,
  periodMinimum: form.scheduleMinimum,
  periodTarget: form.scheduleTarget,
  periodExtra: form.scheduleExtra,
  windowStart: form.scheduleWindowStart,
  windowEnd: form.scheduleWindowEnd,
}))

// ── Copy / personality override (step 4) ────────────
const { getPhrase } = useCopy()
const showCopySection = ref(Boolean(
  props.habit?.copySettings && (
    props.habit.copySettings.category !== 'generic'
    || props.habit.copySettings.toneOverride
    || props.habit.copySettings.carrillaEnabled === false
    || props.habit.copySettings.preferCustomPhrases
    || Object.values(props.habit.copySettings.customPhrases ?? {}).some(list => list?.length)
  )
))
const toneOverrideModel = computed({
  get: () => form.copySettings.toneOverride ?? '',
  set: v => { form.copySettings.toneOverride = v || null },
})
function phrasesTextModel(event) {
  return computed({
    get: () => form.copySettings.customPhrases[event].join('\n'),
    set: v => {
      form.copySettings.customPhrases[event] = v.split('\n').map(s => s.trim()).filter(Boolean)
    },
  })
}
const reminderPhrasesText = phrasesTextModel('habit_reminder')
const completedPhrasesText = phrasesTextModel('habit_completed')
const returnedPhrasesText = phrasesTextModel('habit_returned')

const copyPreview = ref(null)
function previewCopy() {
  const draftHabit = { copySettings: form.copySettings }
  const habitName = form.name.trim() || 'tu hábito'
  copyPreview.value = {
    habit_reminder: getPhrase('habit_reminder', { habit: draftHabit, vars: { habitName, hour: form.time }, preview: true }).text,
    habit_completed: getPhrase('habit_completed', { habit: draftHabit, vars: { habitName }, preview: true }).text,
    habit_returned: getPhrase('habit_returned', { habit: draftHabit, vars: { habitName }, preview: true }).text,
  }
}

const testingNotification = ref(false)
const testNotificationResult = ref('')
async function testCopyNotification() {
  if (testingNotification.value) return
  testingNotification.value = true
  testNotificationResult.value = ''
  try {
    const draftHabit = { copySettings: form.copySettings }
    const habitName = form.name.trim() || 'tu hábito'
    const phrase = getPhrase('habit_reminder', { habit: draftHabit, vars: { habitName, hour: form.time }, preview: true })
    const result = await sendTestNotification({ title: habitName, body: phrase.text })
    testNotificationResult.value = result.ok
      ? 'Notificación enviada. Revisa tu dispositivo.'
      : 'No se pudo enviar (revisa los permisos de notificación).'
  } finally {
    testingNotification.value = false
  }
}

const showReduceConfirm = ref(false)
const showDiscardConfirm = ref(false)
const initialFormSignature = JSON.stringify(form)
const isDirty = computed(() => JSON.stringify(form) !== initialFormSignature)
const hasBlockingConfirm = computed(() => showReduceConfirm.value || showDiscardConfirm.value)

const finalDuration = computed(() =>
  normalizeHabitDuration(form.customMode ? form.customDays : form.duration)
)

const customDurationValid = computed(() => {
  if (!form.customMode) return true
  const value = Number(form.customDays)
  return Number.isInteger(value) && value >= 1 && value <= MAX_HABIT_DURATION
})
const isPeriodSchedule = computed(() => ['times_per_week', 'times_per_month'].includes(form.scheduleKind))
const periodMaximum = computed(() => form.scheduleKind === 'times_per_month' ? 31 : 7)
const scheduleDaysValid = computed(() => form.scheduleKind !== 'weekdays' || form.scheduleDays.length > 0)
const scheduleIntervalValid = computed(() => form.scheduleKind !== 'every_n_days'
  || (Number.isInteger(Number(form.scheduleIntervalDays)) && Number(form.scheduleIntervalDays) >= 1 && Number(form.scheduleIntervalDays) <= 366))
const scheduleTargetsValid = computed(() => {
  if (!isPeriodSchedule.value) return true
  const minimum = Number(form.scheduleMinimum)
  const target = Number(form.scheduleTarget)
  const extra = Number(form.scheduleExtra)
  return [minimum, target, extra].every(value => Number.isInteger(value) && value >= 1 && value <= periodMaximum.value)
    && minimum <= target
    && target <= extra
})
const scheduleWindowValid = computed(() => form.scheduleKind !== 'window'
  || (/^([01]\d|2[0-3]):[0-5]\d$/.test(form.scheduleWindowStart)
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(form.scheduleWindowEnd)
    && form.scheduleWindowStart !== form.scheduleWindowEnd))
const scheduleValid = computed(() => scheduleDaysValid.value
  && scheduleIntervalValid.value
  && scheduleTargetsValid.value
  && scheduleWindowValid.value)
const essentialsValid = computed(() =>
  form.name.trim().length >= 2 && form.minimumVersion.trim().length >= 2
)

const canContinue = computed(() => {
  if (step.value === 0) return essentialsValid.value
  if (step.value === 2) return customDurationValid.value
  if (step.value === 3) return scheduleValid.value
  return true
})
const nameError = computed(() => attemptedStep.value && form.name.trim().length < 2)
const minimumError = computed(() => attemptedStep.value && form.minimumVersion.trim().length < 2)
const customDurationError = computed(() => attemptedStep.value && !customDurationValid.value)
const scheduleDaysError = computed(() => attemptedStep.value && !scheduleDaysValid.value)
const scheduleIntervalError = computed(() => attemptedStep.value && !scheduleIntervalValid.value)
const scheduleTargetsError = computed(() => attemptedStep.value && !scheduleTargetsValid.value)
const scheduleWindowError = computed(() => attemptedStep.value && !scheduleWindowValid.value)

watch(showReduceConfirm, async visible => {
  if (!visible) return
  await nextTick()
  reduceCancelRef.value?.focus()
})

watch(showDiscardConfirm, async visible => {
  if (!visible) return
  await nextTick()
  discardCancelRef.value?.focus()
})

function cancelReduce() {
  showReduceConfirm.value = false
  nextTick(() => footerCtaRef.value?.focus())
}

function requestClose() {
  if (showReduceConfirm.value) cancelReduce()
  else if (showDiscardConfirm.value) cancelDiscard()
  else if (isDirty.value) showDiscardConfirm.value = true
  else emit('close')
}

function cancelDiscard() {
  showDiscardConfirm.value = false
  nextTick(() => footerCtaRef.value?.focus())
}

function discardChanges() {
  showDiscardConfirm.value = false
  emit('close')
}

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
  if (!essentialsValid.value) {
    attemptedStep.value = true
    step.value = 0
    nextTick(() => dialogRef.value?.querySelector('[aria-invalid="true"]')?.focus())
    return
  }
  if (!customDurationValid.value) {
    attemptedStep.value = true
    step.value = 2
    nextTick(() => dialogRef.value?.querySelector('.wz-custom-days')?.focus())
    return
  }
  if (!scheduleValid.value) {
    attemptedStep.value = true
    step.value = 3
    nextTick(() => dialogRef.value?.querySelector('[aria-invalid="true"], .wz-day-chip')?.focus())
    return
  }
  const payload = {
    name:        form.name.trim(),
    minimumVersion: form.minimumVersion.trim(),
    goalId:       form.goalIds[0] ?? null,
    goalIds:      [...form.goalIds],
    icon:        form.icon,
    color:       form.color,
    duration:    finalDuration.value,
    reminder:    form.reminder ? form.time    : null,
    reminderDays: form.reminder && form.scheduleKind === 'weekdays' ? [...form.scheduleDays] : null,
    schedule: {
      id: form.scheduleId,
      kind: form.scheduleKind,
      timezone: form.scheduleTimezone,
      daysOfWeek: form.scheduleKind === 'weekdays' ? [...form.scheduleDays] : null,
      intervalDays: form.scheduleKind === 'every_n_days' ? Number(form.scheduleIntervalDays) : null,
      periodMinimum: isPeriodSchedule.value ? Number(form.scheduleMinimum) : null,
      periodTarget: isPeriodSchedule.value ? Number(form.scheduleTarget) : null,
      periodExtra: isPeriodSchedule.value ? Number(form.scheduleExtra) : null,
      windowStart: form.scheduleKind === 'window' ? form.scheduleWindowStart : null,
      windowEnd: form.scheduleKind === 'window' ? form.scheduleWindowEnd : null,
      effectiveFrom: isEdit.value && scheduleWasChanged.value
        ? localDateKey(new Date(), form.scheduleTimezone)
        : form.scheduleEffectiveFrom,
      effectiveTo: null,
      isActive: true,
      version: props.habit?.schedule?.version ?? 1,
    },
    isActive:    form.isActive,
    copySettings: {
      category:            form.copySettings.category,
      toneOverride:        form.copySettings.toneOverride || null,
      carrillaEnabled:     form.copySettings.carrillaEnabled,
      customPhrases: {
        habit_reminder:  [...form.copySettings.customPhrases.habit_reminder],
        habit_completed: [...form.copySettings.customPhrases.habit_completed],
        habit_returned:  [...form.copySettings.customPhrases.habit_returned],
      },
      preferCustomPhrases: form.copySettings.preferCustomPhrases,
      disabledEventIds:    [...form.copySettings.disabledEventIds],
    },
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
  { v: 1, l: 'L', name: 'lunes' }, { v: 2, l: 'M', name: 'martes' },
  { v: 3, l: 'X', name: 'miércoles' }, { v: 4, l: 'J', name: 'jueves' },
  { v: 5, l: 'V', name: 'viernes' }, { v: 6, l: 'S', name: 'sábado' },
  { v: 0, l: 'D', name: 'domingo' },
]

function toggleDay(v) {
  const i = form.scheduleDays.indexOf(v)
  i >= 0 ? form.scheduleDays.splice(i, 1) : form.scheduleDays.push(v)
  form.scheduleDays = normalizeScheduleDays(form.scheduleDays, [])
}

function toggleGoal(goalId) {
  const index = form.goalIds.indexOf(goalId)
  if (index >= 0) form.goalIds.splice(index, 1)
  else form.goalIds.push(goalId)
}

const colorName = computed(() => PALETTE.find(p => p.value === form.color)?.name ?? '')
const formForeground = computed(() => habitColorForeground(form.color))
const scheduleSummary = computed(() => {
  if (form.scheduleKind === 'times_per_week' || form.scheduleKind === 'times_per_month') {
    const period = form.scheduleKind === 'times_per_week' ? 'semana' : 'mes'
    return `Mínimo ${form.scheduleMinimum} · objetivo ${form.scheduleTarget} por ${period}`
  }
  if (form.scheduleKind === 'every_n_days') {
    return Number(form.scheduleIntervalDays) === 1 ? 'Todos los días' : `Cada ${form.scheduleIntervalDays} días`
  }
  if (form.scheduleKind === 'window') return `Ventana ${form.scheduleWindowStart}–${form.scheduleWindowEnd}`
  const days = form.scheduleDays
  if (days.length === 7) return 'Todos los días'
  if (days.length === 5 && [1, 2, 3, 4, 5].every(day => days.includes(day))) return 'De lunes a viernes'
  return `${days.length} ${days.length === 1 ? 'día' : 'días'} por semana`
})
</script>

<template>
  <Teleport to="body">

    <!-- Scrim -->
    <div class="wz-scrim" @click="requestClose" />

    <!-- Panel -->
    <div
      ref="dialogRef"
      class="wz-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="isEdit ? 'Editar hábito' : 'Crear nuevo hábito'"
      :style="{ '--wc': form.color, '--wc-fg': formForeground }"
      tabindex="-1"
    >
      <!-- Mobile handle -->
      <div class="wz-handle" aria-hidden="true">
        <div class="wz-handle__line" />
      </div>

      <!-- ── Header ── -->
      <header class="wz-header" :inert="hasBlockingConfirm">
        <button
          class="wz-header__back"
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
            :aria-current="i - 1 === step ? 'step' : undefined"
          />
        </div>

        <span class="wz-header__step"><strong>{{ STEPS[step] }}</strong><small>{{ step + 1 }} de {{ TOTAL }}</small></span>
      </header>

      <!-- ── Animated step body ── -->
      <div class="wz-body" :inert="hasBlockingConfirm">
        <Transition :name="transName">
          <div :key="step" class="wz-step">

            <!-- ═══════════════════════════════════════ -->
            <!-- Step 0 — Nombre e Ícono                -->
            <!-- ═══════════════════════════════════════ -->
            <template v-if="step === 0">
              <div class="wz-intro">
                <h2 class="wz-intro__title" tabindex="-1">Dale una forma reconocible</h2>
                <p class="wz-intro__sub">
                  {{ isEdit ? 'Ajusta cómo aparece y cuál es la versión más pequeña que cuenta.' : 'Nombra la acción y define una versión posible incluso en un día difícil.' }}
                </p>
              </div>

              <!-- Name + icon preview row -->
              <label class="wz-name-wrap">
                <span class="ds-label">Nombre del hábito</span>
                <div class="wz-name-field" :class="{ 'wz-field--error': nameError }">
                <div
                  class="wz-name-field__icon"
                  :style="{ background: `color-mix(in srgb, ${form.color} 18%, transparent)` }"
                >
                  <component :is="resolveHabitIcon(form.icon)" :size="26" :stroke-width="1.7" :style="{ color: form.color }" />
                </div>
                <input
                  v-model="form.name"
                  data-modal-initial
                  type="text"
                  placeholder="Ej. Ir al gimnasio"
                  maxlength="40"
                  autofocus
                  class="wz-name-field__input"
                  :aria-invalid="nameError"
                  :aria-describedby="nameError ? 'habit-name-error' : undefined"
                  @keydown.enter="goNext"
                />
                </div>
                <small v-if="nameError" id="habit-name-error" class="wz-field-error">Escribe al menos dos caracteres.</small>
              </label>

              <label class="wz-minimum-field">
                <span class="ds-label">Versión mínima <strong>Necesaria</strong></span>
                <span class="wz-minimum-field__hint">Si el hábito es “Leer”, podría ser “Leer 2 páginas”. Es la forma más pequeña que todavía cuenta.</span>
                <input
                  v-model="form.minimumVersion"
                  type="text"
                  maxlength="80"
                  placeholder="Ej. Leer 2 páginas"
                  class="wz-minimum-field__input"
                  :aria-invalid="minimumError"
                  :aria-describedby="minimumError ? 'habit-minimum-error' : undefined"
                  @keydown.enter="goNext"
                />
                <small v-if="minimumError" id="habit-minimum-error" class="wz-field-error">Define una versión mínima de al menos dos caracteres.</small>
              </label>

            </template>

            <!-- ═══════════════════════════════════════ -->
            <!-- Step 1 — Color                         -->
            <!-- ═══════════════════════════════════════ -->
            <template v-else-if="step === 1">
              <div class="wz-intro">
                <h2 class="wz-intro__title" tabindex="-1">Hazlo fácil de encontrar</h2>
                <p class="wz-intro__sub">Icono y color son opcionales: distinguen este hábito en Inicio y Progreso.</p>
              </div>

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
                    :aria-label="`Seleccionar icono: ${entry.label}`"
                    :aria-pressed="form.icon === entry.key"
                    @click="form.icon = entry.key"
                  >
                    <component :is="entry.component" :size="20" :stroke-width="1.75" />
                  </button>
                </div>
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
                      :style="{ color: 'var(--wc-ink)' }"
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
                  :style="{ '--cc': c.value }"
                  :title="c.name"
                  :aria-label="`Usar color ${c.name}`"
                  :aria-pressed="form.color === c.value"
                  type="button"
                  @click="form.color = c.value"
                >
                  <span class="wz-color-swatch__sample" aria-hidden="true" />
                  <span class="wz-color-swatch__name">{{ c.name }}</span>
                  <Check
                    v-if="form.color === c.value"
                    class="wz-color-swatch__check"
                    :size="16"
                    :stroke-width="2.5"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </template>

            <!-- ═══════════════════════════════════════ -->
            <!-- Step 2 — Duración                      -->
            <!-- ═══════════════════════════════════════ -->
            <template v-else-if="step === 2">
              <div class="wz-intro">
                <h2 class="wz-intro__title" tabindex="-1">Elige un periodo revisable</h2>
                <p class="wz-intro__sub">No es una promesa perfecta: al terminar podrás decidir si continúas o ajustas.</p>
              </div>

              <div class="wz-duration-list" role="radiogroup" aria-label="Duración objetivo">
                <!-- Quick options -->
                <button
                  v-for="d in DURATIONS"
                  :key="d.value"
                  class="wz-dur-card"
                  :class="{ 'wz-dur-card--active': !form.customMode && form.duration === d.value }"
                  :style="!form.customMode && form.duration === d.value
                    ? { borderColor: 'var(--action-primary)',
                        background: 'color-mix(in srgb, var(--action-primary) 9%, var(--color-surface))' }
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
                      ? { borderColor: 'var(--action-primary)', background: 'var(--action-primary)' }
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
                    ? { borderColor: 'var(--action-primary)',
                        background: 'color-mix(in srgb, var(--action-primary) 9%, var(--color-surface))' }
                    : {}"
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
                      :max="MAX_HABIT_DURATION"
                      placeholder="días"
                      class="wz-custom-days"
                      aria-label="Duración personalizada en días"
                      :aria-invalid="customDurationError"
                      :aria-describedby="customDurationError ? 'habit-duration-error' : undefined"
                      @click.stop
                    />
                    <button
                      v-else
                      class="wz-dur-card__activate"
                      type="button"
                      aria-label="Elegir duración personalizada"
                      :style="{ color: 'var(--wc-ink)' }"
                      @click="form.customMode = true"
                    >Elegir →</button>
                  </Transition>
                </div>
                <small v-if="customDurationError" id="habit-duration-error" class="wz-field-error" role="alert">Escribe un número entre 1 y {{ MAX_HABIT_DURATION }} días.</small>
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
                <h2 class="wz-intro__title" tabindex="-1">Prepara el contexto</h2>
                <p class="wz-intro__sub">El recordatorio y la meta vinculada son opcionales. El hábito funciona sin ellos.</p>
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
                    <p class="wz-summary__meta">{{ scheduleSummary }} · {{ finalDuration }} días</p>
                  </div>
                  <div
                    class="wz-summary__dot"
                    :style="{ background: form.color }"
                  />
                </div>
              </div>

              <fieldset v-if="availableGoals.length" class="wz-goal-link">
                <legend class="wz-toggle-row__label">Aporta a tus metas <em>Opcional</em></legend>
                <span class="wz-toggle-row__sub">Puedes conectar este hábito con más de una dirección.</span>
                <div class="wz-goal-options">
                  <button
                    v-for="goal in availableGoals"
                    :key="goal.id"
                    type="button"
                    class="wz-goal-option"
                    :class="{ 'wz-goal-option--selected': form.goalIds.includes(goal.id) }"
                    :aria-pressed="form.goalIds.includes(goal.id)"
                    @click="toggleGoal(goal.id)"
                  >
                    <span>{{ goal.title }}</span>
                    <Check v-if="form.goalIds.includes(goal.id)" :size="16" :stroke-width="2.5" aria-hidden="true" />
                  </button>
                </div>
              </fieldset>
              <div v-else-if="goalsLoading" class="wz-goal-state" role="status">Cargando tus metas…</div>
              <div v-else-if="goalsError" class="wz-goal-state wz-goal-state--error" role="alert">
                <span>{{ goalsError }}</span>
                <button type="button" @click="loadGoals">Reintentar</button>
              </div>

              <section class="wz-schedule" aria-labelledby="habit-schedule-title">
                <div>
                  <h3 id="habit-schedule-title" class="wz-toggle-row__label">Ritmo en Hoy</h3>
                  <p class="wz-toggle-row__sub">Elige cuándo quieres encontrarlo. Lo que no ocurra no se acumula como deuda.</p>
                </div>

                <div class="wz-schedule-kind">
                  <label class="ds-label wz-section-label" for="habit-schedule-kind">Frecuencia</label>
                  <select id="habit-schedule-kind" v-model="form.scheduleKind" class="input">
                    <option value="weekdays">Días específicos</option>
                    <option value="times_per_week">Veces por semana</option>
                    <option value="times_per_month">Veces por mes</option>
                    <option value="every_n_days">Cada cierto número de días</option>
                    <option value="window">Ventana flexible diaria</option>
                  </select>
                </div>

                <div v-if="form.scheduleKind === 'weekdays'" class="wz-days" :aria-describedby="scheduleDaysError ? 'habit-schedule-days-error' : undefined">
                  <button
                    v-for="d in WEEK"
                    :key="d.v"
                    class="wz-day-chip"
                    :class="{ 'wz-day-chip--on': form.scheduleDays.includes(d.v) }"
                    :style="form.scheduleDays.includes(d.v)
                      ? { background: 'var(--action-primary)', borderColor: 'var(--action-primary)', color: 'var(--action-primary-fg)' }
                      : {}"
                    type="button"
                    :aria-pressed="form.scheduleDays.includes(d.v)"
                    :aria-label="`Mostrar el hábito el ${d.name}`"
                    @click="toggleDay(d.v)"
                  >{{ d.l }}</button>
                </div>
                <small v-if="scheduleDaysError" id="habit-schedule-days-error" class="wz-field-error" role="alert">Elige al menos un día para encontrar este hábito en Hoy.</small>

                <div v-if="isPeriodSchedule" class="wz-target-grid" :aria-describedby="scheduleTargetsError ? 'habit-schedule-targets-error' : undefined">
                  <label class="wz-number-field">
                    <span>Mínimo suficiente</span>
                    <input v-model.number="form.scheduleMinimum" class="input" type="number" min="1" :max="periodMaximum" :aria-invalid="scheduleTargetsError" />
                  </label>
                  <label class="wz-number-field">
                    <span>Objetivo</span>
                    <input v-model.number="form.scheduleTarget" class="input" type="number" min="1" :max="periodMaximum" :aria-invalid="scheduleTargetsError" />
                  </label>
                  <label class="wz-number-field">
                    <span>Extra opcional</span>
                    <input v-model.number="form.scheduleExtra" class="input" type="number" min="1" :max="periodMaximum" :aria-invalid="scheduleTargetsError" />
                  </label>
                </div>
                <small v-if="scheduleTargetsError" id="habit-schedule-targets-error" class="wz-field-error" role="alert">Usa cantidades entre 1 y {{ periodMaximum }}, ordenadas de mínimo a extra.</small>

                <label v-if="form.scheduleKind === 'every_n_days'" class="wz-number-field wz-number-field--wide">
                  <span>Intervalo</span>
                  <span class="wz-number-field__control"><input v-model.number="form.scheduleIntervalDays" class="input" type="number" min="1" max="366" :aria-invalid="scheduleIntervalError" /> días</span>
                </label>
                <small v-if="scheduleIntervalError" class="wz-field-error" role="alert">Escribe un intervalo entre 1 y 366 días.</small>

                <div v-if="form.scheduleKind === 'window'" class="wz-window-grid" :aria-describedby="scheduleWindowError ? 'habit-schedule-window-error' : undefined">
                  <label class="wz-number-field"><span>Desde</span><input v-model="form.scheduleWindowStart" class="input" type="time" :aria-invalid="scheduleWindowError" /></label>
                  <label class="wz-number-field"><span>Hasta</span><input v-model="form.scheduleWindowEnd" class="input" type="time" :aria-invalid="scheduleWindowError" /></label>
                </div>
                <small v-if="scheduleWindowError" id="habit-schedule-window-error" class="wz-field-error" role="alert">El inicio y el final de la ventana deben ser horas distintas.</small>
              </section>

              <!-- Reminder toggle -->
              <div class="wz-toggle-wrap">
                <div v-if="isEdit" class="wz-toggle-row wz-toggle-row--status">
                  <div class="wz-toggle-row__text">
                    <p class="wz-toggle-row__label">Hábito activo</p>
                    <p class="wz-toggle-row__sub">Si lo pausas, se oculta sin perder historial</p>
                  </div>
                  <label class="wz-check" aria-label="Mantener hábito activo"><input v-model="form.isActive" type="checkbox" role="switch" /><span><Check :size="15" :stroke-width="2.5" /></span></label>
                </div>

                <div class="wz-toggle-row">
                  <div class="wz-toggle-row__text">
                    <p class="wz-toggle-row__label">Recordatorio</p>
                    <p class="wz-toggle-row__sub">Se enviará sólo cuando el hábito esté disponible en Hoy.</p>
                  </div>
                  <label class="wz-check" aria-label="Añadir recordatorio"><input v-model="form.reminder" type="checkbox" role="switch" /><span><Check :size="15" :stroke-width="2.5" /></span></label>
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
                      />
                    </div>

                  </div>
                </Transition>
              </div>

              <!-- Carrilla personalizada -->
              <div class="wz-toggle-wrap">
                <div class="wz-toggle-row">
                  <div class="wz-toggle-row__text">
                    <p class="wz-toggle-row__label">Carrilla personalizada</p>
                    <p class="wz-toggle-row__sub">Cambia el tono o escribe tus propias frases para este hábito</p>
                  </div>
                  <label class="wz-check" aria-label="Mostrar carrilla personalizada"><input v-model="showCopySection" type="checkbox" role="switch" /><span><Check :size="15" :stroke-width="2.5" /></span></label>
                </div>

                <Transition name="wz-expand">
                  <div v-if="showCopySection" class="wz-reminder-body">
                    <div>
                      <label class="ds-label wz-section-label" for="habit-copy-category">Categoría</label>
                      <select id="habit-copy-category" v-model="form.copySettings.category" class="input">
                        <option v-for="cat in COPY_CATEGORIES" :key="cat" :value="cat">{{ COPY_CATEGORY_LABELS[cat] ?? cat }}</option>
                      </select>
                    </div>

                    <div>
                      <label class="ds-label wz-section-label" for="habit-copy-tone">Tono para este hábito</label>
                      <select id="habit-copy-tone" v-model="toneOverrideModel" class="input">
                        <option value="">Heredar del ajuste general</option>
                        <option value="normal">Normalito</option>
                        <option value="trusted">Con confianza</option>
                        <option value="no_respect">Háblame culero</option>
                      </select>
                    </div>

                    <div class="wz-toggle-row wz-toggle-row--nested">
                      <div class="wz-toggle-row__text">
                        <p class="wz-toggle-row__label">Activar carrilla</p>
                        <p class="wz-toggle-row__sub">Si la apagas, este hábito siempre usa texto plano, sin humor</p>
                      </div>
                      <label class="wz-check" aria-label="Activar carrilla para este hábito"><input v-model="form.copySettings.carrillaEnabled" type="checkbox" role="switch" /><span><Check :size="15" :stroke-width="2.5" /></span></label>
                    </div>

                    <div>
                      <p class="ds-label wz-section-label">Tus propias frases <em>Opcional, una por línea</em></p>
                      <label class="ds-label wz-copy-label" for="copy-phrases-reminder">Recordatorio</label>
                      <textarea id="copy-phrases-reminder" v-model="reminderPhrasesText" rows="2" class="input" placeholder="Ej. Ya sabes qué toca. Hazlo."></textarea>
                      <label class="ds-label wz-copy-label" for="copy-phrases-completed">Cumplimiento</label>
                      <textarea id="copy-phrases-completed" v-model="completedPhrasesText" rows="2" class="input" placeholder="Ej. Eso, ya quedó."></textarea>
                      <label class="ds-label wz-copy-label" for="copy-phrases-returned">Regreso</label>
                      <textarea id="copy-phrases-returned" v-model="returnedPhrasesText" rows="2" class="input" placeholder="Ej. Volviste, qué bien."></textarea>
                    </div>

                    <div class="wz-toggle-row wz-toggle-row--nested">
                      <div class="wz-toggle-row__text">
                        <p class="wz-toggle-row__label">Preferir mis frases</p>
                        <p class="wz-toggle-row__sub">Úsalas siempre en vez de mezclarlas con el catálogo</p>
                      </div>
                      <label class="wz-check" aria-label="Preferir frases personalizadas"><input v-model="form.copySettings.preferCustomPhrases" type="checkbox" role="switch" /><span><Check :size="15" :stroke-width="2.5" /></span></label>
                    </div>

                    <div class="wz-copy-actions">
                      <button type="button" class="wz-quick-save" @click="previewCopy">Previsualizar</button>
                      <button type="button" class="wz-quick-save" :disabled="testingNotification" @click="testCopyNotification">{{ testingNotification ? 'Enviando…' : 'Probar notificación' }}</button>
                    </div>

                    <div v-if="copyPreview" class="wz-copy-preview" role="status">
                      <p><strong>Recordatorio:</strong> {{ copyPreview.habit_reminder }}</p>
                      <p><strong>Cumplimiento:</strong> {{ copyPreview.habit_completed }}</p>
                      <p><strong>Regreso:</strong> {{ copyPreview.habit_returned }}</p>
                    </div>
                    <p v-if="testNotificationResult" class="wz-copy-preview" role="status">{{ testNotificationResult }}</p>
                  </div>
                </Transition>
              </div>
            </template>

          </div>
        </Transition>
      </div>

      <!-- ── Footer CTA ── -->
      <div v-if="showReduceConfirm" class="wz-confirm" role="alertdialog" aria-labelledby="reduce-title" aria-describedby="reduce-description" tabindex="-1">
        <p id="reduce-title">¿Guardar duración más corta?</p>
        <span id="reduce-description">Los registros fuera del nuevo rango se conservarán, pero no aparecerán en el grid actual.</span>
        <div class="wz-confirm__actions">
          <button ref="reduceCancelRef" type="button" class="wz-confirm__btn" @click="cancelReduce">Cancelar</button>
          <button type="button" class="wz-confirm__btn wz-confirm__btn--primary" @click="save">Guardar cambios</button>
        </div>
      </div>

      <div v-if="showDiscardConfirm" class="wz-confirm" role="alertdialog" aria-labelledby="discard-title" aria-describedby="discard-description" tabindex="-1">
        <p id="discard-title">¿Salir sin guardar?</p>
        <span id="discard-description">Los cambios que hiciste en este hábito se perderán.</span>
        <div class="wz-confirm__actions">
          <button ref="discardCancelRef" type="button" class="wz-confirm__btn" @click="cancelDiscard">Seguir editando</button>
          <button type="button" class="wz-confirm__btn wz-confirm__btn--danger" @click="discardChanges">Salir sin guardar</button>
        </div>
      </div>

      <footer class="wz-footer" :inert="hasBlockingConfirm">
        <button
          ref="footerCtaRef"
          class="wz-cta"
          type="button"
          :disabled="step !== 0 && !canContinue"
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
        <button
          v-if="step === 0"
          class="wz-quick-save"
          type="button"
          :disabled="!essentialsValid"
          @click="save"
        >{{ isEdit ? 'Guardar sin revisar lo demás' : 'Crear con valores sugeridos' }}</button>
      </footer>
    </div>

  </Teleport>
</template>

<style scoped>
.ds-label {
  display: block;
  font-size: var(--label-size);
  font-weight: var(--label-weight);
  line-height: var(--label-line);
  letter-spacing: var(--label-track);
  color: var(--color-text-muted);
}

.input {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-input);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.7rem 0.875rem;
  font: inherit;
  transition: border-color var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard);
}

.input::placeholder { color: var(--color-text-faint); }
.input:hover { border-color: var(--color-border-strong); }
.input:focus {
  outline: none;
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

/* ═══════════════════════════════════════════════════
   SCRIM
   ═══════════════════════════════════════════════════ */
.wz-scrim {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: color-mix(in srgb, var(--background-base) 72%, transparent);
  animation: wz-fade-in var(--duration-base) var(--ease-standard) both;
}

@media (min-width: 640px) and (prefers-reduced-motion: no-preference) {
  .wz-scrim {
    backdrop-filter: blur(4px) saturate(1.1);
    -webkit-backdrop-filter: blur(4px) saturate(1.1);
  }
}

@keyframes wz-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ═══════════════════════════════════════════════════
   PANEL
   ═══════════════════════════════════════════════════ */
.wz-panel {
  --wc-ink: color-mix(in srgb, var(--wc) 48%, var(--color-text));
  --wizard-action: var(--action-primary);
  --wizard-action-fg: var(--action-primary-fg);
  --wizard-focus: var(--focus-ring);
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 61;
  display: flex;
  flex-direction: column;
  width: min(100%, 34rem);
  height: 94svh;
  max-height: 94svh;
  margin-inline: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-modal, 28px) var(--radius-modal, 28px) 0 0;
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
    border-radius: var(--radius-modal, 28px);
    height: min(88svh, 52rem);
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
    width: min(100%, 40rem);
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

.wz-header__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color var(--dur-base) var(--ease-calm), color var(--dur-base) var(--ease-calm);
}

.wz-header__back:hover {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.wz-header__back:active {
  transform: scale(var(--press-scale));
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

.wz-progress__seg--done   { background: var(--wizard-action); opacity: 0.45; }
.wz-progress__seg--active { background: var(--wizard-action); }

.wz-header__step {
  min-width:4.8rem;
  display:grid;
  gap:2px;
  text-align: right;
}
.wz-header__step strong { color:var(--color-text); font:600 var(--text-xs)/1.2 var(--font-sans); }
.wz-header__step small { color:var(--color-text-faint); font:600 11px/1.2 var(--font-sans); font-variant-numeric:tabular-nums; }

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
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--wizard-focus) 58%, transparent) transparent;
  padding: var(--space-5) clamp(var(--space-4), 5vw, var(--space-6)) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.wz-step::-webkit-scrollbar { width: 5px; }
.wz-step::-webkit-scrollbar-track { background: transparent; }
.wz-step::-webkit-scrollbar-thumb {
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--wizard-focus) 58%, transparent);
}

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
  max-width:16ch;
  font-size: var(--h1-size);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.025em;
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
  border-radius: var(--radius-input);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  transition: border-color var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard);
}

.wz-name-field:focus-within {
  border-color: var(--wizard-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--wizard-focus) 18%, transparent);
}
.wz-name-wrap { display:grid; gap:var(--space-2); }
.wz-field--error { border-color:var(--color-danger); }
.wz-field-error { color:var(--color-danger); font:600 var(--text-xs)/1.45 var(--font-sans); }

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

.wz-name-field__input:focus-visible { outline: none; }
.wz-name-field__input::placeholder {
  color: var(--color-text-faint);
  font-weight: 500;
}

.wz-minimum-field {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-input);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}

.wz-minimum-field__hint {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: 1.45;
}

.wz-minimum-field .ds-label strong {
  margin-inline-start: var(--space-1);
  color: var(--wizard-action);
  font-size: var(--text-xs);
}

.wz-minimum-field__input {
  width: 100%;
  min-height: 3rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-input);
  outline: none;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font: 650 var(--text-sm)/1 var(--font-sans);
}

.wz-section-label {
  margin-bottom: var(--space-3);
}

.wz-icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
  gap: var(--space-2);
}

.wz-icon-btn {
  min-width:44px;
  min-height:44px;
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
  border-color:var(--wc);
  background:color-mix(in srgb,var(--wc) 12%,var(--color-surface-raised));
}

/* ═══════════════════════════════════════════════════
   STEP 1 — Color
   ═══════════════════════════════════════════════════ */
.wz-color-preview {
  position: relative;
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-card-md);
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.wz-color-swatch {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr) 1rem;
  width: 100%;
  min-height: 3.25rem;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-input);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  cursor: pointer;
  text-align: start;
  transition:
    transform var(--duration-base) var(--ease-standard),
    border-color var(--duration-base) var(--ease-standard),
    background var(--duration-base) var(--ease-standard),
    color var(--duration-base) var(--ease-standard);
  touch-action: manipulation;
}

.wz-color-swatch:active {
  transform: scale(0.98);
}

.wz-color-swatch--active {
  transform: scale(1);
  border-color: var(--wizard-action);
  background: color-mix(in srgb, var(--cc) 10%, var(--color-surface-raised));
  color: var(--color-text);
}

.wz-color-swatch__sample {
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid color-mix(in srgb, var(--cc) 70%, var(--color-border));
  border-radius: var(--radius-full);
  background: var(--cc);
  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--color-surface) 24%, transparent);
}

.wz-color-swatch__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-xs);
  font-weight: 650;
}

.wz-color-swatch__check {
  color: var(--wizard-action);
}

@media (max-width: 379px) {
  .wz-color-grid { grid-template-columns: 1fr; }
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
  border-radius: var(--radius-input);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
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
  transition: border-color 200ms var(--ease-standard), background 200ms var(--ease-standard);
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
  min-height: var(--touch-min);
  padding-inline: var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
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
  border: 1.5px solid var(--color-border-strong);
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
.wz-swap-enter-active { transition: opacity 200ms var(--ease-standard), transform 200ms var(--ease-standard); }
.wz-swap-leave-active { transition: opacity 140ms ease, transform 140ms ease; position: absolute; }
.wz-swap-enter-from   { opacity: 0; transform: translateX(10px); }
.wz-swap-leave-to     { opacity: 0; transform: translateX(-6px); }

/* ═══════════════════════════════════════════════════
   STEP 3 — Schedule + Summary
   ═══════════════════════════════════════════════════ */
.wz-summary {
  position: relative;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-card-md);
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

.wz-goal-link {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.wz-goal-link em { color:var(--color-text-faint); font-style:normal; font-weight:500; }
.wz-goal-options {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
.wz-goal-option {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-input);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font: 650 var(--text-sm)/1.35 var(--font-sans);
  text-align: left;
  cursor: pointer;
}
.wz-goal-option--selected {
  border-color: color-mix(in srgb, var(--wizard-action) 62%, var(--color-border));
  background: color-mix(in srgb, var(--wizard-action) 10%, var(--color-surface-raised));
  color: var(--color-text);
}
.wz-goal-option:focus-visible {
  outline: 2px solid var(--wizard-focus);
  outline-offset: 2px;
}

.wz-goal-state {
  display: flex;
  min-height: 3rem;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-input);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.wz-goal-state--error {
  border-color: color-mix(in srgb, var(--color-danger) 32%, var(--color-border));
  color: var(--color-text);
}

.wz-goal-state button {
  min-height: 44px;
  padding-inline: var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--wc-ink);
  font-weight: 760;
}

/* Toggle row */
.wz-schedule {
  display: grid;
  gap: var(--space-3);
  padding-block: var(--space-1);
}

.wz-schedule-kind {
  display: grid;
  gap: var(--space-2);
}

.wz-target-grid,
.wz-window-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.wz-window-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.wz-number-field {
  display: grid;
  min-width: 0;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 680;
}

.wz-number-field .input {
  min-width: 0;
  font-size: 1rem;
}

.wz-number-field--wide {
  max-width: 16rem;
}

.wz-number-field__control {
  display: grid;
  grid-template-columns: minmax(0, 7rem) auto;
  align-items: center;
  gap: var(--space-2);
}

.wz-toggle-wrap {
  border-radius: var(--radius-card-md);
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

.wz-check { position:relative; width:44px; height:44px; flex:none; display:grid; place-items:center; cursor:pointer; }
.wz-check input { position:absolute; width:1px; height:1px; opacity:0; }
.wz-check span { width:24px; height:24px; display:grid; place-items:center; border:1.5px solid var(--color-border-strong); border-radius:var(--radius-sm); background:var(--color-surface); color:transparent; transition:background var(--duration-base) var(--ease-standard),border-color var(--duration-base) var(--ease-standard),color var(--duration-base) var(--ease-standard); }
.wz-check input:checked + span { border-color:var(--wizard-action); background:var(--wizard-action); color:var(--wizard-action-fg); }
.wz-check input:focus-visible + span { outline:2px solid var(--wizard-focus); outline-offset:2px; }

/* Reminder detail */
.wz-reminder-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 0 var(--space-4) var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* Carrilla personalizada */
.wz-toggle-row--nested { padding-inline: 0; }
.wz-copy-label { margin-top: var(--space-2); margin-bottom: var(--space-1); }
.wz-copy-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.wz-copy-actions .wz-quick-save {
  width: auto;
  flex: 1 1 auto;
  margin-top: 0;
  padding: 0 var(--space-3);
  min-height: 2.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface-raised);
}
.wz-copy-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border-radius: var(--radius-input);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: 1.5;
}
.wz-copy-preview strong { color: var(--color-text); }

.wz-time-input {
  font-size: var(--text-2xl);
  font-weight: 760;
  letter-spacing: -0.02em;
  padding: var(--space-3) var(--space-4);
  max-width: 12rem;
  transition: border-color 250ms ease, color 250ms ease;
}

.wz-days {
  display: grid;
  grid-template-columns: repeat(4, minmax(44px, 1fr));
  gap: var(--space-2);
}

@media (max-width: 520px) {
  .wz-target-grid { grid-template-columns: 1fr; }
}

.wz-day-chip {
  display: grid;
  width: 100%;
  min-width: 44px;
  height: 2.75rem;
  place-items: center;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 800;
  cursor: pointer;
  transition: background var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);
  touch-action: manipulation;
}

.wz-day-chip:active {
  transform: scale(0.98);
}

.wz-day-chip:focus-visible {
  outline: 2px solid var(--wizard-focus);
  outline-offset: 2px;
}

/* Expand transition (reminder detail) */
.wz-expand-enter-active { transition: opacity 300ms var(--ease-standard), transform 300ms var(--ease-standard); }
.wz-expand-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
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
  min-height: 44px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-xs);
  font-weight: 760;
}

.wz-confirm__btn--primary {
  border-color: var(--wizard-action);
  background: var(--wizard-action);
  color: var(--wizard-action-fg);
}

.wz-confirm__btn--danger {
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
  color: var(--color-danger);
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
  min-height:48px;
  background: var(--wizard-action);
  color: var(--wizard-action-fg);
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

.wz-quick-save {
  width: 100%;
  min-height: 44px;
  margin-top: var(--space-1);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 650;
  cursor: pointer;
}

.wz-quick-save:disabled { cursor: not-allowed; opacity: 0.4; }

.wz-panel button:focus-visible {
  outline:2px solid var(--wizard-focus);
  outline-offset:2px;
}

.wz-panel :is(input:not([type="checkbox"]), select):not(.wz-name-field__input):focus,
.wz-panel :is(input:not([type="checkbox"]), select):not(.wz-name-field__input):focus-visible {
  border-color: var(--wizard-focus);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--wizard-focus) 18%, transparent);
}

@media (min-width: 420px) {
  .wz-days { grid-template-columns: repeat(7, minmax(44px, 1fr)); }
}

@media (max-width: 639px) {
  .wz-panel :is(input, select) { font-size: max(1rem, 16px); }
}

@media (forced-colors: active) {
  .wz-color-swatch--active,
  .wz-icon-btn--active,
  .wz-dur-card--active { outline: 2px solid CanvasText; outline-offset: 2px; }
}

@media (prefers-reduced-motion: reduce) {
  .wz-scrim,.wz-panel { animation-duration:1ms; }
  .wz-fwd-enter-active,.wz-fwd-leave-active,.wz-bwd-enter-active,.wz-bwd-leave-active,
  .wz-swap-enter-active,.wz-swap-leave-active,.wz-expand-enter-active,.wz-expand-leave-active { transition-duration:1ms; }
  .wz-fwd-enter-from,.wz-fwd-leave-to,.wz-bwd-enter-from,.wz-bwd-leave-to,
  .wz-swap-enter-from,.wz-swap-leave-to,.wz-expand-enter-from,.wz-expand-leave-to { transform:none; }
}
</style>
