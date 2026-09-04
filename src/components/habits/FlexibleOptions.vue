<script setup>
import { Check, Layers3 } from 'lucide-vue-next'
import { flexiblePeriodLabel } from '@/features/flexibleGroups/domain.js'
import { resolveHabitIcon } from '@/utils/icons.js'

defineProps({
  groups: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  logForHabit: { type: Function, required: true },
})
const emit = defineEmits(['log', 'open'])

function moved(log) {
  return [1, 2, 3].includes(Number(log?.level))
}
</script>

<template>
  <section v-if="groups.length" class="flex-options" aria-labelledby="flex-options-title">
    <header>
      <span aria-hidden="true"><Layers3 :size="20" /></span>
      <div>
        <h2 id="flex-options-title">Elige lo que te sirva</h2>
        <p>Estas son alternativas, no una lista de pendientes. Cada actividad aparece una sola vez.</p>
      </div>
    </header>

    <div class="flex-options__progress" aria-label="Avance de opciones flexibles">
      <div v-for="group in groups" :key="group.id">
        <span>
          <strong>{{ group.name }}</strong>
          <small>{{ group.built }} de {{ group.minimum }} {{ flexiblePeriodLabel(group.period) }}</small>
        </span>
        <em :class="{ complete: group.isMinimumMet }">{{ group.isMinimumMet ? 'Mínimo cubierto' : `Faltan ${group.remaining}` }}</em>
      </div>
    </div>

    <div v-if="options.length" class="flex-options__list">
      <button
        v-for="option in options"
        :key="option.habit.id"
        type="button"
        :class="{ 'is-moved': moved(logForHabit(option.habit)) }"
        @click="emit('log', option.habit.id)"
      >
        <span class="flex-options__habit-icon" :style="{ '--habit-color': option.habit.color }" aria-hidden="true">
          <component :is="resolveHabitIcon(option.habit.icon)" :size="19" />
        </span>
        <span class="flex-options__habit-copy">
          <strong>{{ option.habit.name }}</strong>
          <small>{{ option.groupNames.join(' · ') }}</small>
        </span>
        <span class="flex-options__state">
          <Check v-if="moved(logForHabit(option.habit))" :size="17" aria-hidden="true" />
          {{ moved(logForHabit(option.habit)) ? 'Cuenta' : 'Elegir' }}
        </span>
      </button>
    </div>
    <p v-else class="flex-options__empty">Las actividades de estos grupos están pausadas o ya no están disponibles.</p>
  </section>
</template>

<style scoped>
.flex-options{display:grid;gap:14px;padding-block:4px}.flex-options>header{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:12px}.flex-options>header>span{display:grid;width:40px;height:40px;place-items:center;color:var(--action-primary)}.flex-options h2{margin:0;color:var(--text-primary);font:600 17px/1.35 var(--font-core);letter-spacing:-.01em}.flex-options header p{max-width:58ch;margin:3px 0 0;color:var(--text-secondary);font:400 13px/1.5 var(--font-core);text-wrap:pretty}.flex-options__progress{display:grid;border-block:1px solid var(--border-subtle)}.flex-options__progress>div{display:flex;min-height:48px;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid var(--border-subtle)}.flex-options__progress>div:last-child{border-bottom:0}.flex-options__progress span{display:grid;min-width:0;gap:2px}.flex-options__progress strong{overflow-wrap:anywhere;color:var(--text-primary);font:600 13px/1.35 var(--font-core)}.flex-options__progress small{color:var(--text-muted);font:400 12px/1.35 var(--font-core)}.flex-options__progress em{flex:none;color:var(--text-muted);font:normal 600 11px/1.2 var(--font-core)}.flex-options__progress em.complete{color:var(--status-success)}.flex-options__list{display:grid;gap:6px}.flex-options__list button{display:grid;grid-template-columns:auto minmax(0,1fr) auto;min-height:58px;align-items:center;gap:12px;padding:8px;border:0;border-radius:var(--radius-md);color:inherit;background:transparent;text-align:start;cursor:pointer}.flex-options__list button:hover{background:var(--surface-secondary)}.flex-options__list button:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}.flex-options__habit-icon{display:grid;width:42px;height:42px;place-items:center;border-radius:var(--radius-md);color:var(--habit-color);background:color-mix(in srgb,var(--habit-color) 13%,var(--surface-secondary))}.flex-options__habit-copy{display:grid;min-width:0;gap:2px}.flex-options__habit-copy strong{overflow-wrap:anywhere;color:var(--text-primary);font:600 14px/1.35 var(--font-core)}.flex-options__habit-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font:400 11px/1.3 var(--font-core)}.flex-options__state{display:flex;min-height:32px;align-items:center;gap:5px;color:var(--action-primary);font:600 12px/1 var(--font-core)}.flex-options__list button.is-moved{opacity:.68}.flex-options__empty{margin:0;color:var(--text-muted);font:400 13px/1.5 var(--font-core)}
@media(max-width:390px){.flex-options__progress>div{align-items:flex-start;padding-block:10px;flex-direction:column;gap:5px}.flex-options__list button{grid-template-columns:auto minmax(0,1fr)}.flex-options__state{grid-column:2}}
</style>
