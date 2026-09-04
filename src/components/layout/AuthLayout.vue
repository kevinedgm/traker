<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="aurora-ambient min-h-screen bg-[--color-bg] flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <RouterView />
    </div>
  </div>
</template>
