<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
  Trash2,
} from 'lucide-vue-next'
import LogModal from '@/components/habits/LogModal.vue'
import { resolveHabitIcon } from '@utils/icons'
import { normalizeHabitDuration, useHabitsStore } from '@stores/habits'
import { habitScheduleLabel } from '@/features/habits/domain.js'
import { useCopy } from '@/composables/useCopy'
import { useToast } from '@/composables/useToast'
import {
  AuroraButton,
  AuroraConfirmDialog,
  AuroraFlexibleCalendar,
  AuroraHabitIcon,
  AuroraIconButton,
  AuroraInput,
  AuroraMenu,
  AuroraModal,
  AuroraStatusTag,
  AuroraTopBar,
  AuroraWeeklyPath,
} from '@components/aurora/index.js'

const route = useRoute()
const router = useRouter()
const store = useHabitsStore()
const { getPhrase } = useCopy()
const toast = useToast()

const habit = computed(() => store.habits.find(item => item.id === route.params.id))
const currentDay = computed(() => habit.value ? Math.max(1, Number(store.getCurrentDay(habit.value)) || 1) : 0)
const selectedDay = ref(null)
const showOptions = ref(false)
const showEdit = ref(false)
const showDelete = ref(false)
const editName = ref('')
const editDuration = ref('')
const growthShape = ref('')
let growthFrame
let growthTime = 0

const levelToState = { 0:'skipped', 1:'partial', 2:'partial', 3:'complete', 4:'adapted' }
const legend = [
  { status:'complete', label:'Sí' },
  { status:'partial', label:'A medias' },
  { status:'skipped', label:'No' },
  { status:'adapted', label:'Descanso consciente' },
  { status:'none', label:'Sin registro' },
]
const menuItems = computed(() => [
  { value:'edit', label:'Editar hábito', icon:Pencil },
  { value:'pause', label:habit.value?.isActive === false ? 'Retomar hábito' : 'Pausar hábito', icon:habit.value?.isActive === false ? PlayCircle : PauseCircle },
  { value:'delete', label:'Eliminar hábito', icon:Trash2, destructive:true },
])

const week = computed(() => {
  if (!habit.value) return { kept:0, window:7 }
  const start = Math.max(1, currentDay.value - 6)
  let kept = 0
  for (let day = start; day <= currentDay.value; day++) {
    const level = habit.value.logs?.[day]?.level
    if (level >= 1 && level <= 4) kept++
  }
  return { kept, window:currentDay.value - start + 1 }
})
const recentDays = computed(() => {
  if (!habit.value) return []
  const start = Math.max(1, currentDay.value - 6)
  return Array.from({ length:currentDay.value - start + 1 }, (_, index) => {
    const day = start + index
    const level = habit.value.logs?.[day]?.level
    return {
      label:day === currentDay.value ? 'Hoy' : `D${day}`,
      state:level === undefined ? 'none' : levelToState[level],
      today:day === currentDay.value,
    }
  })
})
const calendarDays = computed(() => habit.value
  ? Array.from({ length:habit.value.duration }, (_, index) => {
      const day = index + 1
      const level = habit.value.logs?.[day]?.level
      return {
        day,
        state:level === undefined ? 'none' : levelToState[level],
        today:day === currentDay.value,
        future:day > currentDay.value,
      }
    })
  : [])
const todayLogged = computed(() => Boolean(habit.value?.logs?.[currentDay.value]))
const primaryLabel = computed(() => habit.value?.isActive === false
  ? 'Retomar y registrar hoy'
  : todayLogged.value
    ? 'Actualizar registro de hoy'
    : 'Registrar cómo estuvo hoy')
