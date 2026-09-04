<script setup>
defineProps({ title: { type: String, required: true }, eyebrow: String, back: Boolean, large: Boolean })
defineEmits(['back'])
</script>
<template>
  <header class="top" :class="{ large }">
    <div class="top__lead">
      <button v-if="back" type="button" aria-label="Volver" @click="$emit('back')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div class="top__copy"><span v-if="eyebrow">{{ eyebrow }}</span><h1>{{ title }}</h1></div>
    </div>
    <aside><slot name="actions" /></aside>
  </header>
</template>
<style scoped>
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:var(--topbar-height);padding-top:var(--safe-top)}.top.large{align-items:flex-end}.top__lead{display:flex;align-items:center;gap:10px;min-width:0}.top button{width:44px;height:44px;display:grid;flex:none;place-items:center;border:1px solid var(--border-subtle);border-radius:var(--radius-pill);background:transparent;color:var(--text-secondary);cursor:pointer}.top__copy{display:flex;min-width:0;flex-direction:column;gap:2px}.top span{color:var(--text-muted);font:600 12px var(--font-core);letter-spacing:.06em;text-transform:uppercase}.top h1{min-width:0;margin:0;overflow-wrap:anywhere;color:var(--text-primary);font:600 20px/1.3 var(--font-core);letter-spacing:-.012em;text-wrap:pretty}.top.large h1{font-size:32px;line-height:1.12;letter-spacing:-.022em}aside{display:flex;flex:none;gap:8px}
</style>
