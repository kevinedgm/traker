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
      emotion:  log?.emotion ?? null,
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
      role="grid"
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
        :emotion="cell.emotion"
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
}

/* ═══════════════════════════════════════════════════
   CONTRIBUTION GRID
   ═══════════════════════════════════════════════════ */
.dg-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  max-width: 380px;
  margin-inline: auto;
}

@media (min-width: 768px) {
  .dg-grid {
    max-width: 400px;
    gap: 11px;
  }
}

@media (min-width: 1024px) {
  .dg-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    max-width: 400px;
    gap: 12px;
  }
}
</style>