const dominant = computed(() => {
  if (!habit.value) return null
  const counts = { yes:0, partial:0, no:0 }
  Object.entries(habit.value.logs ?? {}).forEach(([day, log]) => {
    if (Number(day) > currentDay.value) return
    const bucket = log.level === 3 ? 'yes' : [1, 2].includes(log.level) ? 'partial' : 'no'
    counts[bucket]++
  })
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  if (!total) return null
  const [level, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  const labels = { yes:'Sí', partial:'A medias', no:'No o descanso consciente' }
  return { label:labels[level], ratio:Math.round(count / total * 100) }
})

function generateGrowth(time) {
  const cols = 30
  const rows = 14
  const centerX = (cols - 1) / 2
  const centerY = (rows - 1) / 2
  return Array.from({ length:rows }, (_, y) => Array.from({ length:cols }, (_, x) => {
    const dx = (x - centerX) / centerX
    const dy = (y - centerY) / centerY
    const angle = Math.atan2(dy, dx)
    const distance = Math.sqrt(dx * dx + dy * dy)
    const breathe = .72 + .22 * Math.sin(time * .7)
    const wave = .18 * Math.sin(angle * 2.5 + time * 1.1) + .12 * Math.sin(angle * 4.2 - time * .85) + .09 * Math.cos(distance * 6 - time * 1.3)
    const falloff = Math.max(0, 1 - distance / ((breathe + wave) * 1.05))
    const density = Math.pow(falloff, 1.4)
    const threshold = .12 + .08 * Math.sin(time * .5 + x * .07 + y * .06)
    const rawNoise = (Math.sin(x * 12.9898 + y * 78.233 + 7) * 43758.5453) % 1
    const noise = rawNoise < 0 ? rawNoise + 1 : rawNoise
    if (density > threshold) return noise < .35 + density * .5 ? '1' : '0'
    if (density > threshold * .4) return noise < .25 ? (noise < .12 ? '1' : '0') : ' '
    return ' '
  }).join('')).join('\n')
}
function drawGrowth() {
  growthShape.value = generateGrowth(growthTime)
  growthTime += .03
  growthFrame = window.requestAnimationFrame(drawGrowth)
}
onMounted(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) growthShape.value = generateGrowth(0)
  else drawGrowth()
})
onBeforeUnmount(() => {
  window.cancelAnimationFrame(growthFrame)
})

function selectToday() {
  if (!habit.value) return
  if (habit.value.isActive === false) store.updateHabit(habit.value.id, { isActive:true })
  selectedDay.value = currentDay.value
}
function handleLogSaved(result) {
  if (!habit.value) return
  const event = result.status === 'not_done' || result.status === 'conscious_skip'
    ? 'habit_skipped'
    : result.minimumUsed ? 'minimal_version' : result.status === 'done' ? 'habit_completed' : 'habit_partial'
  const habitName = String(habit.value.name ?? '').trim() || 'el hábito'
  toast.show({ message: getPhrase(event, { habit: habit.value, vars: { habitName } }).text })
}
function openEdit() {
  if (!habit.value) return
  editName.value = habit.value.name
  editDuration.value = String(habit.value.duration)
  showEdit.value = true
}
function saveEdit() {
  if (!habit.value || editName.value.trim().length < 2) return
  store.updateHabit(habit.value.id, {
    name:editName.value.trim(),
    duration:normalizeHabitDuration(editDuration.value, habit.value.duration),
  })
  showEdit.value = false
  toast.show({ message: 'Cambios guardados' })
}
function togglePause() {
  if (!habit.value) return
  const next = habit.value.isActive === false
  store.updateHabit(habit.value.id, { isActive:next })
  if (next) {
    const habitName = String(habit.value.name ?? '').trim() || 'el hábito'
    toast.show({ message: getPhrase('habit_returned', { habit: habit.value, vars: { habitName } }).text })
  } else {
    const habitName = String(habit.value.name ?? '').trim() || 'el hábito'
    toast.show({ message: getPhrase('habit_paused', { habit: habit.value, vars: { habitName } }).text })
  }
}
function onMenuSelect(value) {
  showOptions.value = false
  if (value === 'edit') openEdit()
  else if (value === 'pause') togglePause()
  else if (value === 'delete') showDelete.value = true
}
function deleteHabit() {
  if (!habit.value) return
  store.removeHabit(habit.value.id)
  router.replace({ name:'dashboard' })
}
function pauseFromDelete() {
  showDelete.value = false
  if (habit.value?.isActive !== false) togglePause()
}
</script>

