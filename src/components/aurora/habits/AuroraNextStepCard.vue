<script setup>
defineProps({ eyebrow: { default: 'Siguiente paso' }, title: { required: true }, support: String, primaryLabel: { default: 'Hecho' }, secondaryLabel: { default: 'Adaptar' }, breathing: { default: true } })
defineEmits(['primary', 'secondary'])
</script>
<template>
  <section class="next" :class="{ 'aurora-breathe': breathing }">
    <p>{{ eyebrow }}</p><h2>{{ title }}</h2><span v-if="support">{{ support }}</span>
    <div><button class="primary" @click="$emit('primary')">{{ primaryLabel }}</button><button v-if="secondaryLabel" @click="$emit('secondary')">{{ secondaryLabel }}</button></div>
  </section>
</template>
<style scoped>
.next{padding:var(--pad-card-lg);border:1px solid var(--border-accent);border-radius:var(--radius-xl);background:var(--aurora-veil),var(--surface-primary);box-shadow:var(--elev-2)}p{margin:0;color:var(--action-primary);font:600 12px var(--font-core);letter-spacing:.06em;text-transform:uppercase}h2{margin:8px 0 4px;color:var(--text-primary);font:600 20px/1.3 var(--font-core);letter-spacing:-.015em}.next>span{display:block;margin:0 0 16px;color:var(--text-secondary);font:400 14px/1.5 var(--font-core)}.next>div{display:flex;gap:10px}.next button{min-height:48px;padding:0 18px;border:1px solid color-mix(in srgb,var(--state-adapted-fg) 34%,transparent);border-radius:var(--radius-pill);background:var(--state-adapted-bg);color:var(--state-adapted-fg);font:600 15px var(--font-core);cursor:pointer}.next .primary{flex:1;border:0;background:var(--action-primary);color:var(--action-primary-fg)}
</style>
