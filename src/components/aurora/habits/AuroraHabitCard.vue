<script setup>
import { computed } from 'vue'
import AuroraHabitIcon from './AuroraHabitIcon.vue'
import AuroraQuickLog from './AuroraQuickLog.vue'

const props = defineProps({
  name: { required: true },
  detail: String,
  meta: String,
  goalLabel: String,
  tone: { default: 'var(--action-primary)' },
  state: { default: 'pending' },
  variant: { default: 'row' },
})
defineEmits(['log', 'open'])
const actionLabel = computed(() => `${props.state === 'paused' ? 'Retomar' : 'Registrar'} ${props.name}`)
</script>

<template>
  <div class="habit" :class="[`habit--${variant}`, `habit--${state}`]">
    <AuroraHabitIcon v-if="$slots.icon" :tone="tone"><slot name="icon" /></AuroraHabitIcon>
    <button class="habit__copy" type="button" @click="$emit('open')">
      <span class="habit__name">{{ name }}</span>
      <span v-if="detail" class="habit__detail">{{ detail }}</span>
      <span v-if="meta" class="habit__meta">{{ meta }}</span>
      <slot name="meta" />
    </button>
    <AuroraQuickLog :state="state" :label="actionLabel" @log="$emit('log')" />
  </div>
</template>

<style scoped>
.habit{display:flex;align-items:center;gap:14px;padding:14px 4px;border:0;border-bottom:1px solid var(--border-subtle);border-radius:0;background:transparent;transition:border-color var(--dur-fast) var(--ease-calm)}
.habit--card{padding:var(--pad-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:var(--surface-primary);box-shadow:var(--elev-2)}
.habit--card:hover{border-color:var(--border-accent)}
.habit__copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px;padding:0;border:0;background:none;text-align:left;cursor:pointer}
.habit__name{overflow:hidden;color:var(--text-primary);font:600 16px/1.35 var(--font-core);text-overflow:ellipsis;white-space:nowrap}
.habit__detail{color:var(--text-secondary);font:400 13px/1.4 var(--font-core)}
.habit--paused .habit__detail{color:var(--progress-paused)}
.habit__meta{color:var(--text-muted);font:400 12px/1.4 var(--font-core);font-variant-numeric:tabular-nums}
</style>
