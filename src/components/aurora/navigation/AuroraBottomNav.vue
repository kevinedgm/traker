<script setup>
defineProps({ modelValue: String, items: { default: () => [] } })
defineEmits(['update:modelValue'])
</script>
<template>
  <nav class="nav aurora-glass" aria-label="Navegación principal">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      :class="{ on: modelValue === item.value }"
      :aria-label="item.label"
      :aria-current="modelValue === item.value ? 'page' : undefined"
      @click="$emit('update:modelValue', item.value)"
    >
      <span class="nav__icon" aria-hidden="true">
        <component :is="item.icon" v-if="item.icon" :size="19" :stroke-width="1.75" />
      </span>
      <span class="nav__label">{{ item.shortLabel || item.label }}</span>
    </button>
  </nav>
</template>
<style scoped>
.nav { display:flex; height:var(--nav-height); padding:4px 6px; align-items:center; justify-content:space-around; border-radius:var(--radius-pill); box-shadow:var(--elev-3); }
button { display:flex; min-width:0; max-width:76px; height:56px; padding:2px 3px; flex:1; flex-direction:column; align-items:center; justify-content:center; gap:2px; border:0; border-radius:var(--radius-lg); background:transparent; color:var(--text-muted); cursor:pointer; transition:color var(--dur-fast) var(--ease-calm),background var(--dur-fast) var(--ease-calm),transform var(--dur-instant) var(--ease-calm); }
.nav__icon { display:grid; width:34px; height:28px; place-items:center; border-radius:var(--radius-md); transition:background var(--dur-fast) var(--ease-calm),color var(--dur-fast) var(--ease-calm); }
.nav__label { display:block; overflow:hidden; width:100%; color:inherit; font:600 11px/1.1 var(--font-core); letter-spacing:.005em; text-align:center; text-overflow:ellipsis; white-space:nowrap; }
button:hover { color:var(--text-primary); background:var(--action-secondary-bg); }
button:active { transform:scale(.96); }
button.on { color:var(--text-primary); }
button.on .nav__icon { color:var(--action-primary); background:color-mix(in srgb,var(--action-primary) 14%,transparent); }
button.on .nav__label { font-weight:700; }
@media (max-width:350px) { .nav { padding-inline:4px; } button { padding-inline:1px; } }
</style>
