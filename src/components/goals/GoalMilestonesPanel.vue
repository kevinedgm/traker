<script setup>
import { computed, reactive, ref } from 'vue'
import { ArrowDown, ArrowUp, Check, Circle, Pencil, Plus, RotateCcw, SkipForward, Trash2, X } from 'lucide-vue-next'

const props = defineProps({
  milestones: { type: Array, default: () => [] },
  editable: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['create', 'update', 'status', 'delete', 'move'])
const editorOpen = ref(false)
const editingId = ref(null)
const completingId = ref(null)
const deletingId = ref(null)
const form = reactive({ title: '', doneDefinition: '', targetDate: '' })
const evidence = ref('')
const activeMilestones = computed(() => props.milestones.filter(item => item.status !== 'skipped'))
const completedCount = computed(() => activeMilestones.value.filter(item => item.status === 'completed').length)

function resetEditor() {
  editorOpen.value = false
  editingId.value = null
  Object.assign(form, { title: '', doneDefinition: '', targetDate: '' })
}

function openCreate() {
  completingId.value = null
  deletingId.value = null
  editingId.value = null
  Object.assign(form, { title: '', doneDefinition: '', targetDate: '' })
  editorOpen.value = true
}

function openEdit(milestone) {
  completingId.value = null
  deletingId.value = null
  editingId.value = milestone.id
  Object.assign(form, {
    title: milestone.title,
    doneDefinition: milestone.doneDefinition ?? '',
    targetDate: milestone.targetDate ?? '',
  })
  editorOpen.value = true
}

function submit() {
  if (!form.title.trim()) return
  emit(editingId.value ? 'update' : 'create', {
    ...(editingId.value ? { id: editingId.value } : {}),
    title: form.title,
    doneDefinition: form.doneDefinition,
    targetDate: form.targetDate || null,
  })
  resetEditor()
}

function openCompletion(id) {
  resetEditor()
  deletingId.value = null
  completingId.value = id
  evidence.value = ''
}

function complete() {
  if (!evidence.value.trim()) return
  emit('status', { id: completingId.value, status: 'completed', evidenceSummary: evidence.value })
  cancelTransient()
}

function confirmDelete(id) {
  emit('delete', id)
  cancelTransient()
}

function cancelTransient() {
  completingId.value = null
  deletingId.value = null
  evidence.value = ''
}

function statusLabel(status) {
  return ({ pending: 'Pendiente', active: 'En curso', completed: 'Completado', skipped: 'Omitido conscientemente' })[status] ?? status
}

function dateLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}
</script>

