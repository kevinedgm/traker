<script setup>
import { useId } from 'vue'

defineProps({
  title: { type: String, required: true },
  support: { type: String, default: 'Un paso pequeño es suficiente.' },
  primaryLabel: { type: String, default: 'Comenzar' },
  secondaryLabel: { type: String, default: 'Hacerlo más sencillo' },
  busy: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['primary', 'secondary'])
const titleId = useId()
</script>

<template>
  <section class="goal-next-step" :aria-labelledby="titleId">
    <p class="goal-next-step__label">Siguiente paso</p>
    <h2 :id="titleId" class="goal-next-step__title">{{ title }}</h2>
    <p v-if="support" class="goal-next-step__support">{{ support }}</p>

    <div class="goal-next-step__actions">
      <button
        class="goal-next-step__primary"
        type="button"
        :disabled="disabled || busy"
        :aria-busy="busy ? 'true' : undefined"
        @click="emit('primary')"
      >
        {{ busy ? 'Preparando…' : primaryLabel }}
      </button>
      <button
        v-if="secondaryLabel"
        class="goal-next-step__secondary"
        type="button"
        :disabled="disabled || busy"
        @click="emit('secondary')"
      >
        {{ secondaryLabel }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.goal-next-step {
  min-width: 0;
  padding: var(--pad-card-lg);
  overflow-wrap: break-word;
  border: 1px solid var(--border-accent);
  border-radius: var(--radius-xl);
  background: var(--aurora-veil), var(--surface-primary);
  box-shadow: var(--elev-2);
  container-type: inline-size;
}

.goal-next-step__label {
  margin: 0;
  color: var(--action-primary);
  font: var(--caption-weight) var(--caption-size)/var(--caption-line) var(--font-core);
  letter-spacing: var(--caption-track);
  text-transform: uppercase;
}

.goal-next-step__title {
  margin: var(--space-2) 0 var(--space-1);
  color: var(--text-primary);
  font: var(--h3-weight) var(--h3-size)/var(--h3-line) var(--font-core);
  letter-spacing: var(--title-track);
  text-wrap: balance;
}

.goal-next-step__support {
  max-width: 65ch;
  margin: 0 0 var(--space-5);
  color: var(--text-secondary);
  font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core);
  text-wrap: pretty;
}

.goal-next-step__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.goal-next-step__primary,
.goal-next-step__secondary {
  min-height: 48px;
  padding-inline: 20px;
  border-radius: var(--radius-pill);
  font: var(--label-weight) var(--label-size)/1 var(--font-core);
  cursor: pointer;
  transition: transform var(--dur-instant) var(--ease-calm), background var(--dur-fast) var(--ease-calm), border-color var(--dur-fast) var(--ease-calm);
}

.goal-next-step__primary {
  flex: 1 1 12rem;
  border: 0;
  color: var(--action-primary-fg);
  background: var(--action-primary);
}

.goal-next-step__primary:hover:not(:disabled) { background: var(--action-primary-hover); }
.goal-next-step__primary:active:not(:disabled),
.goal-next-step__secondary:active:not(:disabled) { transform: scale(var(--press-scale)); }

.goal-next-step__secondary {
  flex: 0 1 auto;
  border: 1px solid var(--border-subtle);
  color: var(--action-secondary-fg);
  background: var(--action-secondary-bg);
}

@media (hover: hover) { .goal-next-step__secondary:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface-secondary); } }

.goal-next-step__primary:disabled,
.goal-next-step__secondary:disabled { cursor: not-allowed; opacity: 0.45; }
@container (max-width: 420px) { .goal-next-step__actions { flex-direction: column; } .goal-next-step__primary, .goal-next-step__secondary { width: 100%; flex-basis: auto; } }
@media (max-width: 520px) { .goal-next-step { padding: var(--pad-card); } }
</style>
