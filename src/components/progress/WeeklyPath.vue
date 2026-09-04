<script setup>
import { Check, Leaf, Minus } from 'lucide-vue-next'
defineProps({
  days: { type: Array, required: true },
  acknowledge: { type: Boolean, default: false },
  color: { type: String, required: true },
})

const stateLabel = {
  complete: 'completo',
  adapted: 'adaptado',
  paused: 'en pausa',
  none: 'sin registro',
  pending: 'pendiente',
}
</script>

<template>
  <div class="weekly-path" :class="{ 'weekly-path--acknowledge': acknowledge }" role="list" aria-label="Trayectoria de los últimos siete días" :style="{ '--weekly-columns': days.length, '--path-color': color }">
    <div
      v-for="(day, index) in days"
      :key="`${day.label}-${index}`"
      class="weekly-path__day"
      :class="[`weekly-path__day--${day.state}`, { 'weekly-path__day--today': day.today }]"
      role="listitem"
      :aria-label="`${day.label}: ${stateLabel[day.state] ?? day.state}`"
    >
      <span class="weekly-path__label">{{ day.label }}</span>
      <span class="weekly-path__node" aria-hidden="true">
        <Check v-if="day.state === 'complete'" :size="14" :stroke-width="2.25" />
        <Leaf v-else-if="day.state === 'adapted'" :size="13" :stroke-width="2" />
        <Minus v-else-if="day.state === 'paused'" :size="13" :stroke-width="2" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.weekly-path {
  display: grid;
  grid-template-columns: repeat(var(--weekly-columns), minmax(36px, 1fr));
  gap: var(--space-1);
  padding-block: var(--space-3);
  border-block: 1px solid color-mix(in srgb, var(--path-color) 14%, var(--color-border));
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;
}

.weekly-path__day {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  min-width: 36px;
}

.weekly-path__label {
  color: var(--color-text-faint);
  font-size: var(--caption-size);
  font-weight: var(--caption-weight);
  line-height: var(--caption-line);
  letter-spacing: var(--caption-track);
}

.weekly-path__node {
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-weight: 700;
}

.weekly-path__day--complete .weekly-path__node {
  border-color: var(--path-color);
  background: color-mix(in srgb, var(--path-color) 18%, var(--color-surface));
  color: var(--path-color);
}

.weekly-path__day--adapted .weekly-path__node {
  border-color: color-mix(in srgb, var(--path-color) 62%, var(--accent-reflect));
  background: color-mix(in srgb, var(--path-color) 10%, var(--color-surface));
  color: color-mix(in srgb, var(--path-color) 62%, var(--accent-reflect));
}

.weekly-path__day--paused .weekly-path__node {
  border-color: var(--progress-paused, var(--color-warning));
  color: var(--progress-paused, var(--color-warning));
}

.weekly-path__day--today .weekly-path__label { color: var(--color-text); }
.weekly-path__day--today .weekly-path__node {
  box-shadow:
    0 0 0 2px var(--color-surface),
    0 0 0 4px color-mix(in srgb, var(--path-color) 58%, var(--color-border-strong));
}

.weekly-path--acknowledge .weekly-path__day--today .weekly-path__node {
  animation: weekly-reconnect 280ms var(--ease-calm);
}

@keyframes weekly-reconnect {
  from { opacity: 0.72; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .weekly-path--acknowledge .weekly-path__day--today .weekly-path__node {
    animation: weekly-reconnect-reduced var(--dur-base) linear;
  }

  @keyframes weekly-reconnect-reduced {
    from { opacity: 0.72; }
    to { opacity: 1; }
  }
}
</style>
