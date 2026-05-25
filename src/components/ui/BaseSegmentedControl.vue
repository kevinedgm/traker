<script setup>
defineProps({
  items: { type: Array, required: true },
  modelValue: { type: [String, Number, Boolean], default: undefined },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="segmented" role="tablist">
    <button
      v-for="item in items"
      :key="item.value"
      class="segmented-item"
      type="button"
      role="tab"
      :aria-selected="modelValue === item.value"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
