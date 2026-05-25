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

    <div class="dg-meta">
      <div class="dg-legend" aria-label="Leyenda de intensidad">
        <span class="dg-legend__item"><i class="dg-legend__swatch dg-legend__swatch--3" /> Excelente</span>
        <span class="dg-legend__item"><i class="dg-legend__swatch dg-legend__swatch--2" /> Bien</span>
        <span class="dg-legend__item"><i class="dg-legend__swatch dg-legend__swatch--1" /> Mínimo</span>
        <span class="dg-legend__item"><i class="dg-legend__swatch dg-legend__swatch--4" /> Flexible</span>
        <span class="dg-legend__item"><i class="dg-legend__swatch dg-legend__swatch--0" /> No realizado</span>
      </div>
    </div>

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

    <!-- ── Footer hint ── -->
    <p class="dg-hint">
      Toca un día para registrar cómo estuvo
    </p>

  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════
   CONTAINER
   ═══════════════════════════════════════════════════ */
.dg {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ═══════════════════════════════════════════════════
   META STRIP (stats left · legend right)
   ═══════════════════════════════════════════════════ */
.dg-meta {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* Legend */
.dg-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.dg-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.dg-legend__swatch {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 4px;
  transition: background-color var(--duration-base) var(--ease-standard);
}

/* Colors mirror DayCell levels exactly */
.dg-legend__swatch--0 {
  background: var(--color-surface-raised);
  box-shadow: inset 0 0 0 1px var(--color-border);
}
.dg-legend__swatch--1 { background: color-mix(in srgb, var(--hc) 22%, var(--color-surface-raised)); }
.dg-legend__swatch--2 { background: color-mix(in srgb, var(--hc) 60%, var(--color-surface)); }
.dg-legend__swatch--4 {
  background: rgba(143, 144, 152, 0.18);
  box-shadow: inset 0 0 0 1px rgba(143, 144, 152, 0.42);
}
.dg-legend__swatch--3 {
  background: var(--hc);
  box-shadow: 0 0 6px color-mix(in srgb, var(--hc) 50%, transparent);
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

/* ═══════════════════════════════════════════════════
   FOOTER HINT
   ═══════════════════════════════════════════════════ */
.dg-hint {
  text-align: center;
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.01em;
  padding-top: var(--space-2);
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
