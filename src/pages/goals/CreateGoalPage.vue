<script setup>
import { computed, onMounted, reactive, ref, useId } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import EffortSelector from '@/components/goals/EffortSelector.vue'
import { useGoalsStore } from '@/stores/goals.js'
import { useCopy } from '@/composables/useCopy'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const store = useGoalsStore()
const { getPhrase } = useCopy()
const toast = useToast()
const busy = ref(false)
const submitted = ref(false)
const formId = useId()
const errorIds = {
  title: `${formId}-title-error`,
  done: `${formId}-done-error`,
  action: `${formId}-action-error`,
}
const form = reactive({ title: '', personalWhy: '', doneDefinition: '', horizon: 'short', nextActionTitle: '', minimumVersion: '', energyLevel: 'medium', estimateBucket: '15m' })
const sourceGoalId = computed(() => typeof route.query.from === 'string' ? route.query.from : null)
const sourceGoal = computed(() => sourceGoalId.value ? store.goals.find(goal => goal.id === sourceGoalId.value) : null)
const sourceAction = computed(() => sourceGoal.value ? store.actionForGoal(sourceGoal.value.id) : null)

onMounted(async () => {
  if (!sourceGoalId.value) return
  if (!store.loaded) await store.load().catch(() => {})
  if (!sourceGoal.value) return
  Object.assign(form, {
    title: sourceGoal.value.title,
    personalWhy: sourceGoal.value.personalWhy,
    doneDefinition: sourceGoal.value.doneDefinition,
    horizon: sourceGoal.value.horizon,
    nextActionTitle: sourceAction.value?.title ?? '',
    minimumVersion: sourceAction.value?.minimumVersion ?? '',
    energyLevel: sourceAction.value?.energyLevel ?? 'medium',
    estimateBucket: sourceAction.value?.estimateBucket ?? '15m',
  })
})

