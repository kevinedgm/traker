<script setup>
import { computed, reactive, watch } from 'vue'
import { features } from '@/config/features.js'

const props = defineProps({ reward: Object, habits: { type: Array, default: () => [] }, goals: { type: Array, default: () => [] }, milestones: { type: Array, default: () => [] }, flexibleGroups: { type: Array, default: () => [] } })
const emit = defineEmits(['save', 'cancel'])
const form = reactive({ name: '', note: '', trigger: 'habit_daily', sourceId: '', sourceIds: [], targetCount: 2, enabled: true })
const isCombo = computed(() => form.trigger === 'habits_combo')
const hasNoSource = computed(() => form.trigger === 'day_sufficient')
const sources = computed(() => form.trigger === 'milestone_completed'
  ? props.milestones
  : form.trigger === 'goal_completed'
  ? props.goals
  : form.trigger === 'flexible_group' ? props.flexibleGroups : props.habits)
const canSave = computed(() => {
  if (!form.name) return false
  if (hasNoSource.value) return true
  if (isCombo.value) return form.sourceIds.length > 0 && form.targetCount >= 1 && form.targetCount <= form.sourceIds.length
  return Boolean(form.sourceId)
})

function assignForm(value) {
  const initial = value ?? {
    name: '',
    note: '',
    trigger: 'habit_daily',
    sourceId: props.habits[0]?.id ?? '',
    sourceIds: props.habits[0]?.id ? [props.habits[0].id] : [],
    targetCount: 2,
    enabled: true,
  }
  Object.assign(form, initial, {
    sourceIds: [...(initial.sourceIds?.length ? initial.sourceIds : initial.sourceId ? [initial.sourceId] : [])],
  })
}

function toggleHabit(id) {
  form.sourceIds = form.sourceIds.includes(id)
    ? form.sourceIds.filter(sourceId => sourceId !== id)
    : [...form.sourceIds, id]
  if (form.sourceIds.length && form.targetCount > form.sourceIds.length) form.targetCount = form.sourceIds.length
}

function save() {
  if (!canSave.value) return
  emit('save', {
    ...form,
    sourceId: isCombo.value ? form.sourceIds[0] ?? '' : form.sourceId,
    sourceIds: hasNoSource.value ? [] : isCombo.value ? [...form.sourceIds] : form.sourceId ? [form.sourceId] : [],
    groupPeriod: form.trigger === 'flexible_group'
      ? props.flexibleGroups.find(group => group.id === form.sourceId)?.period ?? 'week'
      : undefined,
  })
}

watch(() => props.reward, assignForm, { immediate: true })
watch(() => form.trigger, trigger => {
  if (trigger === 'day_sufficient') return
  if (trigger === 'habits_combo') {
    if (!form.sourceIds.length && props.habits[0]?.id) form.sourceIds = [props.habits[0].id]
    form.targetCount = Math.min(Math.max(1, Number(form.targetCount) || 2), Math.max(1, form.sourceIds.length))
    return
  }
  if (!sources.value.some(item => item.id === form.sourceId)) form.sourceId = sources.value[0]?.id ?? ''
})
</script>

