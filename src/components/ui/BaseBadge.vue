<script setup>
defineProps({
  tone: { type: String, default: 'brand' },
})

const toneClass = {
  brand: 'badge',
  neutral: 'badge-neutral',
  danger: 'badge bg-[color-mix(in_srgb,var(--color-danger)_13%,transparent)] text-[--color-danger]',
  warning: 'badge bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-[--color-warning]',
}
</script>

<template>
  <span :class="toneClass[tone] || toneClass.brand">
    <slot />
  </span>
</template>
