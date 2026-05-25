<script setup>
const props = defineProps({
  as: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
})

const variantClass = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const sizeClass = {
  sm: 'min-h-9 px-3 text-xs',
  md: '',
  lg: 'min-h-12 px-5 text-[15px]',
}
</script>

<template>
  <component
    :is="props.as"
    :class="[variantClass[variant] || variantClass.primary, sizeClass[size] || sizeClass.md]"
    :disabled="props.as === 'button' ? disabled : undefined"
    :aria-disabled="disabled ? 'true' : undefined"
  >
    <slot />
  </component>
</template>