<template>
  <form class="reward-form" @submit.prevent="save">
    <p class="reward-form__intro">Algo pequeño que sí se sienta bien. No tiene que costar dinero ni ser comida.</p>

    <label>
      ¿Qué te vas a regalar?
      <input v-model.trim="form.name" maxlength="60" required placeholder="Ej. Una hora de serie sin pendientes" />
    </label>

    <label>
      ¿Cuándo se desbloquea?
      <select v-model="form.trigger">
        <option value="habit_daily">Al mover un hábito hoy</option>
        <option value="habits_combo">Al mover varios hábitos hoy</option>
        <option value="habit_weekly">Al repetir un hábito en la semana</option>
        <option value="day_sufficient">Al cerrar un día suficiente</option>
        <option v-if="flexibleGroups.length" value="flexible_group">Al cubrir un grupo flexible</option>
        <option v-if="features.goals && milestones.length" value="milestone_completed">Al completar un hito</option>
        <option v-if="form.trigger === 'goal_completed'" value="goal_completed">Al terminar una meta (regla anterior)</option>
      </select>
    </label>

    <p v-if="hasNoSource" class="reward-form__explanation">Se desbloquea cuando cierras el día y todos los hábitos programados tienen una versión mínima, adaptada o completa.</p>
    <p v-else-if="form.trigger === 'milestone_completed'" class="reward-form__explanation">Se desbloquea una sola vez cuando el hito seleccionado se completa con evidencia.</p>
    <p v-else-if="form.trigger === 'goal_completed'" class="reward-form__explanation">Esta regla anterior se conserva en este dispositivo. Puedes cambiarla por un hito para sincronizarla.</p>
    <p v-else-if="form.trigger === 'flexible_group'" class="reward-form__explanation">Se desbloquea cuando el grupo alcanza su mínimo semanal o mensual. Las actividades extra siguen siendo opcionales.</p>

    <fieldset v-else-if="isCombo" class="reward-form__habits">
      <legend>Hábitos que pueden contar</legend>
      <label v-for="habit in habits" :key="habit.id">
        <input type="checkbox" :checked="form.sourceIds.includes(habit.id)" @change="toggleHabit(habit.id)" />
        <span>{{ habit.name }}</span>
      </label>
      <p v-if="!habits.length">Crea un hábito antes de usar esta condición.</p>
      <label class="reward-form__threshold">
        ¿Cuántos deben moverse?
        <input v-model.number="form.targetCount" type="number" min="1" :max="Math.max(1, form.sourceIds.length)" required />
      </label>
      <small v-if="form.sourceIds.length">Regla exacta: {{ form.targetCount }} de {{ form.sourceIds.length }} seleccionados.</small>
    </fieldset>

    <div v-else class="reward-form__condition">
      <label v-if="form.trigger === 'habit_weekly'">
        Veces en la semana
        <input v-model.number="form.targetCount" type="number" min="1" max="7" required />
      </label>
      <label>
        {{ form.trigger === 'milestone_completed' ? 'Hito' : form.trigger === 'goal_completed' ? 'Meta' : form.trigger === 'flexible_group' ? 'Grupo flexible' : 'Hábito' }}
        <select v-model="form.sourceId" required>
          <option disabled value="">Elige {{ form.trigger === 'milestone_completed' ? 'un hito' : form.trigger === 'goal_completed' ? 'una meta' : form.trigger === 'flexible_group' ? 'un grupo' : 'un hábito' }}</option>
          <option v-for="source in sources" :key="source.id" :value="source.id">{{ source.title || source.name }}</option>
        </select>
      </label>
    </div>

    <label>
      Una notita opcional
      <textarea v-model.trim="form.note" maxlength="120" rows="2" placeholder="Ej. El sábado, sin prisas y sin culpa" />
    </label>
    <label class="reward-form__enabled"><input v-model="form.enabled" type="checkbox" /> Mantener activa esta recompensa</label>
    <button class="reward-form__save" type="submit" :disabled="!canSave">{{ reward ? 'Guardar cambios' : 'Crear recompensa' }}</button>
  </form>
</template>

<style scoped>
.reward-form{display:grid;gap:18px}
.reward-form__intro,.reward-form__explanation{max-width:65ch;margin:0;color:var(--text-secondary);font:400 13px/1.5 var(--font-core);text-wrap:pretty}
.reward-form__explanation{padding-block:12px;border-block:1px solid var(--border-subtle)}
.reward-form>label,.reward-form__condition label,.reward-form__threshold{display:grid;gap:var(--space-2);color:var(--text-secondary);font:600 var(--label-size)/var(--label-line) var(--font-core)}
.reward-form input:not([type=checkbox]),.reward-form select,.reward-form textarea{box-sizing:border-box;width:100%;min-height:48px;padding:0 var(--space-3);border:1px solid var(--border-strong);border-radius:var(--radius-md);outline:0;color:var(--text-primary);background:var(--surface-primary);font:400 16px/1.4 var(--font-core)}
.reward-form textarea{min-height:72px;padding-block:var(--space-3);resize:vertical}
.reward-form input:focus-visible,.reward-form select:focus-visible,.reward-form textarea:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}
.reward-form__condition{display:grid;grid-template-columns:minmax(8rem,.55fr) minmax(0,1fr);gap:var(--space-3)}
.reward-form__habits{display:grid;gap:8px;margin:0;padding:0;border:0}
.reward-form__habits legend{margin-bottom:4px;color:var(--text-primary);font:600 14px/1.4 var(--font-core)}
.reward-form__habits>label:not(.reward-form__threshold){display:flex;min-height:44px;align-items:center;gap:10px;border-bottom:1px solid var(--border-subtle);color:var(--text-secondary);font:500 14px/1.4 var(--font-core)}
.reward-form__habits input[type=checkbox],.reward-form__enabled input{width:20px;height:20px;accent-color:var(--action-primary)}
.reward-form__habits p,.reward-form__habits small{margin:0;color:var(--text-muted);font:400 12px/1.4 var(--font-core)}
.reward-form__threshold{margin-top:8px}
.reward-form__enabled{display:flex!important;min-height:44px;align-items:center;gap:var(--space-3)!important}
.reward-form__save{min-height:48px;padding-inline:var(--space-5);border:0;border-radius:var(--radius-pill);color:var(--action-primary-fg);background:var(--action-primary);font:600 var(--body-small-size)/1 var(--font-core);cursor:pointer}.reward-form__save:disabled{cursor:not-allowed;opacity:.45}
@media(max-width:520px){.reward-form__condition{grid-template-columns:1fr}.reward-form__save{width:100%}}
</style>