async function submit() {
  submitted.value = true
  if (!form.title.trim() || !form.doneDefinition.trim() || !form.nextActionTitle.trim()) return
  busy.value = true
  try {
    const reformulatedFromGoalId = typeof route.query.from === 'string' ? route.query.from : null
    const { goal } = await store.createGoal({
      ...form,
      reformulatedFromGoalId,
    })
    if (reformulatedFromGoalId) {
      toast.show({ message: getPhrase('goal_reformulated', { vars: { goalName: goal.title } }).text, tone: 'action' })
    }
    await router.push(`/goals/${goal.id}`)
  } catch (_) {
    // The store exposes a stable, user-facing error below.
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="goal-create">
    <RouterLink class="goal-create__back" to="/goals"><ArrowLeft :size="18" /> Metas</RouterLink>
    <header><p>{{ route.query.from ? 'Cambiar también es avanzar' : 'Una dirección clara' }}</p><h1>{{ route.query.from ? 'Reformular meta' : 'Nueva meta' }}</h1><span>Empieza pequeño. La meta anterior conservará lo aprendido.</span></header>
    <section v-if="sourceGoal" class="goal-create__comparison" aria-labelledby="reformulation-comparison-title">
      <div><span>Antes</span><h2 id="reformulation-comparison-title">{{ sourceGoal.title }}</h2><p>{{ sourceGoal.doneDefinition }}</p></div>
      <div><span>Después</span><h2>{{ form.title || 'Escribe la nueva dirección' }}</h2><p>{{ form.doneDefinition || 'Define la nueva señal de terminado' }}</p></div>
      <small>Al confirmar, la versión anterior quedará cerrada y vinculada a esta nueva meta.</small>
    </section>
    <form novalidate @submit.prevent="submit">
      <label>¿Qué quieres lograr?<input v-model="form.title" maxlength="120" autocomplete="off" placeholder="Ej. Entregar mi propuesta" :aria-invalid="submitted && !form.title.trim()" :aria-describedby="submitted && !form.title.trim() ? errorIds.title : undefined" /><small v-if="submitted && !form.title.trim()" :id="errorIds.title" role="alert">Escribe una meta.</small></label>
      <label>¿Cómo sabrás que está terminada?<textarea v-model="form.doneDefinition" rows="3" maxlength="300" placeholder="Una señal observable y suficiente" :aria-invalid="submitted && !form.doneDefinition.trim()" :aria-describedby="submitted && !form.doneDefinition.trim() ? errorIds.done : undefined" /><small v-if="submitted && !form.doneDefinition.trim()" :id="errorIds.done" role="alert">Define qué significa terminar.</small></label>
      <label>Horizonte de la meta<select v-model="form.horizon"><option value="short">Corto plazo · esta semana</option><option value="medium">Mediano plazo · hasta 5 meses</option><option value="long">Largo plazo · 9 meses o más</option></select></label>
      <label>¿Por qué te importa? <em>Opcional</em><textarea v-model="form.personalWhy" rows="2" maxlength="300" placeholder="Una razón que quieras recordar" /></label>
      <div class="goal-create__divider"><span>El primer movimiento</span></div>
      <label>¿Qué puedes hacer a continuación?<input v-model="form.nextActionTitle" maxlength="160" autocomplete="off" placeholder="Ej. Abrir el documento y escribir el título" :aria-invalid="submitted && !form.nextActionTitle.trim()" :aria-describedby="submitted && !form.nextActionTitle.trim() ? errorIds.action : undefined" /><small v-if="submitted && !form.nextActionTitle.trim()" :id="errorIds.action" role="alert">Elige una acción concreta.</small></label>
      <label>Versión mínima <em>Opcional</em><input v-model="form.minimumVersion" maxlength="160" autocomplete="off" placeholder="Ej. Abrir el documento durante 2 minutos" /></label>
      <EffortSelector v-model="form.energyLevel" label="Energía que suele pedir" />
      <label>Tiempo aproximado<select v-model="form.estimateBucket"><option value="5m">5 minutos</option><option value="15m">15 minutos</option><option value="30m">30 minutos</option><option value="60m">1 hora</option><option value="open">Sin estimación</option></select></label>
      <p v-if="store.error" class="goal-create__error" role="alert">{{ store.error.message }}</p>
      <button class="goal-create__submit" type="submit" :disabled="busy" :aria-busy="busy">{{ busy ? 'Guardando…' : route.query.from ? 'Confirmar reformulación' : 'Crear meta' }}</button>
    </form>
  </main>
</template>

<style scoped>
.goal-create { min-height: 100svh; padding: 32px 20px 72px; color: var(--color-text); background: transparent; }
.goal-create__back { display: inline-flex; min-height: 44px; align-items: center; gap: 7px; color: var(--color-text-muted); text-decoration: none; }
header, form { width: min(100%, 640px); margin-inline: auto; }
header { padding: 34px 0 30px; }
header p { margin: 0 0 8px; color: var(--color-brand); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
header h1 { margin: 0 0 12px; font-size: clamp(38px, 8vw, 58px); letter-spacing: -.05em; line-height: 1; }
header span { color: var(--color-text-muted); line-height: 1.5; }
.goal-create__comparison{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);width:min(100%,640px);box-sizing:border-box;margin:0 auto var(--space-6);padding:var(--space-4) 0;border-block:1px solid var(--border-strong)}
.goal-create__comparison>div{min-width:0;padding:var(--space-3);background:var(--surface-secondary)}.goal-create__comparison span{color:var(--action-primary);font:700 var(--caption-size)/1.2 var(--font-core);letter-spacing:.08em;text-transform:uppercase}.goal-create__comparison h2{margin:7px 0 5px;color:var(--text-primary);font:600 18px/1.3 var(--font-core);overflow-wrap:anywhere}.goal-create__comparison p{margin:0;color:var(--text-secondary);font:400 13px/1.45 var(--font-core);overflow-wrap:anywhere}.goal-create__comparison small{grid-column:1/-1;color:var(--text-muted);font:400 12px/1.45 var(--font-core)}
form { display: grid; gap: 24px; }
label { display: grid; gap: 9px; color: var(--color-text-soft); font-size: 14px; font-weight: 700; }
label em { color: var(--color-text-faint); font-style: normal; font-weight: 500; }
input, textarea, select { width: 100%; min-height: 52px; padding: 14px 16px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-input); color: var(--color-text); background: var(--color-surface); font: inherit; font-weight: 500; resize: vertical; }
input::placeholder, textarea::placeholder { color: var(--color-text-faint); }
[aria-invalid='true'] { border-color: var(--color-danger); }
label small, .goal-create__error { margin: 0; color: var(--color-danger); font-weight: 600; }
.goal-create__divider { display: flex; align-items: center; gap: 12px; color: var(--color-brand); font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.goal-create__divider::after { height: 1px; flex: 1; content: ''; background: var(--color-border); }
.goal-create__submit { min-height: 52px; border: 0; border-radius: var(--radius-full); color: var(--color-brand-contrast); background: var(--color-brand); font-size: 16px; font-weight: 850; }
.goal-create__submit:disabled { opacity: .55; }
@media(max-width:520px){.goal-create__comparison{grid-template-columns:1fr}.goal-create__comparison small{grid-column:1}}
</style>
