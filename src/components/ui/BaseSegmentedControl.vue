<script setup>
defineProps({
  items: { type: Array, required: true },
  modelValue: { type: [String, Number, Boolean], default: undefined },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="bsc-segmented" role="tablist">
    <button
      v-for="item in items"
      :key="item.value"
      class="bsc-item"
      type="button"
      role="tab"
      :aria-selected="modelValue === item.value"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.bsc-segmented {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-pill);
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
}

.bsc-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--body-small-size);
  font-weight: 600;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease-calm), color var(--dur-base) var(--ease-calm), box-shadow var(--dur-base) var(--ease-calm);
}

.bsc-item[aria-selected='true'] {
  background: var(--surface-primary);
  color: var(--action-primary);
  box-shadow: var(--elev-1);
}
</style>
