<script setup>
/**
 * ToastHost — mounts once (see App.vue) and renders the front-most toast
 * from the shared queue in useToast.js. Replaces the ad-hoc `ref` +
 * `setTimeout` toast markup that used to live in individual pages.
 */
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'
import { AuroraToast } from '@components/aurora/index.js'

const { queue, dismiss, action } = useToast()
const current = computed(() => queue[0] ?? null)
</script>

<template>
  <Teleport to="body">
    <Transition name="toast-host">
      <div v-if="current" :key="current.id" class="toast-host">
        <AuroraToast
          :tone="current.tone"
          :message="current.message"
          :action-label="current.actionLabel"
          @action="action(current.id)"
          @close="dismiss(current.id)"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  z-index: 1100;
  right: 16px;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 16px;
  max-width: 480px;
  margin-inline: auto;
}

.toast-host-enter-active {
  transition: transform var(--dur-panel, 320ms) var(--ease-enter, ease),
              opacity var(--dur-view, 240ms) var(--ease-calm, ease),
              filter var(--dur-view, 240ms) var(--ease-calm, ease);
}
.toast-host-leave-active {
  transition: transform var(--dur-fast, 160ms) var(--ease-exit, ease),
              opacity var(--dur-fast, 160ms) var(--ease-exit, ease);
}
.toast-host-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(12px) scale(0.98);
}
.toast-host-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (min-width: 1200px) {
  .toast-host { right: 32px; bottom: 24px; left: 176px; }
}

@media (prefers-reduced-motion: reduce) {
  .toast-host-enter-from,
  .toast-host-leave-to { filter: none; transform: none; }
}
</style>
