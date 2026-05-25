<script setup>
defineProps({
  id: { type: String, default: undefined },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  modelValue: { type: [String, Number], default: '' },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="block">
    <span v-if="label" class="ds-label mb-2 block">{{ label }}</span>
    <input
      :id="id"
      class="input"
      :value="modelValue"
      v-bind="$attrs"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <span v-if="hint" class="mt-2 block text-xs text-[--color-text-muted]">{{ hint }}</span>
  </label>
</template>
