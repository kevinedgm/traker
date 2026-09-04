<script setup>
import { computed, useId } from 'vue'
import { BarChart3, Cloud, CloudOff, ShieldCheck } from 'lucide-vue-next'
import { EVENT_FALLBACKS } from '@/features/copy/catalog.js'

const props = defineProps({
  syncEnabled: { type: Boolean, default: false },
  analyticsEnabled: { type: Boolean, default: false },
  authenticated: { type: Boolean, default: false },
  online: { type: Boolean, default: true },
  syncGrantedAt: { type: String, default: null },
  syncStatus: { type: String, default: 'local' },
  pendingCount: { type: Number, default: 0 },
  conflictCount: { type: Number, default: 0 },
  lastSyncedAt: { type: String, default: null },
})
const emit = defineEmits(['toggle-sync', 'toggle-analytics', 'connect', 'retry'])
const titleId = useId()

function changesLabel(count) {
  return `${count} ${count === 1 ? 'cambio' : 'cambios'}`
}

const status = computed(() => {
  if (!props.syncEnabled) return { label: 'Solo en este dispositivo', detail: 'Tus datos permanecen guardados localmente.', icon: CloudOff, tone: 'neutral' }
  if (!props.authenticated) return { label: 'Falta conectar una cuenta', detail: 'Nada se enviará hasta que conectes una cuenta.', icon: CloudOff, tone: 'neutral' }
  if (!props.online || props.syncStatus === 'offline') return { label: `Sin conexión · ${changesLabel(props.pendingCount)} guardados`, detail: 'Puedes continuar. Se sincronizarán cuando vuelva la conexión.', icon: CloudOff, tone: 'offline' }
  if (props.syncStatus === 'syncing') return { label: `Sincronizando ${changesLabel(props.pendingCount)}…`, detail: 'La copia local permanece disponible durante el proceso.', icon: Cloud, tone: 'syncing' }
  if (props.syncStatus === 'conflict') return { label: `${changesLabel(props.conflictCount)} necesitan revisión`, detail: 'La versión local sigue segura. Reintentar no borra tus datos del dispositivo.', icon: CloudOff, tone: 'attention', action: 'Reintentar con seguridad' }
  if (props.syncStatus === 'error') return { label: `${changesLabel(props.pendingCount)} pendientes`, detail: EVENT_FALLBACKS.sync_error.text, icon: CloudOff, tone: 'attention', action: 'Reintentar' }
  return { label: 'Todo está sincronizado', detail: 'Tus datos locales y la nube están al día.', icon: Cloud, tone: 'synced' }
})

function grantedLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
function syncedLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}
</script>

<template>
  <section class="privacy-panel" :aria-labelledby="titleId">
    <header><ShieldCheck :size="24" aria-hidden="true" /><div><h2 :id="titleId">Privacidad y nube</h2><p>El almacenamiento local funciona sin cuenta ni consentimiento adicional.</p></div></header>

    <Transition name="status-shift" mode="out-in">
      <div :key="`${status.tone}-${status.label}`" class="privacy-panel__status" :class="`is-${status.tone}`" role="status">
        <component :is="status.icon" :size="18" aria-hidden="true" />
        <span><strong>{{ status.label }}</strong><small>{{ status.detail }}</small><small v-if="syncStatus === 'synced' && lastSyncedAt">Última sincronización: {{ syncedLabel(lastSyncedAt) }}</small></span>
        <button v-if="status.action" type="button" @click="emit('retry')">{{ status.action }}</button>
      </div>
    </Transition>

    <div class="privacy-panel__choice">
      <Cloud :size="20" aria-hidden="true" />
      <div><strong>Sincronizar datos funcionales</strong><p>Metas, definiciones, motivos, acciones, sesiones y notas se guardarán en tu cuenta para usarlos entre dispositivos.</p><small v-if="syncEnabled && syncGrantedAt">Consentimiento v1 · {{ grantedLabel(syncGrantedAt) }}</small></div>
      <button type="button" role="switch" :aria-checked="syncEnabled" :aria-label="syncEnabled ? 'Desactivar sincronización de Metas' : 'Activar sincronización de Metas'" :class="{ 'is-on': syncEnabled }" @click="emit('toggle-sync')"><span class="privacy-panel__track"><i /></span></button>
    </div>

    <button v-if="syncEnabled && !authenticated" class="privacy-panel__connect" type="button" @click="emit('connect')">Conectar una cuenta</button>

    <div class="privacy-panel__choice">
      <BarChart3 :size="20" aria-hidden="true" />
      <div><strong>Analítica de producto</strong><p>Comparte tipos de evento, rangos de duración y errores. Nunca títulos, motivos, notas, bloqueos ni evidencias.</p></div>
      <button type="button" role="switch" :aria-checked="analyticsEnabled" :aria-label="analyticsEnabled ? 'Desactivar analítica de Metas' : 'Activar analítica de Metas'" :class="{ 'is-on': analyticsEnabled }" @click="emit('toggle-analytics')"><span class="privacy-panel__track"><i /></span></button>
    </div>
  </section>
</template>