<template>
  <div v-if="!habit" class="not-found">
    <p>Hábito no encontrado</p>
    <AuroraButton variant="ghost" @click="router.push({name:'dashboard'})">Volver</AuroraButton>
  </div>

  <main v-else class="detail" :style="{'--hc':habit.color}">
    <div class="detail__scroll">
      <div class="detail__inner">
        <AuroraTopBar title="" back @back="router.push({name:'dashboard'})">
          <template #actions>
            <div class="detail__menu-wrap">
              <AuroraIconButton label="Opciones del hábito" :active="showOptions" @click="showOptions=!showOptions">
                <MoreHorizontal :size="20" :stroke-width="1.75" aria-hidden="true" />
              </AuroraIconButton>
              <AuroraMenu :open="showOptions" :items="menuItems" align="right" @select="onMenuSelect" @close="showOptions=false" />
            </div>
          </template>
        </AuroraTopBar>

        <div class="detail__layout">
          <div class="detail__column">
            <section class="detail__identity">
              <AuroraHabitIcon :tone="habit.color" :size="52">
                <component :is="resolveHabitIcon(habit.icon)" :size="26" :stroke-width="1.75" aria-hidden="true" />
              </AuroraHabitIcon>
              <div>
                <h1>{{habit.name}}</h1>
                <p><span>{{habitScheduleLabel(habit)}} · {{habit.duration}} días</span><AuroraStatusTag :status="habit.isActive===false?'paused':'started'" :label="habit.isActive===false?'Pausado':'En camino'" /></p>
              </div>
            </section>

            <button class="detail__primary" type="button" @click="selectToday">
              <span>{{primaryLabel}}</span><span>Día {{currentDay}}</span>
            </button>

            <figure class="detail__growth" role="img" :aria-label="`Forma de crecimiento del hábito: día ${currentDay} de ${habit.duration}.`">
              <div aria-hidden="true"><pre>{{growthShape}}</pre></div>
              <figcaption><span>{{dominant?`Predomina ${dominant.label.toLowerCase()} · ${dominant.ratio}%`:'Aún sin registros'}}</span><span>Día {{currentDay}} de {{habit.duration}}</span></figcaption>
            </figure>

            <section class="detail__trajectory">
              <div><h2>Tu trayectoria reciente</h2><p>{{week.kept}} de {{week.window}} días tienen registro. Los días flexibles también cuentan.</p></div>
              <AuroraWeeklyPath :days="recentDays" />
            </section>
          </div>

          <section class="detail__register">
            <div><h2>Tu registro</h2><p>Toca un día para registrar cómo estuvo.</p></div>
            <AuroraFlexibleCalendar :days="calendarDays" :selected="selectedDay" @select="day=>selectedDay=day" />
            <div class="detail__legend"><AuroraStatusTag v-for="item in legend" :key="item.status" :status="item.status" :label="item.label" /></div>
          </section>
        </div>
      </div>
    </div>

    <LogModal v-if="selectedDay!==null" :habit="habit" :day="selectedDay" @saved="handleLogSaved" @close="selectedDay=null" />

    <AuroraModal :open="showEdit" title="Editar hábito" @close="showEdit=false">
      <div class="detail__edit-form"><AuroraInput v-model="editName" label="Nombre del hábito"/><AuroraInput v-model="editDuration" label="Duración (días)" type="number"/></div>
      <template #footer><AuroraButton variant="ghost" @click="showEdit=false">Cancelar</AuroraButton><AuroraButton @click="saveEdit">Guardar</AuroraButton></template>
    </AuroraModal>

    <AuroraConfirmDialog
      :open="showDelete"
      title="¿Eliminar este hábito?"
      body="También se eliminarán sus registros. Si sólo necesitas espacio, puedes pausarlo y retomarlo después."
      confirm-label="Eliminar"
      cancel-label="Conservar"
      pause-label="Pausar"
      destructive
      @confirm="deleteHabit"
      @pause="pauseFromDelete"
      @cancel="showDelete=false"
    />
  </main>
