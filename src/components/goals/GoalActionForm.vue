<script setup>
import { computed, nextTick, onMounted, reactive, ref, useId } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import EffortSelector from './EffortSelector.vue'

const props = defineProps({
  title: { type: String, default: 'Define el siguiente paso' },
  submitLabel: { type: String, default: 'Guardar siguiente paso' },
  busy: { type: Boolean, default: false },
  initialMinimumVersion: { type: String, default: '' },
})
const emit = defineEmits(['submit', 'cancel'])
const submitted = ref(false)
const touchedTitle = ref(false)
const showDetails = ref(Boolean(props.initialMinimumVersion))
const actionInput = ref(null)
const form = reactive({ title: '', minimumVersion: props.initialMinimumVersion, energyLevel: 'medium', estimateBucket: '15m', adaptationReason: '' })
const detailSummary = computed(() => {
  const effort = ({ low: 'Mínimo', medium: 'Habitual', high: 'De sobra' })[form.energyLevel]
  const time = ({ '5m': '5 min', '15m': '15 min', '30m': '30 min', '60m': '1 h', open: 'Sin reloj' })[form.estimateBucket]
  return `Opcional · ${effort} · ${time}`
})
const uid = useId()
const ids = {
  action: `${uid}-action`,
  actionHint: `${uid}-action-hint`,
  actionError: `${uid}-action-error`,
  details: `${uid}-details`,
  minimum: `${uid}-minimum`,
  estimate: `${uid}-estimate`,
}

function submit() {
  submitted.value = true
  if (!form.title.trim()) return
  emit('submit', { ...form })
}

onMounted(async () => {
  await nextTick()
  actionInput.value?.focus()
})
</script>

<template>
  <form class="action-form" novalidate :aria-busy="busy ? 'true' : undefined" @submit.prevent="submit">
    <header class="action-form__header">
      <h2>{{ title }}</h2>
      <p>Empieza por una sola acción clara. Los detalles pueden esperar.</p>
    </header>

    <div class="action-form__field">
      <label :for="ids.action">Acción concreta</label>
      <input
        :id="ids.action"
        ref="actionInput"
        v-model="form.title"
        maxlength="160"
        autocomplete="off"
        autofocus
        placeholder="Ej. Escribir los primeros tres puntos"
        :aria-invalid="(submitted || touchedTitle) && !form.title.trim()"
        :aria-describedby="(submitted || touchedTitle) && !form.title.trim() ? ids.actionError : ids.actionHint"
        @blur="touchedTitle = true"
      />
      <small :id="ids.actionHint" class="action-form__hint">Algo que puedas comenzar sin tomar otra decisión.</small>
      <small v-if="(submitted || touchedTitle) && !form.title.trim()" :id="ids.actionError" class="action-form__error" role="alert">Escribe una acción concreta para continuar.</small>
    </div>

    <button
      class="action-form__details-toggle"
      type="button"
      :aria-expanded="showDetails"
      :aria-controls="ids.details"
      @click="showDetails = !showDetails"
    >
      <span><strong>{{ showDetails ? 'Ocultar detalles' : 'Ajustar esfuerzo y tiempo' }}</strong><small>{{ detailSummary }}</small></span>
      <ChevronDown :size="18" aria-hidden="true" :class="{ 'is-open': showDetails }" />
    </button>

    <div v-if="showDetails" :id="ids.details" class="action-form__details">
      <div class="action-form__field">
        <label :for="ids.minimum">Versión mínima <em>Opcional</em></label>
        <input :id="ids.minimum" v-model="form.minimumVersion" maxlength="160" autocomplete="off" placeholder="Ej. Abrir el archivo y escribir una línea" />
      </div>
      <EffortSelector v-model="form.energyLevel" label="Energía que suele pedir" />
      <div class="action-form__field">
        <label :for="ids.estimate">Tiempo aproximado</label>
        <select :id="ids.estimate" v-model="form.estimateBucket"><option value="5m">5 minutos</option><option value="15m">15 minutos</option><option value="30m">30 minutos</option><option value="60m">1 hora</option><option value="open">Sin estimación</option></select>
      </div>
    </div>

    <div class="action-form__actions">
      <button class="action-form__submit" type="submit" :disabled="busy" :aria-busy="busy ? 'true' : undefined">{{ busy ? 'Guardando…' : submitLabel }}</button>
      <button class="action-form__cancel" type="button" :disabled="busy" @click="emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>

