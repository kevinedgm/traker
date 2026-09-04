<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MoreVertical, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-vue-next'
import { useHabitsStore } from '@stores/habits'
import { resolveHabitIcon } from '@utils/icons'
import { habitScheduleLabel } from '@/features/habits/domain.js'
import CreateHabitModal from '@components/habits/CreateHabitModal.vue'
import FlexibleGroupsPanel from '@components/habits/FlexibleGroupsPanel.vue'
import AuroraConfirmDialog from '@components/aurora/surfaces/AuroraConfirmDialog.vue'
import SettingsShell from '@components/settings/SettingsShell.vue'

const router = useRouter()
const store = useHabitsStore()
const editingHabit = ref(null)
const deletingHabit = ref(null)
const showCreate = ref(false)
const feedback = ref(null)
let feedbackTimer = null

const orderedHabits = computed(() => [...store.habits].sort((a, b) => {
  if (a.isActive !== b.isActive) return a.isActive === false ? 1 : -1
  return a.name.localeCompare(b.name, 'es')
}))

const activeCount = computed(() => store.habits.filter(habit => habit.isActive !== false).length)

function toggleActive(habit) {
  const previous = habit.isActive !== false
  store.updateHabit(habit.id, { isActive: !previous })
  feedback.value = { habitId: habit.id, previous, text: previous ? `${habit.name} quedó en pausa.` : `${habit.name} está activo otra vez.` }
  window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => { feedback.value = null }, 5000)
}

function undoToggle() {
  if (!feedback.value) return
  store.updateHabit(feedback.value.habitId, { isActive: feedback.value.previous })
  feedback.value = null
  window.clearTimeout(feedbackTimer)
}

onBeforeUnmount(() => window.clearTimeout(feedbackTimer))

function confirmDelete() {
  if (!deletingHabit.value) return
  store.removeHabit(deletingHabit.value.id)
  deletingHabit.value = null
}
</script>

<template>
  <SettingsShell title="Administrar hábitos" :subtitle="`${activeCount} activos · ${store.habits.length} en total`" back-to="/settings" wide>
    <template #actions>
      <button class="habit-admin__create" type="button" @click="showCreate = true">
        <Plus :size="18" :stroke-width="2" aria-hidden="true" />
        Nuevo hábito
      </button>
    </template>

    <TransitionGroup v-if="orderedHabits.length" tag="section" name="habit-list" class="habit-admin__list" aria-label="Hábitos">
      <article
        v-for="habit in orderedHabits"
        :key="habit.id"
        class="habit-admin__row"
        :class="{ 'habit-admin__row--paused': habit.isActive === false }"
        :style="{ '--habit-color': habit.color }"
      >
        <button
          class="habit-admin__identity"
          type="button"
          :aria-label="`Abrir detalle de ${habit.name}`"
          @click="router.push(`/habit/${habit.id}`)"
        >
          <span class="habit-admin__icon" aria-hidden="true">
            <component :is="resolveHabitIcon(habit.icon)" :size="22" :stroke-width="1.8" />
          </span>
          <span class="habit-admin__copy">
            <strong>{{ habit.name }}</strong>
            <small>{{ habit.minimumVersion || 'Sin versión mínima' }} · {{ habitScheduleLabel(habit) }}</small>
          </span>
          <span class="habit-admin__status">{{ habit.isActive === false ? 'Pausado' : 'Activo' }}</span>
        </button>

        <div class="habit-admin__actions" :aria-label="`Acciones para ${habit.name}`">
          <button type="button" title="Editar" :aria-label="`Editar ${habit.name}`" @click="editingHabit = habit">
            <Pencil :size="17" aria-hidden="true" />
          </button>
          <details class="habit-admin__menu">
            <summary :aria-label="`Más acciones para ${habit.name}`"><MoreVertical :size="18" aria-hidden="true" /></summary>
            <div>
              <button type="button" @click="toggleActive(habit)"><Play v-if="habit.isActive === false" :size="17" aria-hidden="true" /><Pause v-else :size="17" aria-hidden="true" />{{ habit.isActive === false ? 'Retomar' : 'Pausar' }}</button>
              <button class="habit-admin__delete" type="button" @click="deletingHabit = habit"><Trash2 :size="17" aria-hidden="true" />Eliminar</button>
            </div>
          </details>
        </div>
      </article>
    </TransitionGroup>

    <section v-else class="habit-admin__empty">
      <span aria-hidden="true"><Plus :size="24" /></span>
      <h2>Aún no hay hábitos</h2>
      <p>Crea uno y define la versión más pequeña que contará incluso en un día difícil.</p>
      <button type="button" @click="showCreate = true">Crear mi primer hábito</button>
    </section>

    <FlexibleGroupsPanel :habits="store.habits" />

    <CreateHabitModal v-if="showCreate" @close="showCreate = false" />
    <CreateHabitModal v-if="editingHabit" :habit="editingHabit" @close="editingHabit = null" />

    <Transition name="habit-feedback">
      <div v-if="feedback" class="habit-admin__feedback" role="status">
        <span>{{ feedback.text }}</span><button type="button" @click="undoToggle">Deshacer</button>
      </div>
    </Transition>

    <AuroraConfirmDialog
      v-if="deletingHabit"
      :open="Boolean(deletingHabit)"
      title="¿Eliminar este hábito?"
      :body="`Se eliminarán ${deletingHabit.name} y todos sus registros. Puedes pausarlo si quieres conservar el historial.`"
      cancel-label="Conservar"
      :pause-label="deletingHabit.isActive === false ? undefined : 'Pausar'"
      confirm-label="Eliminar"
      destructive
      @cancel="deletingHabit = null"
      @pause="toggleActive(deletingHabit); deletingHabit = null"
      @confirm="confirmDelete"
    />
  </SettingsShell>
