<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center text-center p-6">
    <p class="text-6xl font-bold" style="color: var(--color-brand)">404</p>
    <h1 class="mt-4 text-2xl font-semibold text-[--color-text]">Página no encontrada</h1>
    <p class="mt-2 text-[--color-text-muted]">La página que buscas no existe o fue movida.</p>
    <RouterLink to="/" class="nf-cta mt-6">Volver al inicio</RouterLink>
  </div>
</template>

<style scoped>
.nf-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 22px;
  border-radius: var(--radius-pill);
  background: var(--action-primary);
  color: var(--action-primary-fg);
  font-size: var(--label-size);
  font-weight: var(--label-weight);
  letter-spacing: var(--label-track);
  text-decoration: none;
  transition: background-color var(--dur-base) var(--ease-calm);
}

.nf-cta:hover {
  background: var(--action-primary-hover);
}

.nf-cta:active {
  transform: scale(var(--press-scale));
}
</style>