<style scoped>
.action-form { display: grid; width: min(100%, var(--content-max)); box-sizing: border-box; margin: var(--space-5) auto 0; gap: 0; padding-block: var(--section-gap-mobile); border-block: 1px solid var(--border-subtle); }
.action-form__header { margin-bottom: var(--space-5); }
.action-form h2 { margin: 0; color: var(--text-primary); font: var(--h1-weight) var(--h1-size)/var(--h1-line) var(--font-core); letter-spacing: var(--h1-track); text-wrap: balance; }
.action-form__header p { max-width: 65ch; margin: var(--space-2) 0 0; color: var(--text-secondary); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); text-wrap: pretty; }
label { color: var(--text-secondary); font: var(--label-weight) var(--label-size)/var(--label-line) var(--font-core); letter-spacing: var(--label-track); }
label em { color: var(--text-muted); font-style: normal; font-weight: 400; }
input, select { box-sizing: border-box; width: 100%; min-height: 50px; padding: 12px 14px; border: 1px solid var(--border-strong); border-radius: var(--radius-md); color: var(--text-primary); background: var(--surface-primary); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); }
input::placeholder { color: var(--text-muted); }
[aria-invalid='true'] { border-color: var(--color-danger); }
.action-form__field { display: grid; gap: var(--space-2); min-width: 0; }
.action-form__hint, .action-form__error { font: 400 var(--label-size)/1.4 var(--font-core); }
.action-form__hint { color: var(--text-muted); }
.action-form__error { color: var(--color-danger); }
.action-form__details-toggle { display: flex; min-height: 60px; margin-top: var(--space-5); align-items: center; justify-content: space-between; gap: var(--space-3); padding: 0; border: 0; border-block: 1px solid var(--border-subtle); color: var(--text-primary); background: transparent; text-align: start; cursor: pointer; transition: color var(--dur-fast) var(--ease-calm); }
.action-form__details-toggle span { display: grid; gap: var(--space-1); }
.action-form__details-toggle strong { font: var(--label-weight) var(--label-size)/var(--label-line) var(--font-core); }
.action-form__details-toggle small { color: var(--text-muted); font: 400 var(--label-size)/var(--label-line) var(--font-core); }
.action-form__details-toggle svg { flex: none; transition: transform var(--dur-fast) var(--ease-calm); }
.action-form__details-toggle svg.is-open { transform: rotate(180deg); }
.action-form__details { display: grid; gap: var(--space-5); padding-top: var(--space-5); }
.action-form__actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-6); }
.action-form__actions button { min-height: 48px; padding-inline: 20px; border-radius: var(--radius-pill); font: var(--label-weight) var(--label-size)/1 var(--font-core); cursor: pointer; transition: transform var(--dur-instant) var(--ease-calm), background var(--dur-fast) var(--ease-calm), border-color var(--dur-fast) var(--ease-calm); }
.action-form__submit { flex: 1 1 230px; border: 0; color: var(--action-primary-fg); background: var(--action-primary); }
.action-form__cancel { border: 1px solid var(--border-subtle); color: var(--text-secondary); background: var(--action-secondary-bg); }
.action-form__actions button:active:not(:disabled) { transform: scale(var(--press-scale)); }
.action-form__actions button:disabled { cursor: not-allowed; opacity: 0.45; }
@media (hover: hover) {
  .action-form__details-toggle:hover { color: var(--action-primary); }
  .action-form__submit:hover:not(:disabled) { background: var(--action-primary-hover); }
  .action-form__cancel:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface-secondary); }
}
@media (prefers-reduced-motion: no-preference) {
  .action-form__details { transform-origin: top; animation: action-details-reveal var(--dur-base) cubic-bezier(.16, 1, .3, 1) both; }
  .action-form__error { animation: action-error-settle var(--dur-fast) cubic-bezier(.16, 1, .3, 1) both; }
}
@keyframes action-details-reveal { from { opacity: 0; clip-path: inset(0 0 18% 0); transform: translateY(-6px); } to { opacity: 1; clip-path: inset(0); transform: translateY(0); } }
@keyframes action-error-settle { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
@media (min-width: 720px) { .action-form { padding-block: var(--section-gap-desktop); } }
@media (max-width: 520px) { .action-form__actions { flex-direction: column; } .action-form__submit, .action-form__cancel { width: 100%; flex-basis: auto; } }
@media (prefers-reduced-motion: reduce) { .action-form__details-toggle svg { transition-duration: 1ms; } }
</style>