</template>

<style scoped>
.habit-admin__create,.habit-admin__empty button { display:inline-flex; min-height:48px; align-items:center; justify-content:center; gap:var(--space-2); padding:0 var(--space-5); border:0; border-radius:var(--radius-pill); background:var(--action-primary); color:var(--action-primary-fg); font:600 var(--text-sm)/1 var(--font-core); cursor:pointer; }
.habit-admin__list { display:grid; border-block:1px solid var(--border-subtle); }
.habit-admin__row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--space-3); padding:var(--space-3) 0; border-bottom:1px solid var(--border-subtle); transition:opacity var(--dur-fast) var(--ease-calm),transform var(--dur-view) var(--ease-enter); }
.habit-admin__row:last-child { border-bottom:0; }
.habit-admin__row--paused .habit-admin__copy strong { color:var(--text-secondary); }
.habit-admin__identity { display:grid; grid-template-columns:48px minmax(0,1fr) auto; min-width:0; align-items:center; gap:var(--space-3); padding:var(--space-2); border:0; border-radius:var(--radius-md); background:transparent; color:inherit; text-align:start; cursor:pointer; }
.habit-admin__identity:hover { background:color-mix(in srgb,var(--habit-color) 7%,transparent); }
.habit-admin__icon { display:grid; width:44px; height:44px; place-items:center; border-radius:var(--radius-md); background:color-mix(in srgb,var(--habit-color) 14%,var(--surface-secondary)); color:var(--habit-color); transition:background var(--dur-base) var(--ease-calm),color var(--dur-base) var(--ease-calm),transform var(--dur-fast) var(--ease-calm); }
.habit-admin__identity:active .habit-admin__icon { transform:scale(.94); }
.habit-admin__copy { min-width:0; }
.habit-admin__copy strong,.habit-admin__copy small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.habit-admin__copy strong { color:var(--text-primary); font:600 var(--body-size)/1.3 var(--font-core); }
.habit-admin__copy small { margin-top:3px; color:var(--text-muted); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.habit-admin__status { min-height:28px; padding:7px var(--space-3); border:1px solid color-mix(in srgb,var(--habit-color) 24%,var(--border-subtle)); border-radius:var(--radius-tag); color:var(--text-secondary); font:600 var(--text-xs)/1 var(--font-core); }
.habit-admin__actions { position:relative; display:flex; gap:var(--space-1); }
.habit-admin__actions > button,.habit-admin__menu summary { display:grid; width:44px; height:44px; place-items:center; border:1px solid transparent; border-radius:var(--radius-md); background:transparent; color:var(--text-muted); cursor:pointer; list-style:none; }
.habit-admin__menu summary::-webkit-details-marker { display:none; }
.habit-admin__menu > div { position:absolute; z-index:5; inset-inline-end:0; top:48px; display:grid; min-width:150px; padding:var(--space-2); border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-primary); box-shadow:var(--elev-3); transform-origin:top right; animation:habit-menu-in var(--dur-base) var(--ease-enter) both; }
.habit-admin__menu > div button { display:flex; min-height:44px; align-items:center; gap:var(--space-2); padding-inline:var(--space-3); border:0; border-radius:var(--radius-sm); background:transparent; color:var(--text-secondary); cursor:pointer; }
.habit-admin__actions button:hover { border-color:var(--border-subtle); background:var(--surface-secondary); color:var(--text-primary); }
.habit-admin__actions .habit-admin__delete:hover { color:var(--status-destructive); }
.habit-admin__feedback { position:fixed; z-index:20; inset-inline:var(--space-4); bottom:var(--nav-clearance); display:flex; width:min(calc(100% - 2 * var(--space-4)),28rem); min-height:52px; margin-inline:auto; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-2) var(--space-3) var(--space-2) var(--space-4); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); color:var(--text-primary); background:var(--surface-primary); box-shadow:var(--elev-4); }
.habit-admin__feedback button { min-height:44px; border:0; color:var(--action-primary); background:transparent; font-weight:700; cursor:pointer; }
.habit-list-move { transition:transform var(--dur-panel) var(--ease-enter); }
.habit-list-enter-active,.habit-list-leave-active { transition:opacity var(--dur-fast) var(--ease-calm),transform var(--dur-view) var(--ease-enter); }
.habit-list-enter-from,.habit-list-leave-to { opacity:0; transform:translateY(8px); }
.habit-feedback-enter-active { transition:opacity var(--dur-base) var(--ease-calm),transform var(--dur-panel) var(--ease-enter),filter var(--dur-panel) var(--ease-enter); }
.habit-feedback-leave-active { transition:opacity var(--dur-fast) var(--ease-calm),transform var(--dur-fast) var(--ease-calm); }
.habit-feedback-enter-from { opacity:0; transform:translateY(12px); filter:blur(4px); }
.habit-feedback-leave-to { opacity:0; transform:translateY(6px); }
@keyframes habit-menu-in { from { opacity:0; transform:translateY(-4px) scale(.98); clip-path:inset(0 0 20% 0 round var(--radius-md)); } }
.habit-admin__empty { display:grid; min-height:22rem; place-items:center; align-content:center; text-align:center; }
.habit-admin__empty > span { display:grid; width:56px; height:56px; margin-bottom:var(--space-5); place-items:center; border-radius:var(--radius-lg); background:color-mix(in srgb,var(--action-primary) 12%,transparent); color:var(--action-primary); }
.habit-admin__empty h2 { margin:0; color:var(--text-primary); font:600 var(--h2-size)/var(--h2-line) var(--font-core); }
.habit-admin__empty p { max-width:60ch; margin:var(--space-2) 0 var(--space-5); color:var(--text-secondary); font:400 var(--body-size)/var(--body-line) var(--font-core); text-wrap:pretty; }
@media (max-width:700px) {
  .habit-admin__create { width:100%; }
  .habit-admin__row { grid-template-columns:1fr; }
  .habit-admin__status { display:none; }
  .habit-admin__actions { justify-content:flex-end; margin-top:calc(-1 * var(--space-2)); padding-inline-end:var(--space-2); }
}
/* ══ DESKTOP (1024px+): two columns of habit cards instead of one
   full-width row stretched across the whole 68rem shell — a list of
   5-6 habits shouldn't need a 1000px-wide single-file line. ══ */
@media (min-width:1024px) {
  .habit-admin__list { grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:var(--space-3) var(--space-5); border-block:0; }
  .habit-admin__row { border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:var(--space-3) var(--space-4); }
}
@media (prefers-reduced-motion:reduce) {
  .habit-admin__menu > div { animation:habit-menu-fade var(--dur-fast) ease-out both; }
  .habit-list-enter-from,.habit-list-leave-to,.habit-feedback-enter-from,.habit-feedback-leave-to { transform:none; filter:none; }
  .habit-admin__identity:active .habit-admin__icon { transform:none; }
}
@keyframes habit-menu-fade { from { opacity:0; } }
</style>
