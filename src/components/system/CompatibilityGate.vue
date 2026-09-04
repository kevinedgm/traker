<script setup>
import { RefreshCw, ShieldCheck } from 'lucide-vue-next'

defineProps({
  storedVersion: { type: Number, required: true },
  supportedVersion: { type: Number, required: true },
})

defineEmits(['refresh'])
</script>

<template>
  <main class="compatibility-gate">
    <section class="compatibility-gate__panel" aria-labelledby="compatibility-title">
      <span class="compatibility-gate__icon" aria-hidden="true">
        <ShieldCheck :size="28" :stroke-width="1.7" />
      </span>
      <div class="compatibility-gate__copy">
        <h1 id="compatibility-title">Actualización necesaria</h1>
        <p>
          Tus datos pertenecen a una versión más nueva de Traker. Esta copia se
          detuvo antes de modificarlos.
        </p>
        <p class="compatibility-gate__detail">
          Contrato guardado v{{ storedVersion }} · Esta copia admite hasta v{{ supportedVersion }}
        </p>
      </div>
      <button type="button" @click="$emit('refresh')">
        <RefreshCw :size="18" aria-hidden="true" />
        Actualizar Traker
      </button>
      <p class="compatibility-gate__help">
        Si el aviso continúa, cierra Traker por completo y vuelve a abrirlo con conexión.
      </p>
    </section>
  </main>
</template>

<style scoped>
.compatibility-gate{box-sizing:border-box;display:grid;min-height:100svh;padding:max(24px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));place-items:center;color:var(--text-primary);background:var(--background-base)}
.compatibility-gate__panel{box-sizing:border-box;display:grid;width:min(100%,34rem);gap:24px;padding:clamp(24px,7vw,40px);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);background:var(--surface-primary);box-shadow:var(--elev-2)}
.compatibility-gate__icon{display:grid;width:52px;height:52px;place-items:center;border-radius:var(--radius-lg);color:var(--status-info);background:color-mix(in srgb,var(--status-info) 12%,var(--surface-primary))}
.compatibility-gate__copy{display:grid;gap:12px;min-width:0}
.compatibility-gate h1{margin:0;color:var(--text-primary);font:650 clamp(1.75rem,8vw,2.5rem)/1.05 var(--font-core);letter-spacing:-.03em;text-wrap:balance}
.compatibility-gate p{max-width:65ch;margin:0;color:var(--text-secondary);font:400 1rem/1.55 var(--font-core);overflow-wrap:anywhere}
.compatibility-gate__detail{color:var(--text-muted)!important;font-size:.9375rem!important}
.compatibility-gate button{display:inline-flex;min-height:48px;padding:0 20px;align-items:center;justify-content:center;gap:10px;border:0;border-radius:var(--radius-pill);color:var(--action-primary-fg);background:var(--action-primary);font:650 .9375rem/1 var(--font-core);cursor:pointer;transition:transform var(--dur-fast) var(--ease-calm),background var(--dur-fast) var(--ease-calm)}
.compatibility-gate button:active{transform:scale(var(--press-scale))}
.compatibility-gate__help{font-size:.9375rem!important}
@media(hover:hover){.compatibility-gate button:hover{background:var(--action-primary-hover)}}
@media(max-width:420px){.compatibility-gate__panel{gap:20px;padding:24px}.compatibility-gate button{width:100%}}
</style>
