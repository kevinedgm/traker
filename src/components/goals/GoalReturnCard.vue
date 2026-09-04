<script setup>
import { useId } from 'vue'

defineProps({
  headline: { type: String, default: 'Qué bueno que volviste.' },
  body: { type: String, default: 'No necesitas recuperar todo. Veamos desde dónde tiene sentido continuar.' },
  actionLabel: { type: String, default: 'Elegir por dónde retomar' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['action'])
const titleId = useId()
</script>

<template>
  <section class="goal-return" :aria-labelledby="titleId">
    <h2 :id="titleId" class="goal-return__title">{{ headline }}</h2>
    <p class="goal-return__body">{{ body }}</p>
    <slot />
    <button
      v-if="actionLabel"
      class="goal-return__action"
      type="button"
      :disabled="busy"
      :aria-busy="busy ? 'true' : undefined"
      @click="emit('action')"
    >
      {{ busy ? 'Preparando…' : actionLabel }}
    </button>
  </section>
</template>

<style scoped>
.goal-return {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: var(--pad-card-lg);
  overflow-wrap: break-word;
  border: 1px solid color-mix(in srgb, var(--accent-return) 32%, transparent);
  border-radius: var(--radius-xl);
  background: var(--aurora-return), var(--surface-primary);
  box-shadow: var(--elev-2);
  container-type: inline-size;
}

.goal-return__title {
  margin: 0;
  color: var(--text-primary);
  font: 400 32px/1.18 var(--font-editorial);
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.goal-return__body {
  max-width: 65ch;
  margin: var(--space-3) 0 0;
  color: var(--text-secondary);
  font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core);
  text-wrap: pretty;
}

.goal-return__action {
  min-height: 48px;
  margin-top: var(--space-5);
  padding-inline: 22px;
  border: 0;
  border-radius: var(--radius-pill);
  color: var(--action-primary-fg);
  background: var(--action-primary);
  font: var(--label-weight) var(--label-size)/1 var(--font-core);
  cursor: pointer;
  transition: transform var(--dur-instant) var(--ease-calm), background var(--dur-fast) var(--ease-calm);
}

.goal-return__action:hover:not(:disabled) { background: var(--action-primary-hover); }
.goal-return__action:active:not(:disabled) { transform: scale(var(--press-scale)); }
.goal-return__action:disabled { cursor: not-allowed; opacity: 0.45; }
@container (max-width: 420px) { .goal-return__action { width: 100%; } }
@media (max-width: 520px) { .goal-return { padding: var(--pad-card); } }
</style>
