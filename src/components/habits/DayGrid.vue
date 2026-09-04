<script setup>
import { computed } from 'vue'
import DayCell from './DayCell.vue'

const props = defineProps({
  habit:       { type: Object, required: true },
  currentDay:  { type: Number, required: true },
  selectedDay: { type: Number, default: null },
})

const emit = defineEmits(['cell-tap'])

/* Build flat cell list for the full habit duration */
const cells = computed(() =>
  Array.from({ length: props.habit.duration }, (_, i) => {
    const day = i + 1
    const log = props.habit.logs?.[day]
    return {
      day,
      level:    log?.level   ?? 0,
      isFuture: day > props.currentDay,
      isToday:  day === props.currentDay,
    }
  })
)

</script>

<template>
  <div class="dg" :style="{ '--hc': habit.color }">
    <!-- ── Contribution grid ── -->
    <div
      class="dg-grid"
      role="group"
      :aria-label="`Seguimiento de ${habit.name}, ${habit.duration} días`"
    >
      <DayCell
        v-for="cell in cells"
        :key="cell.day"
        :day="cell.day"
        :level="cell.level"
        :color="habit.color"
        :is-today="cell.isToday"
        :is-future="cell.isFuture"
        :is-selected="selectedDay === cell.day"
        @tap="emit('cell-tap', cell.day)"
      />
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════
   CONTAINER
   ═══════════════════════════════════════════════════ */
.dg {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  container-type: inline-size;
}

/* ═══════════════════════════════════════════════════
   CONTRIBUTION GRID
   ═══════════════════════════════════════════════════ */
.dg-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(var(--touch-min), 68px));
  gap: var(--space-3);
  justify-content: space-between;
  width: 100%;
}

@container (min-width: 420px) {
  .dg-grid { grid-template-columns: repeat(7, minmax(var(--touch-min), 68px)); }
}

@container (min-width: 560px) {
  .dg-grid { grid-template-columns: repeat(8, minmax(var(--touch-min), 68px)); }
}
</style>
