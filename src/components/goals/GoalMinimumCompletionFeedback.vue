<script setup>
import { useId } from 'vue'
import { ArrowRight } from 'lucide-vue-next'

defineProps({
  goalTitle: { type: String, required: true },
  minimumVersion: { type: String, required: true },
  returnTitle: { type: String, required: true },
  minutes: { type: Number, required: true },
})

defineEmits(['continue'])
const titleId = useId()
</script>

<template>
  <section class="minimum-feedback" aria-live="polite" :aria-labelledby="titleId">
    <p class="minimum-feedback__label">Versión mínima completada</p>
    <h1 :id="titleId">El recorrido continúa.</h1>
    <p class="minimum-feedback__copy">
      “{{ minimumVersion }}” ya forma parte de {{ goalTitle }}. No necesitas recuperar nada.
    </p>

    <div
      class="minimum-feedback__path"
      role="img"
      :aria-label="`El avance anterior se conecta con la versión mínima completada y continúa hacia ${returnTitle}`"
    >
      <svg viewBox="0 0 620 124" preserveAspectRatio="none" aria-hidden="true">
        <path class="minimum-feedback__past" pathLength="1" d="M8 86 C90 86 110 38 198 38" />
        <path class="minimum-feedback__joined" pathLength="1" d="M198 38 C286 38 304 92 390 76 C438 68 450 46 486 46" />
        <path class="minimum-feedback__future" pathLength="1" d="M486 46 C536 46 562 82 612 72" />
        <circle class="minimum-feedback__node minimum-feedback__node--past" cx="198" cy="38" r="6" />
        <circle class="minimum-feedback__node minimum-feedback__node--today" cx="390" cy="76" r="8" />
        <circle class="minimum-feedback__node minimum-feedback__node--next" cx="486" cy="46" r="5" />
      </svg>
      <div class="minimum-feedback__captions" aria-hidden="true">
        <span>Lo que ya construiste</span>
        <strong>Hoy también cuenta</strong>
        <span>Punto de regreso</span>
      </div>
    </div>

    <div class="minimum-feedback__return">
      <span>Retoma desde aquí</span>
      <strong>{{ returnTitle }}</strong>
      <small>{{ minutes }} {{ minutes === 1 ? 'minuto dedicado' : 'minutos dedicados' }}</small>
    </div>

    <button type="button" @click="$emit('continue')">Volver a la meta <ArrowRight :size="17" aria-hidden="true" /></button>
  </section>
</template>

<style scoped>
.minimum-feedback { width:min(100%,var(--content-max)); min-height:72vh; display:grid; align-content:center; margin:auto; padding-block:var(--section-gap-desktop); }
.minimum-feedback__label { margin:0 0 10px; color:var(--action-primary); font:var(--caption-weight) var(--caption-size)/var(--caption-line) var(--font-core); letter-spacing:var(--caption-track); text-transform:uppercase; }
h1 { max-width:14ch; margin:0; color:var(--text-primary); font:400 var(--display-size)/1.04 var(--font-editorial); letter-spacing:-.02em; text-wrap:balance; }
.minimum-feedback__copy { max-width:50ch; margin:var(--space-4) 0 0; color:var(--text-secondary); font:var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); text-wrap:pretty; }
.minimum-feedback__path { margin:var(--section-gap-mobile) 0 var(--space-6); }
svg { width:100%; height:124px; display:block; overflow:visible; }
path { fill:none; stroke-linecap:round; }
.minimum-feedback__past { stroke:var(--progress-adapted); stroke-width:3; opacity:.58; }
.minimum-feedback__joined { stroke:var(--action-primary); stroke-width:3; stroke-dasharray:1; stroke-dashoffset:1; animation:minimum-path-join 280ms cubic-bezier(.16,1,.3,1) 40ms forwards; }
.minimum-feedback__future { stroke:var(--border-strong); stroke-width:2; stroke-dasharray:1 9; }
.minimum-feedback__node { transform-box:fill-box; transform-origin:center; opacity:0; animation:minimum-node-settle 180ms cubic-bezier(.16,1,.3,1) forwards; }
.minimum-feedback__node--past { fill:var(--progress-adapted); animation-delay:40ms; }
.minimum-feedback__node--today { fill:var(--action-primary); stroke:var(--background-base); stroke-width:3; animation-delay:160ms; }
.minimum-feedback__node--next { fill:var(--surface-primary); stroke:var(--action-primary); stroke-width:2; animation-delay:260ms; }
.minimum-feedback__captions { display:grid; grid-template-columns:1fr 1fr 1fr; gap:var(--space-3); margin-top:calc(var(--space-2) * -1); color:var(--text-muted); font:500 var(--caption-size)/1.3 var(--font-core); }
.minimum-feedback__captions strong { color:var(--state-complete-fg); font-weight:600; text-align:center; }
.minimum-feedback__captions span:last-child { text-align:right; }
.minimum-feedback__return { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--space-1) var(--space-5); padding-block:var(--space-4); border-block:1px solid var(--border-subtle); }
.minimum-feedback__return span { grid-column:1/-1; color:var(--text-muted); font:var(--caption-weight) var(--caption-size)/var(--caption-line) var(--font-core); letter-spacing:var(--caption-track); text-transform:uppercase; }
.minimum-feedback__return strong { min-width:0; color:var(--text-primary); font:var(--title-weight) var(--title-size)/var(--title-line) var(--font-core); letter-spacing:var(--title-track); overflow-wrap:break-word; hyphens:auto; }
.minimum-feedback__return small { color:var(--text-secondary); font:500 var(--label-size)/1.4 var(--font-core); white-space:nowrap; }
button { min-height:48px; display:inline-flex; align-items:center; justify-content:center; gap:var(--space-2); justify-self:start; margin-top:var(--space-6); padding-inline:var(--space-5); border:0; border-radius:var(--radius-pill); background:var(--action-primary); color:var(--action-primary-fg); font:var(--label-weight) var(--label-size)/1 var(--font-core); cursor:pointer; transition:transform var(--dur-instant) var(--ease-calm),background var(--dur-fast) var(--ease-calm); }
button:hover { background:var(--action-primary-hover); }
button:active { transform:scale(var(--press-scale)); }
@keyframes minimum-path-join { to { stroke-dashoffset:0; } }
@keyframes minimum-node-settle { from { opacity:0; transform:scale(.55); } to { opacity:1; transform:scale(1); } }
@media (max-width:520px) {
  .minimum-feedback { min-height:auto; padding-block:var(--section-gap-mobile); }
  .minimum-feedback__path { margin-block:var(--space-6); }
  svg { height:104px; }
  .minimum-feedback__captions { gap:var(--space-2); }
  .minimum-feedback__return { grid-template-columns:1fr; }
  .minimum-feedback__return small { white-space:normal; }
  button { width:100%; }
}
@media (prefers-reduced-motion:reduce) {
  .minimum-feedback__joined,.minimum-feedback__node { animation-duration:1ms; animation-delay:0ms; }
}
</style>
