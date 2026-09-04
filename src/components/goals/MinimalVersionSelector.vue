<script setup>
import { useId } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: undefined },
  options: { type: Array, required: true },
  title: { type: String, default: '¿Qué versión cabe en tu día?' },
})

const emit = defineEmits(['update:modelValue'])
const legendId = useId()

function selectFromKeyboard(event, index) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()

  const last = props.options.length - 1
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? last
      : ['ArrowRight', 'ArrowDown'].includes(event.key)
        ? (index + 1) % props.options.length
        : (index - 1 + props.options.length) % props.options.length

  emit('update:modelValue', props.options[nextIndex].value)
  event.currentTarget.parentElement?.querySelectorAll('[role="radio"]')[nextIndex]?.focus()
}
</script>

<template>
  <fieldset class="minimal-selector">
    <legend :id="legendId">{{ title }}</legend>
    <div class="minimal-selector__options" role="radiogroup" :aria-labelledby="legendId">
      <button
        v-for="(option, index) in options"
        :key="option.value"
        class="minimal-selector__option"
        :class="{ 'is-selected': modelValue === option.value }"
        type="button"
        role="radio"
        :aria-checked="modelValue === option.value"
        :tabindex="modelValue === option.value || (!modelValue && index === 0) ? 0 : -1"
        @click="emit('update:modelValue', option.value)"
        @keydown="selectFromKeyboard($event, index)"
      >
        <span class="minimal-selector__radio" aria-hidden="true"><i /></span>
        <span class="minimal-selector__copy">
          <strong>{{ option.label }}</strong>
          <small v-if="option.detail">{{ option.detail }}</small>
        </span>
      </button>
    </div>
  </fieldset>
</template>

<style scoped>
.minimal-selector { min-width: 0; margin: 0; padding: 0; border: 0; }
.minimal-selector legend { padding: 0; color: var(--text-secondary); font: var(--label-weight) var(--label-size)/var(--label-line) var(--font-core); letter-spacing: var(--label-track); }
.minimal-selector__options { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-3); }
.minimal-selector__option {
  display: flex;
  min-width: 0;
  min-height: 60px;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  text-align: start;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  background: transparent;
  cursor: pointer;
  transition: background var(--dur-base) var(--ease-calm), border-color var(--dur-base) var(--ease-calm), transform var(--dur-instant) var(--ease-calm);
}
.minimal-selector__option.is-selected { border: 1.5px solid var(--border-accent); background: color-mix(in srgb, var(--action-primary) 10%, transparent); }
.minimal-selector__option:active { transform: scale(var(--press-scale)); }
@media (hover: hover) { .minimal-selector__option:not(.is-selected):hover { border-color: var(--border-strong); background: var(--surface-secondary); } }
.minimal-selector__radio { display: grid; width: 20px; height: 20px; flex: none; place-items: center; border: 2px solid var(--border-strong); border-radius: var(--radius-pill); }
.is-selected .minimal-selector__radio { border-color: var(--action-primary); }
.minimal-selector__radio i { display: block; width: 10px; height: 10px; border-radius: var(--radius-pill); background: var(--action-primary); opacity: 0; transform: scale(.45); transition: opacity var(--dur-fast) var(--ease-calm), transform var(--dur-fast) cubic-bezier(.16, 1, .3, 1); }
.is-selected .minimal-selector__radio i { opacity: 1; transform: scale(1); }
.minimal-selector__copy { min-width: 0; overflow-wrap: break-word; hyphens: auto; }
.minimal-selector__copy strong,
.minimal-selector__copy small { display: block; }
.minimal-selector__copy strong { font: var(--title-weight) var(--title-size)/var(--title-line) var(--font-core); letter-spacing: var(--title-track); }
.minimal-selector__copy small { margin-top: var(--space-1); color: var(--text-secondary); font: 400 var(--label-size)/1.4 var(--font-core); }
</style>
