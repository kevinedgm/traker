<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Layers3, Pause, Pencil, Play, Plus, Trash2, X } from 'lucide-vue-next'
import { useFlexibleGroupsStore } from '@/stores/flexibleGroups.js'
import { flexiblePeriodLabel } from '@/features/flexibleGroups/domain.js'
import AuroraConfirmDialog from '@/components/aurora/surfaces/AuroraConfirmDialog.vue'

const props = defineProps({ habits: { type: Array, default: () => [] } })
const store = useFlexibleGroupsStore()
const editingId = ref(null)
const deleting = ref(null)
const error = ref('')
const form = reactive({ name: '', period: 'week', minimumCount: 1, memberIds: [] })

const availableHabits = computed(() => props.habits
  .filter(habit => habit.isActive !== false)
  .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')))
const visibleGroups = computed(() => store.groups
  .filter(group => !group.deletedAt)
  .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')))
const formOpen = computed(() => editingId.value !== null)

function resetForm() {
  Object.assign(form, { name: '', period: 'week', minimumCount: 1, memberIds: [] })
  editingId.value = null
  error.value = ''
}

function startCreate() {
  Object.assign(form, {
    name: '',
    period: 'week',
    minimumCount: Math.min(1, availableHabits.value.length),
    memberIds: [],
  })
  editingId.value = 'new'
  error.value = ''
}

function startEdit(group) {
  Object.assign(form, {
    name: group.name,
    period: group.period,
    minimumCount: group.minimumCount,
    memberIds: [...group.memberIds],
  })
  editingId.value = group.id
  error.value = ''
}

function toggleMember(habitId) {
  form.memberIds = form.memberIds.includes(habitId)
    ? form.memberIds.filter(id => id !== habitId)
    : [...form.memberIds, habitId]
}

function save() {
  error.value = ''
  if (!form.name.trim()) {
    error.value = 'Ponle un nombre al grupo.'
    return
  }
  if (!form.memberIds.length) {
    error.value = 'Elige al menos una actividad.'
    return
  }
  if (form.minimumCount < 1 || form.minimumCount > form.memberIds.length) {
    error.value = `El mínimo debe estar entre 1 y ${form.memberIds.length}.`
    return
  }
  const payload = {
    name: form.name,
    period: form.period,
    minimumCount: form.minimumCount,
    targetCount: form.minimumCount,
    extraCount: form.memberIds.length,
    memberIds: form.memberIds,
  }
  const saved = editingId.value === 'new'
    ? store.addGroup(payload)
    : store.updateGroup(editingId.value, payload)
  if (!saved) {
    error.value = 'No se pudo guardar. Revisa el nombre, el mínimo y las actividades.'
    return
  }
  resetForm()
}

watch(() => form.memberIds.length, length => {
  if (length && form.minimumCount > length) form.minimumCount = length
})
</script>

<template>
  <section class="flex-groups" aria-labelledby="flex-groups-title">
    <header class="flex-groups__head">
      <div>
        <h2 id="flex-groups-title">Opciones flexibles</h2>
        <p>Elige N actividades por semana o mes. Las alternativas no aparecerán como pendientes individuales.</p>
      </div>
      <button v-if="!formOpen" type="button" :disabled="!availableHabits.length" @click="startCreate">
        <Plus :size="17" aria-hidden="true" />Crear grupo
      </button>
    </header>

    <form v-if="formOpen" class="flex-groups__form" @submit.prevent="save">
      <div class="flex-groups__form-head">
        <div>
          <h3>{{ editingId === 'new' ? 'Nuevo grupo flexible' : 'Editar grupo flexible' }}</h3>
          <p>Una actividad cuenta una vez en cada periodo, aunque esté ligada a más de un grupo.</p>
        </div>
        <button type="button" aria-label="Cerrar formulario" @click="resetForm"><X :size="19" /></button>
      </div>
      <label>
        Nombre
        <input v-model.trim="form.name" maxlength="120" required placeholder="Ej. Movimiento que me haga bien" />
      </label>
      <div class="flex-groups__form-grid">
        <label>
          Periodo
          <select v-model="form.period">
            <option value="week">Cada semana</option>
            <option value="month">Cada mes</option>
          </select>
        </label>
        <label>
          ¿Cuántas eliges?
          <input v-model.number="form.minimumCount" type="number" min="1" :max="Math.max(1, form.memberIds.length)" required />
        </label>
      </div>
      <fieldset>
        <legend>Actividades disponibles</legend>
        <label v-for="habit in availableHabits" :key="habit.id" class="flex-groups__choice">
          <input type="checkbox" :checked="form.memberIds.includes(habit.id)" @change="toggleMember(habit.id)" />
          <span>{{ habit.name }}</span>
        </label>
      </fieldset>
      <p v-if="error" class="flex-groups__error" role="alert">{{ error }}</p>
      <div class="flex-groups__form-actions">
        <button type="button" @click="resetForm">Cancelar</button>
        <button type="submit">{{ editingId === 'new' ? 'Crear grupo' : 'Guardar cambios' }}</button>
      </div>
    </form>

    <div v-if="visibleGroups.length" class="flex-groups__list">
      <article v-for="group in visibleGroups" :key="group.id" :class="{ 'is-paused': group.status !== 'active' }">
        <span class="flex-groups__icon" aria-hidden="true"><Layers3 :size="20" /></span>
        <div>
          <strong>{{ group.name }}</strong>
          <small>Elige {{ group.minimumCount }} de {{ group.memberIds.length }} {{ flexiblePeriodLabel(group.period) }}</small>
          <em v-if="group.status !== 'active'">En pausa</em>
        </div>
        <div class="flex-groups__actions">
          <button type="button" :aria-label="`Editar ${group.name}`" @click="startEdit(group)"><Pencil :size="17" /></button>
          <button type="button" :aria-label="group.status === 'active' ? `Pausar ${group.name}` : `Retomar ${group.name}`" @click="store.toggleGroup(group.id)"><Pause v-if="group.status === 'active'" :size="17" /><Play v-else :size="17" /></button>
          <button type="button" :aria-label="`Eliminar ${group.name}`" @click="deleting = group"><Trash2 :size="17" /></button>
        </div>
      </article>
    </div>

    <p v-else-if="!formOpen" class="flex-groups__empty">Aún no hay grupos. Crea uno cuando varias actividades puedan cubrir la misma intención.</p>

    <AuroraConfirmDialog
      v-if="deleting"
      :open="Boolean(deleting)"
      title="¿Eliminar este grupo flexible?"
      :body="`Se eliminará “${deleting.name}”. Sus hábitos y registros se conservan.`"
      cancel-label="Conservar"
      confirm-label="Eliminar"
      destructive
      @cancel="deleting = null"
      @confirm="store.removeGroup(deleting.id); deleting = null"
    />
  </section>
</template>

<style scoped>
.flex-groups{display:grid;gap:18px;margin-top:32px;padding-top:28px;border-top:1px solid var(--border-subtle)}
.flex-groups__head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.flex-groups__head h2{margin:0;color:var(--text-primary);font:600 var(--h2-size)/var(--h2-line) var(--font-core);letter-spacing:var(--h2-track)}.flex-groups__head p{max-width:65ch;margin:5px 0 0;color:var(--text-secondary);font:400 var(--body-small-size)/1.5 var(--font-core);text-wrap:pretty}.flex-groups__head>button{display:inline-flex;min-height:44px;flex:none;align-items:center;gap:8px;padding-inline:16px;border:1px solid var(--border-subtle);border-radius:var(--radius-pill);color:var(--text-primary);background:var(--surface-secondary);font-weight:700;cursor:pointer}.flex-groups__head>button:disabled{cursor:not-allowed;opacity:.45}
.flex-groups__form{display:grid;gap:16px;padding:20px;border-radius:var(--radius-lg);background:var(--surface-secondary)}.flex-groups__form-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.flex-groups__form-head h3{margin:0;color:var(--text-primary);font:600 18px/1.3 var(--font-core)}.flex-groups__form-head p{max-width:60ch;margin:4px 0 0;color:var(--text-secondary);font:400 13px/1.5 var(--font-core)}.flex-groups__form-head button{display:grid;width:44px;height:44px;flex:none;place-items:center;border:0;border-radius:var(--radius-md);color:var(--text-muted);background:transparent;cursor:pointer}.flex-groups__form>label,.flex-groups__form-grid label{display:grid;gap:7px;color:var(--text-secondary);font:600 13px/1.4 var(--font-core)}.flex-groups__form input:not([type=checkbox]),.flex-groups__form select{box-sizing:border-box;width:100%;min-height:48px;padding-inline:12px;border:1px solid var(--border-strong);border-radius:var(--radius-md);outline:0;color:var(--text-primary);background:var(--surface-primary);font:400 16px/1.4 var(--font-core)}.flex-groups__form input:focus-visible,.flex-groups__form select:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}.flex-groups__form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.flex-groups__form fieldset{display:grid;max-height:18rem;overflow:auto;gap:0;margin:0;padding:0;border:0}.flex-groups__form legend{margin-bottom:6px;color:var(--text-primary);font:600 14px/1.4 var(--font-core)}.flex-groups__choice{display:flex;min-height:44px;align-items:center;gap:10px;border-bottom:1px solid var(--border-subtle);color:var(--text-secondary);font:500 14px/1.4 var(--font-core)}.flex-groups__choice input{width:20px;height:20px;accent-color:var(--action-primary)}.flex-groups__error{margin:0;color:var(--status-destructive);font:600 13px/1.4 var(--font-core)}.flex-groups__form-actions{display:flex;justify-content:flex-end;gap:8px}.flex-groups__form-actions button{min-height:44px;padding-inline:18px;border:0;border-radius:var(--radius-pill);color:var(--text-secondary);background:transparent;font-weight:700;cursor:pointer}.flex-groups__form-actions button:last-child{color:var(--action-primary-fg);background:var(--action-primary)}
.flex-groups__list{display:grid;border-block:1px solid var(--border-subtle)}.flex-groups__list article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-subtle)}.flex-groups__list article:last-child{border-bottom:0}.flex-groups__list article.is-paused{opacity:.58}.flex-groups__icon{display:grid;width:44px;height:44px;place-items:center;border-radius:var(--radius-md);color:var(--action-primary);background:color-mix(in srgb,var(--action-primary) 12%,var(--surface-secondary))}.flex-groups__list article>div:nth-child(2){display:grid;min-width:0;gap:3px}.flex-groups__list strong{overflow-wrap:anywhere;color:var(--text-primary);font:600 15px/1.35 var(--font-core)}.flex-groups__list small{color:var(--text-muted);font:400 13px/1.4 var(--font-core)}.flex-groups__list em{width:max-content;padding:4px 8px;border-radius:var(--radius-tag);color:var(--text-muted);background:var(--surface-secondary);font:normal 600 11px/1 var(--font-core)}.flex-groups__actions{display:flex}.flex-groups__actions button{display:grid;width:44px;height:44px;place-items:center;border:0;border-radius:var(--radius-md);color:var(--text-muted);background:transparent;cursor:pointer}.flex-groups__actions button:hover{color:var(--text-primary);background:var(--surface-secondary)}.flex-groups__actions button:last-child:hover{color:var(--status-destructive)}.flex-groups__empty{margin:0;padding-block:18px;border-block:1px solid var(--border-subtle);color:var(--text-muted);font:400 14px/1.5 var(--font-core)}
@media(max-width:640px){.flex-groups__head{flex-direction:column}.flex-groups__head>button{width:100%;justify-content:center}.flex-groups__form-grid{grid-template-columns:1fr}.flex-groups__list article{grid-template-columns:auto minmax(0,1fr)}.flex-groups__actions{grid-column:2;justify-content:flex-end}.flex-groups__form-actions{align-items:stretch;flex-direction:column-reverse}.flex-groups__form-actions button{width:100%}}
</style>