<template>
  <section class="milestones" aria-labelledby="milestones-title">
    <header class="milestones__head">
      <div>
        <span>Definición observable</span>
        <h2 id="milestones-title">Hitos</h2>
        <p v-if="activeMilestones.length"><strong>{{ completedCount }} de {{ activeMilestones.length }}</strong> hitos vigentes completados.</p>
        <p v-else>Divide la meta en resultados que puedas comprobar.</p>
      </div>
      <button v-if="editable && !editorOpen" type="button" :disabled="busy" @click="openCreate"><Plus :size="17" /> Añadir hito</button>
    </header>

    <form v-if="editorOpen" class="milestones__form" @submit.prevent="submit">
      <div class="milestones__form-head"><strong>{{ editingId ? 'Editar hito' : 'Nuevo hito' }}</strong><button type="button" aria-label="Cerrar editor" @click="resetEditor"><X :size="18" /></button></div>
      <label>Resultado esperado<input v-model.trim="form.title" maxlength="160" required placeholder="Ej. Validar el prototipo con 3 personas" /></label>
      <label>¿Cómo sabrás que quedó listo?<textarea v-model.trim="form.doneDefinition" rows="2" placeholder="Una señal concreta y verificable" /></label>
      <label>Fecha objetivo opcional<input v-model="form.targetDate" type="date" /></label>
      <div class="milestones__form-actions"><button type="submit" :disabled="busy || !form.title.trim()">{{ editingId ? 'Guardar cambios' : 'Crear hito' }}</button><button type="button" :disabled="busy" @click="resetEditor">Cancelar</button></div>
    </form>

    <p v-if="!milestones.length && !editorOpen" class="milestones__empty">Todavía no hay hitos. La definición general de la meta seguirá siendo el criterio de cierre.</p>

    <ol v-else class="milestones__list">
      <li v-for="(milestone, index) in milestones" :key="milestone.id" :class="[`is-${milestone.status}`, { 'is-editing': editingId === milestone.id }]">
        <div class="milestones__marker" aria-hidden="true"><Check v-if="milestone.status === 'completed'" :size="16" /><SkipForward v-else-if="milestone.status === 'skipped'" :size="15" /><Circle v-else :size="14" /></div>
        <div class="milestones__content">
          <div class="milestones__title"><strong>{{ milestone.title }}</strong><span>{{ statusLabel(milestone.status) }}</span></div>
          <p v-if="milestone.doneDefinition">{{ milestone.doneDefinition }}</p>
          <time v-if="milestone.targetDate" :datetime="milestone.targetDate">Objetivo: {{ dateLabel(milestone.targetDate) }}</time>
          <blockquote v-if="milestone.evidenceSummary"><span>Evidencia</span>{{ milestone.evidenceSummary }}</blockquote>

          <form v-if="completingId === milestone.id" class="milestones__evidence" @submit.prevent="complete">
            <label>¿Qué demuestra que este hito quedó listo?<textarea v-model.trim="evidence" rows="2" required autofocus placeholder="Ej. Enlace enviado y aprobación recibida" /></label>
            <div><button type="submit" :disabled="busy || !evidence.trim()">Guardar evidencia y completar</button><button type="button" :disabled="busy" @click="cancelTransient">Cancelar</button></div>
          </form>

          <div v-else-if="deletingId === milestone.id" class="milestones__delete" role="alert">
            <p>¿Quitar este hito? Se conservará como baja sincronizable.</p>
            <div><button type="button" :disabled="busy" @click="confirmDelete(milestone.id)">Sí, quitar</button><button type="button" :disabled="busy" @click="cancelTransient">Cancelar</button></div>
          </div>

          <div v-else-if="editable" class="milestones__actions">
            <button v-if="['pending', 'active'].includes(milestone.status)" type="button" :disabled="busy" @click="openCompletion(milestone.id)"><Check :size="16" /> Completar</button>
            <button v-if="milestone.status === 'pending'" type="button" :disabled="busy" @click="emit('status', { id: milestone.id, status: 'active' })">Empezar</button>
            <button v-if="milestone.status === 'active'" type="button" :disabled="busy" @click="emit('status', { id: milestone.id, status: 'pending' })">Dejar pendiente</button>
            <button v-if="milestone.status === 'completed'" type="button" :disabled="busy" @click="emit('status', { id: milestone.id, status: 'active' })"><RotateCcw :size="15" /> Reabrir</button>
            <button v-if="['pending', 'active'].includes(milestone.status)" type="button" :disabled="busy" @click="emit('status', { id: milestone.id, status: 'skipped' })"><SkipForward :size="15" /> Omitir</button>
            <button v-if="milestone.status === 'skipped'" type="button" :disabled="busy" @click="emit('status', { id: milestone.id, status: 'pending' })"><RotateCcw :size="15" /> Recuperar</button>
            <button type="button" :disabled="busy || index === 0" aria-label="Mover hito arriba" @click="emit('move', { id: milestone.id, direction: 'up' })"><ArrowUp :size="16" /></button>
            <button type="button" :disabled="busy || index === milestones.length - 1" aria-label="Mover hito abajo" @click="emit('move', { id: milestone.id, direction: 'down' })"><ArrowDown :size="16" /></button>
            <button type="button" :disabled="busy" aria-label="Editar hito" @click="openEdit(milestone)"><Pencil :size="16" /></button>
            <button class="milestones__remove" type="button" :disabled="busy" aria-label="Quitar hito" @click="deletingId = milestone.id"><Trash2 :size="16" /></button>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.milestones{box-sizing:border-box;margin-top:var(--section-gap-mobile)!important;padding-block:var(--space-6);border-block:1px solid var(--border-subtle)}