</template>

<style scoped>
/* impeccable-disable design-system-font-size -- escala puntual reproducida del Habit Detail.html aprobado */
.not-found{display:flex;min-height:100svh;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:var(--text-muted);font:400 15px/1.5 var(--font-core)}
.detail{position:relative;min-height:100svh;background:var(--background-base)}
.detail::before{position:fixed;z-index:20;inset:0 0 auto;height:2px;background:var(--hc);content:''}
.detail__scroll{min-height:100svh;padding:0 20px 40px}
.detail__inner{display:flex;width:100%;max-width:none;margin-inline:auto;flex-direction:column;gap:24px}
.detail__menu-wrap{position:relative}
.detail__layout{display:flex;flex-direction:column;gap:24px}
.detail__column{display:flex;flex-direction:column;gap:24px}
.detail__identity{display:flex;align-items:center;gap:14px}
.detail__identity>div{min-width:0}
.detail__identity h1{margin:0;color:var(--text-primary);font:600 24px/1.2 var(--font-core);letter-spacing:-.02em}
.detail__identity p{display:flex;margin:4px 0 0;align-items:center;gap:8px;color:var(--text-muted);font:500 13px/1 var(--font-core)}
.detail__primary{display:flex;min-height:56px;padding:0 20px;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:var(--radius-pill);background:var(--hc);color:#08111A;font:600 15px/1 var(--font-core);cursor:pointer}
.detail__primary span:last-child{opacity:.72;font-variant-numeric:tabular-nums}
.detail__growth{display:flex;margin:0;padding:18px 0;flex-direction:column;gap:10px;border-block:1px solid var(--border-subtle)}
.detail__growth>div{display:grid;min-height:120px;overflow:hidden;place-items:center}
.detail__growth pre{margin:0;color:var(--hc);font:400 6.5px/1.05 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.4px;white-space:pre;opacity:.9;user-select:none}
.detail__growth figcaption{display:flex;align-items:baseline;justify-content:space-between;gap:12px;color:var(--text-muted);font:400 12px/1.4 var(--font-core)}
.detail__growth figcaption span:first-child{color:var(--hc);font-weight:600}
.detail__trajectory,.detail__register{display:flex;flex-direction:column;gap:12px}
.detail__trajectory h2,.detail__register h2{margin:0;color:var(--text-primary);font:600 17px/1.3 var(--font-core)}
.detail__register h2{font-size:20px}
.detail__trajectory p{max-width:38ch;margin:4px 0 0;color:var(--text-secondary);font:400 14px/1.5 var(--font-core)}
.detail__register>div:first-child p{margin:2px 0 0;color:var(--text-muted);font:400 13px/1.5 var(--font-core)}
.detail__register{gap:14px}
.detail__legend{display:flex;padding-top:14px;flex-wrap:wrap;gap:8px 16px;border-top:1px solid var(--border-subtle)}
.detail__edit-form{display:flex;flex-direction:column;gap:14px}
@media(min-width:768px){
  .detail__scroll{padding:0 64px 48px}
  .detail__inner{max-width:640px}
}
@media(min-width:1024px){
  .detail__scroll{padding:0 48px 48px}
  .detail__inner{max-width:1080px}
  .detail__layout{display:grid;margin-top:4px;grid-template-columns:340px minmax(0,1fr);gap:40px;align-items:start}
}
</style>
