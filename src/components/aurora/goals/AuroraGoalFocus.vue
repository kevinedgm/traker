<script setup>
import AuroraSkeleton from '../feedback/AuroraSkeleton.vue'

defineProps({
  goal: String,
  state: { default: 'available' },
  action: String,
  reason: String,
  elapsed: String,
  eyebrow: { default: 'Tu foco' },
  detailLabel: { default: 'Ver la meta' },
})
defineEmits(['primary', 'detail'])

const labels = {
  available: { state: 'Acción disponible', primary: 'Empezar ahora' },
  active: { state: 'Sesión en curso', primary: 'Volver a la sesión' },
  blocked: { state: 'Acción bloqueada', primary: 'Adaptar el paso' },
  loading: { state: 'Cargando', primary: null },
}
</script>

<template>
  <section
    v-if="goal || state === 'loading'"
    class="goal"
    :class="`goal--${state}`"
    :aria-busy="state === 'loading' || undefined"
  >
    <header>
      <span class="goal__mark" aria-hidden="true"><i v-if="state === 'active'" class="aurora-breathe" /></span>
      <span class="goal__eyebrow">{{ eyebrow }}</span>
      <span class="goal__sr">{{ (labels[state] || labels.available).state }}</span>
      <span v-if="state === 'active' && elapsed" class="goal__elapsed" aria-live="polite">{{ elapsed }}</span>
      <span v-else-if="state === 'blocked'" class="goal__adaptable">Se puede adaptar</span>
    </header>

    <div v-if="state === 'loading'" class="goal__loading">
      <AuroraSkeleton variant="block" width="78%" :height="20" radius="var(--radius-xs)" />
      <AuroraSkeleton variant="block" width="54%" :height="14" radius="var(--radius-xs)" />
    </div>
    <div v-else class="goal__copy">
      <h2>{{ goal }}</h2>
      <p v-if="state === 'blocked' ? reason : action">{{ state === 'blocked' ? reason : action }}</p>
    </div>

    <div class="goal__actions">
      <button v-if="state !== 'loading'" class="goal__primary" type="button" @click="$emit('primary')">
        {{ (labels[state] || labels.available).primary }}
      </button>
      <AuroraSkeleton v-else variant="block" width="148px" :height="48" radius="var(--radius-pill)" />
      <button v-if="state !== 'loading'" class="goal__detail" type="button" @click="$emit('detail')">{{ detailLabel }}</button>
    </div>
  </section>
</template>

<style scoped>
.goal{display:flex;flex-direction:column;gap:14px;padding:var(--pad-card);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);background:var(--surface-primary);box-shadow:var(--elev-2)}
.goal--active{border-color:var(--border-accent);background:var(--aurora-veil),var(--surface-primary)}
.goal--blocked{border-color:color-mix(in srgb,var(--status-warning) 34%,transparent)}
.goal header{display:flex;min-width:0;align-items:center;gap:8px}
.goal__mark{display:block;width:10px;height:10px;flex:none;border:2px solid var(--action-primary);border-radius:var(--radius-pill)}
.goal--active .goal__mark{position:relative;border:0;background:var(--accent-focus)}
.goal--active .goal__mark i{position:absolute;inset:-4px;border:1.5px solid var(--accent-focus);border-radius:var(--radius-pill);opacity:.5}
.goal--blocked .goal__mark{border:1.5px dashed var(--status-warning);border-radius:3px}
.goal--loading .goal__mark{border:1.5px solid var(--border-strong)}
.goal__eyebrow{color:var(--text-muted);font:600 12px/1 var(--font-core);letter-spacing:.06em;text-transform:uppercase}
.goal__sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;border:0;clip:rect(0 0 0 0);white-space:nowrap}
.goal__elapsed{margin-left:auto;color:var(--accent-focus);font:600 14px/1 var(--font-numeric);font-variant-numeric:tabular-nums}
.goal__adaptable{margin-left:auto;color:var(--status-warning);font:600 12px/1 var(--font-core)}
.goal__loading{display:flex;flex-direction:column;gap:10px}
.goal__copy{display:flex;min-width:0;flex-direction:column;gap:6px}
.goal__copy h2{margin:0;color:var(--text-primary);font:600 20px/1.25 var(--font-core);letter-spacing:-.015em;text-wrap:pretty}
.goal__copy p{display:-webkit-box;margin:0;overflow:hidden;color:var(--text-secondary);font:400 14px/1.5 var(--font-core);text-wrap:pretty;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.goal--blocked .goal__copy p{color:var(--text-primary)}
.goal__actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.goal__actions button{border-radius:var(--radius-pill);font-family:var(--font-core);font-weight:600;cursor:pointer}
.goal__primary{min-height:48px;padding:0 20px;border:0;background:var(--action-primary);color:var(--action-primary-fg);font-size:15px;transition:background var(--dur-fast) var(--ease-calm)}
.goal__primary:hover{background:var(--action-primary-hover)}
.goal__detail{min-height:44px;padding:0 12px;border:0;background:transparent;color:var(--text-secondary);font-size:14px}
.goal__detail:hover{background:var(--action-secondary-bg);color:var(--text-primary)}
</style>
