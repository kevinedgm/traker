<script setup>
import { computed, ref } from 'vue'
import AuroraHabitCard from './AuroraHabitCard.vue'

const props = defineProps({ habits:{default:()=>[]}, title:{default:'Hoy'}, visible:{default:3} })
const emit = defineEmits(['log','open'])
const expanded = ref(false)
const shown = computed(() => expanded.value ? props.habits : props.habits.slice(0, props.visible))
const restCount = computed(() => props.habits.length - shown.value.length)
</script>

<template>
  <section class="habit-list">
    <header><h2>{{title}}</h2><span aria-live="polite">{{shown.length}} de {{habits.length}} visibles</span></header>
    <div class="habit-list__items" role="list">
      <AuroraHabitCard v-for="habit in shown" :key="habit.id" v-bind="habit" role="listitem" @log="emit('log',habit.id)" @open="emit('open',habit.id)">
        <template #icon><component :is="habit.icon" v-if="habit.icon" :size="20" :stroke-width="1.75" /></template>
        <template v-if="$slots.meta" #meta><slot name="meta" :habit="habit" /></template>
      </AuroraHabitCard>
    </div>
    <button v-if="restCount > 0" class="habit-list__more" type="button" @click="expanded=true">Ver {{restCount===1?'un hábito más':`${restCount} hábitos más`}}</button>
  </section>
</template>

<style scoped>.habit-list{display:flex;flex-direction:column}.habit-list>header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px}.habit-list h2{margin:0;color:var(--text-muted);font:600 12px/1 var(--font-core);letter-spacing:.06em;text-transform:uppercase}.habit-list header span{color:var(--text-muted);font:400 12px/1 var(--font-core)}.habit-list__items{display:flex;flex-direction:column}.habit-list__more{align-self:flex-start;min-height:36px;margin-top:14px;padding:0 14px;border:1px solid var(--border-subtle);border-radius:var(--radius-pill);background:transparent;color:var(--text-secondary);font:600 13px/1 var(--font-core);cursor:pointer}</style>
