<script setup>
import { computed, useAttrs, useId } from 'vue'
defineOptions({ inheritAttrs: false })
const props = defineProps({
  id: { type: String, default: undefined },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  modelValue: { type: [String, Number], default: '' },
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
const hintId = `${useId()}-hint`
const describedBy = computed(() => [attrs['aria-describedby'], props.hint ? hintId : null].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <label class="block">
    <span v-if="label" class="bi-label mb-2 block">{{ label }}</span>
    <input
      :id="id"
      class="bi-input"
      :value="modelValue"
      v-bind="$attrs"
      :aria-describedby="describedBy"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <span v-if="hint" :id="hintId" class="mt-2 block text-xs text-[--color-text-muted]">{{ hint }}</span>
  </label>
</template>

<style scoped>
.bi-label {
  font-size: var(--label-size);
  font-weight: var(--label-weight);
  line-height: var(--label-line);
  letter-spacing: var(--label-track);
  color: var(--text-secondary);
}

.bi-input {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--background-elevated);
  color: var(--text-primary);
  padding: 0.7rem 0.875rem;
  font: inherit;
  transition: border-color var(--dur-base) var(--ease-calm), box-shadow var(--dur-base) var(--ease-calm);
}

.bi-input::placeholder {
  color: var(--text-muted);
}

.bi-input:hover {
  border-color: var(--border-strong);
}

.bi-input:focus {
  outline: none;
  border-color: var(--action-primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
</style>