.milestones__head{display:flex;align-items:start;justify-content:space-between;gap:var(--space-4)}
.milestones__head span{color:var(--action-primary);font:700 var(--caption-size)/1.2 var(--font-core);letter-spacing:.08em;text-transform:uppercase}
.milestones__head h2{margin:6px 0 0;font:600 var(--h2-size)/var(--h2-line) var(--font-core);letter-spacing:var(--h2-track)}
.milestones__head p{margin:7px 0 0;color:var(--text-secondary);font:400 var(--body-small-size)/1.5 var(--font-core)}
.milestones__head>button,.milestones__form-actions button,.milestones__evidence button,.milestones__delete button{display:inline-flex;min-height:44px;align-items:center;justify-content:center;gap:7px;padding-inline:var(--space-4);border:1px solid var(--border-subtle);border-radius:var(--radius-pill);color:var(--text-primary);background:var(--action-secondary-bg);font:600 var(--label-size)/1 var(--font-core);cursor:pointer}
.milestones__head>button{border-color:transparent;color:var(--action-primary-fg);background:var(--action-primary);white-space:nowrap}
.milestones__empty{margin:var(--space-6) 0 0;color:var(--text-muted);font:400 var(--body-size)/1.55 var(--font-core)}
.milestones__list{display:grid;gap:0;margin:var(--space-6) 0 0;padding:0;list-style:none}
.milestones__list>li{display:grid;grid-template-columns:32px minmax(0,1fr);gap:var(--space-3);padding:var(--space-4) 0;border-top:1px solid var(--border-subtle)}
.milestones__marker{display:grid;width:30px;height:30px;place-items:center;border:1px solid var(--border-strong);border-radius:50%;color:var(--text-muted)}
.is-completed .milestones__marker{border-color:var(--progress-complete);color:var(--surface-primary);background:var(--progress-complete)}
.is-skipped{opacity:.64}.is-skipped .milestones__marker{border-style:dashed}
.milestones__content{min-width:0}.milestones__title{display:flex;align-items:start;justify-content:space-between;gap:var(--space-3)}
.milestones__title strong{color:var(--text-primary);font:600 var(--body-size)/1.35 var(--font-core);overflow-wrap:anywhere}
.milestones__title span{flex:none;color:var(--text-muted);font:600 var(--caption-size)/1.4 var(--font-core)}
.milestones__content>p{margin:6px 0 0;color:var(--text-secondary);font:400 var(--body-small-size)/1.5 var(--font-core)}
.milestones__content>time{display:block;margin-top:6px;color:var(--text-muted);font:400 var(--caption-size)/1.4 var(--font-numeric)}
.milestones__content blockquote{display:grid;gap:4px;margin:var(--space-3) 0 0;padding:var(--space-3);border:1px solid color-mix(in srgb,var(--progress-complete) 28%,var(--border-subtle));border-radius:var(--radius-md);color:var(--text-secondary);background:var(--surface-secondary);font:400 var(--body-small-size)/1.5 var(--font-core)}
.milestones__content blockquote span{color:var(--progress-complete);font:700 var(--caption-size)/1 var(--font-core);letter-spacing:.06em;text-transform:uppercase}
.milestones__actions{display:flex;flex-wrap:wrap;gap:2px;margin-top:var(--space-3)}
.milestones__actions button{display:inline-flex;min-height:40px;align-items:center;gap:6px;padding-inline:10px;border:0;border-radius:var(--radius-md);color:var(--text-muted);background:transparent;font:600 var(--caption-size)/1 var(--font-core);cursor:pointer}
.milestones__actions button:first-child{color:var(--progress-complete)}.milestones__actions .milestones__remove{color:var(--status-danger)}
.milestones__actions button:disabled,.milestones__head button:disabled,.milestones__form button:disabled,.milestones__evidence button:disabled{cursor:not-allowed;opacity:.42}
.milestones__form,.milestones__evidence{display:grid;gap:var(--space-4);margin-top:var(--space-5);padding:var(--space-4);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:var(--surface-secondary)}
.milestones__form-head{display:flex;align-items:center;justify-content:space-between}.milestones__form-head>button{display:grid;width:44px;height:44px;place-items:center;border:0;border-radius:var(--radius-md);color:var(--text-muted);background:transparent}
.milestones__form label,.milestones__evidence label{display:grid;gap:var(--space-2);color:var(--text-secondary);font:600 var(--label-size)/1.4 var(--font-core)}
.milestones__form input,.milestones__form textarea,.milestones__evidence textarea{box-sizing:border-box;width:100%;min-height:46px;padding:var(--space-3);border:1px solid var(--border-strong);border-radius:var(--radius-md);outline:0;color:var(--text-primary);background:var(--surface-primary);font:400 16px/1.4 var(--font-core);resize:vertical}
.milestones__form input:focus-visible,.milestones__form textarea:focus-visible,.milestones__evidence textarea:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}
.milestones__form-actions,.milestones__evidence>div,.milestones__delete>div{display:flex;flex-wrap:wrap;gap:var(--space-2)}
.milestones__form-actions button:first-child,.milestones__evidence button:first-child{border-color:transparent;color:var(--action-primary-fg);background:var(--action-primary)}
.milestones__delete{margin-top:var(--space-3);padding:var(--space-3);border-block:1px solid var(--status-danger)}.milestones__delete p{margin:0 0 var(--space-3);color:var(--text-secondary);font:400 var(--body-small-size)/1.5 var(--font-core)}.milestones__delete button:first-child{color:var(--status-danger)}
@media(hover:hover){.milestones__actions button:hover:not(:disabled){color:var(--text-primary);background:var(--surface-secondary)}}
@media(max-width:520px){.milestones__head{display:grid}.milestones__head>button{width:100%}.milestones__title{display:grid;gap:4px}.milestones__actions button{min-height:44px}.milestones__form-actions button,.milestones__evidence button,.milestones__delete button{width:100%}}
</style>
