<script setup>
defineProps({
  interactive: { type: Boolean, default: false },
  elevated: { type: Boolean, default: false },
  padding: { type: String, default: 'md' },
})

const paddingClass = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}
</script>

<template>
  <section
    :class="[
      interactive ? 'card-interactive' : elevated ? 'card-elevated' : 'card',
      paddingClass[padding] || paddingClass.md,
    ]"
  >
    <slot />
  </section>
</template>
