<script setup>
import { useId } from 'vue'

const LEVELS = Object.freeze([
  { value: 'low', label: 'Mínimo', help: 'Lo más pequeño que cuenta', tone: 'focus', bars: 1 },
  { value: 'medium', label: 'Habitual', help: 'Tu versión de siempre', tone: 'primary', bars: 2 },
  { value: 'high', label: 'De sobra', help: 'Hoy salió más', tone: 'reflect', bars: 3 },
])

defineProps({
  modelValue: { type: String, default: 'medium' },
  label: { type: String, default: 'Esfuerzo de hoy' },
})

const emit = defineEmits(['update:modelValue'])
const legendId = useId()

function selectFromKeyboard(event, index) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()

  const last = LEVELS.length - 1
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? last
      : ['ArrowRight', 'ArrowDown'].includes(event.key)
        ? (index + 1) % LEVELS.length
        : (index - 1 + LEVELS.length) % LEVELS.length

  emit('update:modelValue', LEVELS[nextIndex].value)
  event.currentTarget.parentElement?.querySelectorAll('[role="radio"]')[nextIndex]?.focus()
}
</script>

<template>
  <fieldset class="effort-selector">
    <legend :id="legendId">{{ label }}</legend>
    <div class="effort-selector__options" role="radiogroup" :aria-labelledby="legendId">
      <button
        v-for="(level, index) in LEVELS"
        :key="level.value"
        class="effort-selector__option"
        :class="[`effort-selector__option--${level.tone}`, { 'is-selected': modelValue === level.value }]"
        type="button"
        role="radio"
        :aria-checked="modelValue === level.value"
        :tabindex="modelValue === level.value || (!modelValue && index === 0) ? 0 : -1"
        @click="emit('update:modelValue', level.value)"
        @keydown="selectFromKeyboard($event, index)"
      >
        <span class="effort-selector__bars" aria-hidden="true">
          <i v-for="bar in 3" :key="bar" :class="{ 'is-filled': bar <= level.bars }" />
        </span>
        <strong>{{ level.label }}</strong>
        <small>{{ level.help }}</small>
      </button>
    </div>
  </fieldset>
</template>

<style scoped>
.effort-selector { min-width: 0; margin: 0; padding: 0; border: 0; container-type: inline-size; }
.effort-selector legend { padding: 0; color: var(--text-secondary); font: var(--label-weight) var(--label-size)/var(--label-line) var(--font-core); letter-spacing: var(--label-track); }
.effort-selector__options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin-top: var(--space-3); }
.effort-selector__option {
  --level-color: var(--action-primary);
  display: flex;
  min-width: 0;
  min-height: 80px;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  overflow-wrap: break-word;
  text-align: start;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  background: transparent;
  cursor: pointer;
  transition: background var(--dur-base) var(--ease-calm), border-color var(--dur-base) var(--ease-calm), transform var(--dur-instant) var(--ease-calm);
}
.effort-selector__option--focus { --level-color: var(--accent-focus); }
.effort-selector__option--reflect { --level-color: var(--accent-reflect); }
.effort-selector__option.is-selected { border-color: color-mix(in srgb, var(--level-color) 55%, transparent); background: color-mix(in srgb, var(--level-color) 12%, transparent); }
.effort-selector__option:active { transform: scale(var(--press-scale)); }
@media (hover: hover) { .effort-selector__option:not(.is-selected):hover { border-color: var(--border-strong); background: var(--surface-secondary); } }
.effort-selector__option strong { font: var(--title-weight) var(--title-size)/var(--title-line) var(--font-core); letter-spacing: var(--title-track); }
.effort-selector__option small { color: var(--text-secondary); font: 400 var(--label-size)/1.4 var(--font-core); }
.effort-selector__bars { display: flex; height: 14px; align-items: end; gap: 3px; }
.effort-selector__bars i { width: 5px; border-radius: var(--radius-xs); background: var(--progress-none); transform: scaleY(.58); transform-origin: bottom; transition: background var(--dur-fast) var(--ease-calm), transform var(--dur-fast) cubic-bezier(.16, 1, .3, 1); }
.effort-selector__bars i:nth-child(1) { height: 5px; }
.effort-selector__bars i:nth-child(2) { height: 9px; }
.effort-selector__bars i:nth-child(3) { height: 13px; }
.effort-selector__bars i.is-filled { background: var(--level-color); transform: scaleY(1); }
@media (prefers-reduced-motion: no-preference) {
  .effort-selector__option.is-selected .effort-selector__bars i.is-filled { animation: effort-bar-settle 220ms cubic-bezier(.16, 1, .3, 1) both; }
  .effort-selector__option.is-selected .effort-selector__bars i:nth-child(2) { animation-delay: 35ms; }
  .effort-selector__option.is-selected .effort-selector__bars i:nth-child(3) { animation-delay: 70ms; }
}
@keyframes effort-bar-settle { from { opacity: .45; transform: scaleY(.35); } to { opacity: 1; transform: scaleY(1); } }
@container (max-width: 460px) { .effort-selector__options { grid-template-columns: 1fr; } .effort-selector__option { min-height: 64px; } }
</style>
