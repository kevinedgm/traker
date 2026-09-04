<script setup>defineProps({ tone: { default: 'var(--action-primary)' }, size: { default: 44 } })</script>
<template><span class="habit-icon" :style="{ '--tone': tone, width: `${size}px`, height: `${size}px`, borderRadius: size <= 32 ? 'var(--radius-sm)' : '14px' }"><slot /></span></template>
<style scoped>.habit-icon{display:grid;flex:none;place-items:center;background:color-mix(in srgb,var(--tone) 14%,transparent);color:var(--tone)}</style>
