<script setup>
import { ArrowLeft } from 'lucide-vue-next'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  backTo: { type: String, default: '' },
  backLabel: { type: String, default: 'Ajustes' },
  wide: { type: Boolean, default: false },
})
</script>

<template>
  <main class="settings-shell" :class="{ 'settings-shell--wide': wide }">
    <nav v-if="backTo" class="settings-shell__nav" aria-label="Navegación de Ajustes">
      <RouterLink :to="backTo">
        <ArrowLeft :size="18" :stroke-width="2" aria-hidden="true" />
        {{ backLabel }}
      </RouterLink>
    </nav>
    <header class="settings-shell__header">
      <div>
        <h1>{{ title }}</h1>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="settings-shell__actions"><slot name="actions" /></div>
    </header>
    <div class="settings-shell__body"><slot /></div>
  </main>
</template>

<style scoped>
.settings-shell { box-sizing:border-box; width:min(100%,45rem); min-height:100svh; margin-inline:auto; padding-block:max(var(--space-5),env(safe-area-inset-top)) var(--nav-clearance); padding-inline-start:max(var(--space-4),env(safe-area-inset-left)); padding-inline-end:max(var(--space-4),env(safe-area-inset-right)); color:var(--text-primary); }
.settings-shell--wide { width:min(100%,68rem); }
.settings-shell__nav { margin-bottom:var(--space-5); }
.settings-shell__nav a { display:inline-flex; min-height:var(--touch-min); align-items:center; gap:var(--space-2); color:var(--text-secondary); font:600 var(--body-small-size)/1.2 var(--font-core); text-decoration:none; }
.settings-shell__header { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--space-5); margin-bottom:var(--space-8); }
.settings-shell__header h1 { margin:0; color:var(--text-primary); font:var(--h1-weight) var(--h1-size)/var(--h1-line) var(--font-core); letter-spacing:var(--h1-track); text-wrap:balance; }
.settings-shell__header p { max-width:62ch; margin:var(--space-2) 0 0; color:var(--text-secondary); font:var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); text-wrap:pretty; }
.settings-shell__actions { flex:none; }
.settings-shell__body { min-width:0; }
.settings-shell__body > :deep(*:first-child) { margin-top:0; }
@media (min-width:640px) { .settings-shell { padding-inline:max(var(--space-8),env(safe-area-inset-left)) max(var(--space-8),env(safe-area-inset-right)); padding-top:max(var(--space-8),env(safe-area-inset-top)); } }
@media (max-width:560px) { .settings-shell__header { align-items:stretch; flex-direction:column; margin-bottom:var(--space-6); } .settings-shell__actions :deep(button),.settings-shell__actions :deep(a) { width:100%; justify-content:center; } }
</style>
