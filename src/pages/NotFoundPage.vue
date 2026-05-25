<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center text-center p-6">
    <p class="text-6xl font-bold" style="color: var(--color-brand)">404</p>
    <h1 class="mt-4 text-2xl font-semibold text-[--color-text]">Página no encontrada</h1>
    <p class="mt-2 text-[--color-text-muted]">La página que buscas no existe o fue movida.</p>
    <RouterLink to="/" class="btn-primary mt-6">Volver al inicio</RouterLink>
  </div>
</template>