<style scoped>
.privacy-panel { width: min(100%, var(--content-max)); box-sizing: border-box; margin: var(--section-gap-desktop) auto 0; padding-top: var(--section-gap-mobile); border-top: 1px solid var(--border-subtle); }
.privacy-panel header { display: flex; gap: var(--space-3); }
.privacy-panel header > svg { flex: none; color: var(--action-primary); }
.privacy-panel h2 { margin: 0; color: var(--text-primary); font: var(--h1-weight) var(--h1-size)/var(--h1-line) var(--font-core); letter-spacing: var(--h1-track); }
.privacy-panel header p { max-width: 65ch; margin: 8px 0 0; color: var(--text-secondary); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); }
.privacy-panel__status { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; min-height: 48px; margin: var(--space-5) 0 var(--space-2); align-items: center; gap: var(--space-3); color: var(--text-secondary); }
.privacy-panel__status > svg { color: var(--text-muted); }
.privacy-panel__status.is-attention > svg { color: var(--status-warning); }
.privacy-panel__status.is-synced > svg { color: var(--action-primary); }
.privacy-panel__status span { display: grid; min-width: 0; gap: 3px; }
.privacy-panel__status strong { color: var(--text-primary); font: var(--label-weight) var(--label-size)/1.3 var(--font-core); }
.privacy-panel__status small { color: var(--text-muted); font: 400 var(--label-size)/1.4 var(--font-core); }
.privacy-panel__status button { min-height: 44px; padding-inline: 14px; border: 1px solid var(--border-strong); border-radius: var(--radius-pill); color: var(--text-primary); background: transparent; font: var(--label-weight) var(--label-size)/1 var(--font-core); cursor: pointer; transition: transform var(--dur-instant) var(--ease-calm), background var(--dur-fast) var(--ease-calm); }
.privacy-panel__choice { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--space-3); padding-block: var(--space-5); border-bottom: 1px solid var(--border-subtle); }
.privacy-panel__choice > svg { margin-top: 2px; color: var(--text-muted); }
.privacy-panel__choice strong { color: var(--text-primary); font: var(--title-weight) var(--title-size)/var(--title-line) var(--font-core); letter-spacing: var(--title-track); }
.privacy-panel__choice p { max-width: 65ch; margin: 5px 0 0; color: var(--text-secondary); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); }
.privacy-panel__choice small { display: block; margin-top: 7px; color: var(--text-muted); font: 400 var(--label-size)/1.4 var(--font-core); }
.privacy-panel__choice button { display: grid; width: 52px; min-height: 44px; place-items: center; padding: 0; border: 0; background: transparent; cursor: pointer; }
.privacy-panel__track { position: relative; display: block; width: 46px; height: 26px; border: 1px solid var(--border-strong); border-radius: var(--radius-pill); background: var(--surface-secondary); transition: border-color var(--dur-fast) var(--ease-calm), background var(--dur-base) var(--ease-calm); }
.privacy-panel__track i { position: absolute; top: 4px; inset-inline-start: 4px; width: 16px; height: 16px; border-radius: var(--radius-pill); background: var(--text-muted); transition: transform var(--dur-base) var(--ease-calm), background var(--dur-base) var(--ease-calm); }
.privacy-panel__choice button.is-on .privacy-panel__track { border-color: var(--border-accent); background: color-mix(in srgb, var(--action-primary) 14%, transparent); }
.privacy-panel__choice button.is-on .privacy-panel__track i { background: var(--action-primary); transform: translateX(20px); }
:global([dir='rtl']) .privacy-panel__choice button.is-on .privacy-panel__track i { transform: translateX(-20px); }
.privacy-panel__connect { min-height: 44px; margin: var(--space-2) 0 var(--space-1) 32px; padding-inline: var(--space-4); border: 0; border-radius: var(--radius-pill); color: var(--action-primary-fg); background: var(--action-primary); font: var(--label-weight) var(--label-size)/1 var(--font-core); cursor: pointer; transition: transform var(--dur-instant) var(--ease-calm), background var(--dur-fast) var(--ease-calm); }
.privacy-panel__status button:active, .privacy-panel__connect:active { transform: scale(var(--press-scale)); }
@media (hover: hover) {
  .privacy-panel__status button:hover { background: var(--surface-secondary); }
  .privacy-panel__choice button:hover .privacy-panel__track { border-color: var(--border-accent); }
  .privacy-panel__connect:hover { background: var(--action-primary-hover); }
}
.status-shift-enter-active { transition: opacity var(--dur-base) var(--ease-calm), filter var(--dur-base) var(--ease-calm); }
.status-shift-leave-active { transition: opacity var(--dur-fast) var(--ease-calm), filter var(--dur-fast) var(--ease-calm); }
.status-shift-enter-from, .status-shift-leave-to { opacity: 0; filter: blur(3px); }
@media (min-width: 720px) { .privacy-panel { padding-top: var(--section-gap-desktop); } }
@media (max-width: 500px) { .privacy-panel__status { grid-template-columns: auto minmax(0, 1fr); } .privacy-panel__status button { grid-column: 1 / -1; width: 100%; } .privacy-panel__choice { grid-template-columns: auto minmax(0, 1fr); } .privacy-panel__choice button { grid-column: 2; justify-self: start; } .privacy-panel__connect { width: calc(100% - 32px); } }
@media (prefers-reduced-motion: reduce) { .privacy-panel__track i { transition-duration: 1ms; } .status-shift-enter-active, .status-shift-leave-active { transition-property: opacity; } .status-shift-enter-from, .status-shift-leave-to { filter: none; } }
</style>
