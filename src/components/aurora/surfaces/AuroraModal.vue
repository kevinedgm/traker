<script setup>
import { computed, ref, useId } from 'vue'
import { useModalFocus } from '@/composables/useModalFocus'
const p = defineProps({ open: Boolean, title: String, width: { default: 420 }, alert: Boolean, sheet: Boolean })
const e = defineEmits(['close'])
const dialog = ref(null)
const titleId = useId()
const descriptionId = useId()
useModalFocus(dialog, { enabled: computed(() => p.open), initialFocus: '[data-modal-initial-focus]', onClose: () => e('close') })
</script>
<template>
  <Teleport to="body">
    <div v-if="open" class="a-overlay" :class="{ 'a-sheet': sheet }">
      <button class="a-overlay__scrim" aria-label="Cerrar" @click="$emit('close')" />
      <section
        ref="dialog"
        class="a-modal"
        :role="alert ? 'alertdialog' : 'dialog'"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        :aria-describedby="descriptionId"
        :style="{ maxWidth: `${width}px` }"
        tabindex="-1"
      >
        <h2 v-if="title" :id="titleId">{{ title }}</h2>
        <div :id="descriptionId" class="a-modal__content"><slot /></div>
        <footer v-if="$slots.footer"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.a-overlay{position:fixed;z-index:80;inset:0;display:grid;place-items:center;padding:20px}
.a-overlay__scrim{position:absolute;inset:0;border:0;background:color-mix(in srgb,var(--background-base) 70%,transparent);backdrop-filter:blur(3px)}
.a-modal{position:relative;box-sizing:border-box;width:100%;max-height:calc(100svh - 40px);overflow:auto;padding:24px;border:1px solid var(--border-subtle);border-radius:var(--radius-2xl);background:var(--surface-secondary);box-shadow:var(--elev-4)}
h2{margin:0 0 10px;color:var(--text-primary);font:600 20px/1.3 var(--font-core)}
footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
@media (max-width:420px), (max-height:480px) {
  .a-overlay{align-items:end;padding:12px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
  .a-modal{max-height:calc(100svh - 24px);padding:20px;border-radius:var(--radius-xl)}
  footer{flex-direction:column;gap:8px}
  footer :deep(.a-button){width:100%}
}
</style>
