<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { ThumbsDown, ThumbsUp, X } from 'lucide-vue-next'
import { useCopy } from '@/composables/useCopy'

const current = ref(null)
const feedbackSent = ref(false)
const { recordPhraseFeedback } = useCopy()
const logoUrl = `${import.meta.env.BASE_URL}brand/koto-logo.svg`
let dismissTimer = null

function close() {
  current.value = null
  window.clearTimeout(dismissTimer)
}

function receive(event) {
  window.clearTimeout(dismissTimer)
  current.value = {
    title: event.detail?.title || 'Traker',
    body: event.detail?.body || '',
    phraseId: event.detail?.phraseId || null,
  }
  feedbackSent.value = false
  dismissTimer = window.setTimeout(close, 7000)
}

function sendFeedback(verdict) {
  if (!current.value?.phraseId || feedbackSent.value) return
  recordPhraseFeedback(current.value.phraseId, verdict)
  feedbackSent.value = true
  window.clearTimeout(dismissTimer)
  dismissTimer = window.setTimeout(close, 3000)
}

onMounted(() => window.addEventListener('traker:notification', receive))
onUnmounted(() => {
  window.removeEventListener('traker:notification', receive)
  window.clearTimeout(dismissTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="notification-banner">
      <aside v-if="current" class="notification-banner aurora-glass" role="status" aria-live="polite">
        <span class="notification-banner__mark"><img :src="logoUrl" alt="" width="27" height="23" /></span>
        <div class="notification-banner__copy">
          <span>Traker · ahora</span>
          <strong>{{ current.title }}</strong>
          <p v-if="current.body">{{ current.body }}</p>
          <div v-if="current.phraseId && !feedbackSent" class="notification-banner__feedback" aria-label="Opinión sobre este mensaje">
            <button type="button" @click="sendFeedback('helpful')"><ThumbsUp :size="14" aria-hidden="true" /> Me sirvió</button>
            <button type="button" @click="sendFeedback('not_helpful')"><ThumbsDown :size="14" aria-hidden="true" /> No me sirvió</button>
          </div>
          <small v-else-if="feedbackSent" class="notification-banner__feedback-status" role="status">Respuesta guardada sólo en este dispositivo.</small>
        </div>
        <button type="button" aria-label="Cerrar" @click="close"><X :size="16" :stroke-width="1.75" /></button>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* impeccable-disable design-system-radius -- el radio de 10px corresponde al logotipo de 34px del Notifications.html aprobado */
.notification-banner {
  position: fixed;
  z-index: 1200;
  top: max(14px, env(safe-area-inset-top));
  left: 10px;
  right: 10px;
  display: flex;
  max-width: 620px;
  box-sizing: border-box;
  align-items: flex-start;
  gap: 12px;
  margin-inline: auto;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  box-shadow: var(--elev-4);
}
.notification-banner__mark { display:grid; width:34px; height:34px; flex:none; place-items:center; border-radius:10px; background:#f7f8fc; }
.notification-banner__mark img { display:block; width:27px; height:auto; }
.notification-banner__copy { display: grid; min-width: 0; flex: 1; gap: 2px; }
.notification-banner__copy > span { color: var(--text-muted); font: 600 11px/1 var(--font-core); letter-spacing: .06em; text-transform: uppercase; }
.notification-banner__copy > strong { color: var(--text-primary); font: 600 14px/1.3 var(--font-core); overflow-wrap: anywhere; }
.notification-banner__copy > p { margin: 0; color: var(--text-secondary); font: 400 13px/1.45 var(--font-core); text-wrap: pretty; }
.notification-banner__feedback { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 5px; }
.notification-banner__feedback button { display: inline-flex; min-height: 32px; align-items: center; gap: 5px; padding: 0; border: 0; color: var(--text-muted); background: transparent; font: 600 12px/1 var(--font-core); cursor: pointer; }
.notification-banner__feedback button:hover { color: var(--text-primary); }
.notification-banner__feedback-status { margin-top: 4px; color: var(--text-muted); font: 500 12px/1.35 var(--font-core); }
.notification-banner > button { display: grid; width: 32px; height: 32px; flex: none; padding: 0; place-items: center; border: 0; border-radius: var(--radius-pill); color: var(--text-muted); background: transparent; cursor: pointer; }
.notification-banner > button:hover { color: var(--text-primary); background: var(--action-secondary-bg); }
.notification-banner-enter-active { transition: opacity 320ms var(--ease-enter), transform 320ms var(--ease-enter); }
.notification-banner-leave-active { transition: opacity var(--dur-fast) var(--ease-calm), transform var(--dur-fast) var(--ease-calm); }
.notification-banner-enter-from,
.notification-banner-leave-to { opacity: 0; transform: translateY(-16px) scale(.97); }
@media (prefers-reduced-motion: reduce) {
  .notification-banner-enter-active,
  .notification-banner-leave-active { transition: opacity var(--dur-fast) linear; }
  .notification-banner-enter-from,
  .notification-banner-leave-to { transform: none; }
}
</style>
