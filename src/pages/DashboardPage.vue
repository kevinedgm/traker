<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, CheckCircle2, Cloud, HeartPulse, LockKeyhole, Moon, Plus, Sparkles, UserRound } from 'lucide-vue-next'
import { useHabitsStore } from '@stores/habits'
import { useCheckinsStore } from '@stores/checkins'
import { useDayClosuresStore } from '@stores/dayClosures'
import { useRewardsStore } from '@stores/rewards'
import { useFlexibleGroupsStore } from '@stores/flexibleGroups'
import { useAuthStore } from '@stores/auth'
import { useSettingsStore } from '@stores/settings'
import { useGoalsStore } from '@stores/goals'
import { features } from '@/config/features.js'
import { resolveHabitIcon } from '@utils/icons'
import { useCopy } from '@/composables/useCopy'
import { useToast } from '@/composables/useToast'
import CreateHabitModal from '@components/habits/CreateHabitModal.vue'
import LogModal from '@components/habits/LogModal.vue'
import DailyCheckinSheet from '@components/checkins/DailyCheckinSheet.vue'
import DayCloseModal from '@components/habits/DayCloseModal.vue'
import FlexibleOptions from '@components/habits/FlexibleOptions.vue'
import TodayOpening from '@components/today/TodayOpening.vue'
import { checkinEnergyLabel, checkinLoadLabel } from '@/features/checkins/domain.js'
import { habitScheduleLabel, localDateKey } from '@/features/habits/domain.js'
import { closureCopy, summarizeDay } from '@/features/today/domain.js'
import { buildFlexibleAgenda } from '@/features/flexibleGroups/domain.js'
import { composeTodayOpening } from '@/features/dailyOpening/domain.js'
import {
  AuroraButton,
  AuroraGoalFocus,
  AuroraHabitList,
  AuroraIconButton,
  AuroraReturnCard,
  AuroraSurface,
  AuroraTopBar,
  AuroraWeeklyPath,
} from '@components/aurora/index.js'

const router = useRouter()
const route = useRoute()
const store = useHabitsStore()
const checkinsStore = useCheckinsStore()
const dayClosuresStore = useDayClosuresStore()
const rewardsStore = useRewardsStore()
const flexibleGroupsStore = useFlexibleGroupsStore()
const goalsStore = features.goals ? useGoalsStore() : null
const auth = useAuthStore()
const settings = useSettingsStore()
const { getPhrase } = useCopy()
const toast = useToast()
const showCreate = ref(false)
const selectedHabit = ref(null)
const showCheckin = ref(false)
const showDayClose = ref(false)
const recentlyUnlockedClaims = ref([])

onMounted(() => {
  if (goalsStore && !goalsStore.loaded) goalsStore.load().catch(() => {})
})

const activeHabits = computed(() => store.habits.filter(habit => habit.isActive !== false))
const flexibleAgenda = computed(() => buildFlexibleAgenda(flexibleGroupsStore.activeGroups, activeHabits.value))
const habits = computed(() => activeHabits.value.filter(habit => !flexibleAgenda.value.memberIds.has(habit.id) && store.isScheduledForDate(habit)))
const userName = computed(() => {
  if (typeof settings.displayName === 'string' && settings.displayName.trim()) return settings.displayName.trim()
  const identity = auth.cloudUser?.user_metadata?.full_name ?? auth.cloudUser?.email
  return typeof identity === 'string' && identity.trim() ? identity.split('@')[0] : null
})
const greeting = computed(() => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
})
const greetingTitle = computed(() => `${greeting.value}${userName.value ? `, ${userName.value}` : ''}`)
const dateLabel = computed(() => {
  const value = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return value.charAt(0).toUpperCase() + value.slice(1)
})
const todayDate = computed(() => localDateKey())
const daySummary = computed(() => summarizeDay(activeHabits.value, new Date(), {
  excludedHabitIds: flexibleAgenda.value.memberIds,
  flexibleGroups: flexibleGroupsStore.activeGroups,
}))
const todayClosure = computed(() => dayClosuresStore.forDate(todayDate.value))
const dayIsResolved = computed(() => Boolean(todayClosure.value)
  || (daySummary.value.isSufficient && Number(daySummary.value.scheduled ?? 0) > 0))
const dayCloseSummary = computed(() => {
  if (!todayClosure.value) return daySummary.value
  return {
    localDate: todayClosure.value.localDate,
    ...todayClosure.value.summary,
    state: todayClosure.value.status,
    isSufficient: todayClosure.value.status === 'sufficient',
  }
})
const closureNeedsUpdate = computed(() => Boolean(todayClosure.value) && [
  'scheduled',
  'registered',
  'built',
  'complete',
  'adapted',
].some(field => Number(todayClosure.value.summary?.[field] ?? 0) !== Number(daySummary.value[field] ?? 0))
  || Boolean(todayClosure.value && todayClosure.value.status !== daySummary.value.state)
  || Boolean(todayClosure.value && JSON.stringify(todayClosure.value.summary?.flexibleGroups ?? []) !== JSON.stringify(daySummary.value.flexibleGroups ?? [])))
const dayCloseCopy = computed(() => closureCopy(dayCloseSummary.value))
const dayClaims = computed(() => rewardsStore.availableClaims.filter(claim => claim.periodKey === `day:${todayDate.value}`))
const visibleDayClaims = computed(() => recentlyUnlockedClaims.value.length ? recentlyUnlockedClaims.value : dayClaims.value)
const todayCheckin = computed(() => checkinsStore.forDate(todayDate.value))
const checkinSummary = computed(() => {
  const checkin = todayCheckin.value
  if (!checkin) return 'Carga y energía opcionales. Tu día no se califica.'
  const pieces = []
  if (checkin.loadFeeling) pieces.push(`Carga ${checkinLoadLabel(checkin.loadFeeling).toLowerCase()}`)
  if (checkin.energy) pieces.push(`energía ${checkinEnergyLabel(checkin.energy).toLowerCase()}`)
  return pieces.length ? pieces.join(' · ') : 'Contexto guardado sin convertirlo en una puntuación.'
})
const checkinSyncLabel = computed(() => {
  const checkin = todayCheckin.value
  if (!checkin || checkin.syncScope === 'local_only') return 'Sólo en este dispositivo'
  if (checkin.syncStatus === 'synced') return 'Sincronizado con tu cuenta'
  if (checkin.syncStatus === 'error') return 'No se pudo sincronizar; sigue guardado aquí'
  return 'Pendiente de sincronizar'
})

function todayLog(habit) {
  return habit.logs?.[store.getCurrentDay(habit)]
}

const isReturning = computed(() => {
  const hasPreviousProgress = activeHabits.value.some(habit => Object.keys(habit.logs ?? {}).length > 0)
  if (!hasPreviousProgress) return false
  return activeHabits.value.every(habit => {
    const currentDay = Number(store.getCurrentDay(habit)) || 1
    const recentStart = Math.max(1, currentDay - 2)
    return !Object.keys(habit.logs ?? {}).some(day => Number(day) >= recentStart && Number(day) <= currentDay)
  })
})

const focusedGoal = computed(() => {
  if (!goalsStore) return null
  const runningGoal = goalsStore.runningSession
    ? goalsStore.activeGoals.find(goal => goal.id === goalsStore.runningSession.goalId)
    : null
  if (runningGoal && goalsStore.actionForGoal(runningGoal.id)) return runningGoal
  return goalsStore.focusedGoals.find(goal => goalsStore.actionForGoal(goal.id))
    ?? goalsStore.activeGoals.find(goal => goalsStore.actionForGoal(goal.id))
    ?? null
})
const focusedGoalAction = computed(() => focusedGoal.value ? goalsStore.actionForGoal(focusedGoal.value.id) : null)
const horizonLabels = { short: 'Corto plazo', medium: 'Mediano plazo', long: 'Largo plazo' }
const focusedGoalTitle = computed(() => String(focusedGoal.value?.title ?? '').trim() || 'Meta sin título')
const focusedActionTitle = computed(() => String(focusedGoalAction.value?.title ?? '').trim() || 'Siguiente paso sin título')
const focusedGoalState = computed(() => {
  if (goalsStore?.runningSession?.goalId === focusedGoal.value?.id) return 'active'
  return focusedGoalAction.value?.status === 'blocked' ? 'blocked' : 'available'
})
const focusedGoalReason = computed(() => focusedGoalState.value === 'blocked'
  ? 'elige una versión que puedas iniciar hoy.'
  : undefined)
const todayOpening = computed(() => composeTodayOpening({
  localDate: todayDate.value,
  personalReason: focusedGoal.value?.personalWhy,
}))
const goalIsPrimary = computed(() => Boolean(focusedGoal.value && focusedGoalAction.value))
const directions = computed(() => {
  if (!goalsStore) return []
  const goals = goalsStore.activeGoals ?? []
  return ['short', 'medium', 'long']
    .map(horizon => goals.find(goal => goal.horizon === horizon))
    .filter(Boolean)
    .slice(0, 2)
})
const hasPrimaryContent = computed(() => isReturning.value
  || dayIsResolved.value
  || goalIsPrimary.value
  || directions.value.length > 0
  || Boolean(goalsStore?.error))

function openFocusedGoal() {
  if (focusedGoal.value) router.push(`/goals/${focusedGoal.value.id}`)
}
function startFocusedGoal() {
  if (!focusedGoal.value) return
  router.push(focusedGoalState.value === 'blocked'
    ? `/goals/${focusedGoal.value.id}`
    : `/goals/${focusedGoal.value.id}/session`)
}
async function retryGoals() {
  if (!goalsStore || goalsStore.loading) return
  await goalsStore.load().catch(() => {})
}

function formatReminder(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : 'Todo el día'
}
function habitState(log) {
  if (log?.level === 3) return 'complete'
  if ([1, 2].includes(log?.level)) return 'adapted'
  if (log?.level === 4) return 'paused'
  if (log?.level === 0) return 'postponed'
  return 'pending'
}
const auroraHabits = computed(() => habits.value.map(habit => {
  return {
    id: habit.id,
    name: String(habit.name ?? '').trim() || 'Hábito sin nombre',
    detail: `${formatReminder(habit.reminder)} · ${habitScheduleLabel(habit)}${habit.goalIds?.length ? ` · ${habit.goalIds.length} ${habit.goalIds.length === 1 ? 'meta' : 'metas'}` : ''}`,
    icon: resolveHabitIcon(habit.icon),
    tone: habit.color,
    state: habitState(todayLog(habit)),
  }
}))

function weeklyState(log, isToday) {
  if (log?.level === 3) return 'complete'
  if ([1, 2].includes(log?.level)) return 'partial'
  if (log?.level === 4) return 'skipped'
  if (log?.level === 0) return 'postponed'
  return isToday ? 'pending' : 'none'
}
const weeklyPath = computed(() => {
  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const today = new Date().getDay()
  return Array.from({ length: 7 }, (_, index) => {
    const offset = index - 6
    const states = activeHabits.value.map(habit => {
      const day = (Number(store.getCurrentDay(habit)) || 1) + offset
      return day > 0 ? weeklyState(habit.logs?.[day], offset === 0) : 'none'
    })
    const registeredStates = states.filter(state => !['none', 'pending'].includes(state))
    let state = offset === 0 ? 'pending' : 'none'
    if (registeredStates.includes('complete')) state = 'complete'
    else if (registeredStates.includes('partial')) state = 'partial'
    else if (registeredStates.includes('postponed')) state = 'postponed'
    else if (registeredStates.includes('skipped')) state = 'skipped'
    return {
      label: offset === 0 ? 'Hoy' : labels[(today + offset + 7) % 7],
      state: activeHabits.value.length ? state : 'none',
      today: offset === 0,
    }
  })
})
const weeklyRegistered = computed(() => weeklyPath.value.filter(day => !['none', 'pending'].includes(day.state)).length)
const weeklySummary = computed(() => weeklyRegistered.value
  ? `${weeklyRegistered.value} ${weeklyRegistered.value === 1 ? 'día con registro' : 'días con registro'} esta semana.`
  : 'Tu trayectoria empieza con el primer registro. No tiene que ser perfecto.')

function openHabit(habit) {
  router.push({ name: 'habit', params: { id: habit.id } })
}
function openLog(habit) {
  selectedHabit.value = habit
}
function findHabit(id) {
  return activeHabits.value.find(habit => habit.id === id)
}
function handleHabitLog(id) {
  const habit = findHabit(id)
  if (habit) openLog(habit)
}
function handleHabitOpen(id) {
  const habit = findHabit(id)
  if (habit) openHabit(habit)
}
function handleHabitSaved({ habitId, day, status, minimumUsed }) {
  const habit = store.habits.find(item => item.id === habitId)
  const habitName = String(habit?.name ?? '').trim() || 'el hábito'
  const event = status === 'not_done' || status === 'conscious_skip'
    ? 'habit_skipped'
    : minimumUsed ? 'minimal_version' : status === 'done' ? 'habit_completed' : 'habit_partial'
  const message = getPhrase(event, { habit, vars: { habitName } }).text
  toast.show({
    message,
    tone: 'action',
    actionLabel: 'Deshacer',
    onAction: () => store.clearDay(habitId, day),
  })
}

function saveCheckin(values) {
  const saved = checkinsStore.saveDailyCheckin(values, todayDate.value)
  showCheckin.value = false
  toast.show({
    message: saved.syncScope === 'cloud'
      ? 'Check-in guardado y listo para sincronizar.'
      : 'Check-in guardado sólo en este dispositivo.',
    tone: 'action',
  })
}

function skipDailyCheckins() {
  settings.dailyCheckinPrompt = 'never'
  showCheckin.value = false
  toast.show({
    message: 'Ya no te preguntaremos por tu ánimo. Puedes reactivarlo en Ajustes.',
    tone: 'action',
  })
}

function openDayClosure() {
  recentlyUnlockedClaims.value = dayClaims.value
  showDayClose.value = true
}

function confirmDayClosure(options) {
  const closure = dayClosuresStore.closeDay(daySummary.value, options)
  recentlyUnlockedClaims.value = rewardsStore.evaluate(
    store.habits,
    goalsStore?.goals ?? [],
    new Date(),
    { daySummary: daySummary.value, dayClosure: closure, flexibleGroups: flexibleGroupsStore.activeGroups, milestones: goalsStore?.milestones ?? [] },
  )
}

function openCheckinFromClosure() {
  showDayClose.value = false
  showCheckin.value = true
}

watch(() => activeHabits.value.map(habit => habit.id), ids => {
  if (selectedHabit.value && !ids.includes(selectedHabit.value.id)) selectedHabit.value = null
})

let consumedNotificationIntent = null
watch(
  () => route.query.intent,
  async intent => {
    if (!['open', 'close', 'log', 'resume'].includes(intent)) {
      consumedNotificationIntent = null
      return
    }
    if (consumedNotificationIntent === intent) return
    consumedNotificationIntent = intent
    const nextQuery = { ...route.query }
    delete nextQuery.intent
    await router.replace({ query: nextQuery })
    if (intent === 'close') openDayClosure()
    if (intent === 'log') {
      const flexibleHabits = flexibleAgenda.value.options.map(option => option.habit)
      const pending = habits.value.find(habit => !todayLog(habit))
        ?? flexibleHabits.find(habit => !todayLog(habit))
        ?? habits.value[0]
        ?? flexibleHabits[0]
      if (pending) openLog(pending)
    }
  },
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <main class="home">
    <AuroraTopBar class="home__topbar" large :eyebrow="dateLabel" :title="greetingTitle">
      <template #actions>
        <AuroraButton v-if="activeHabits.length" variant="secondary" size="sm" @click="showCreate = true">
          <template #icon-left><Plus :size="16" aria-hidden="true" /></template>
          Nuevo
        </AuroraButton>
        <AuroraIconButton label="Abrir perfil y ajustes" @click="router.push('/settings')">
          <UserRound :size="20" :stroke-width="1.75" aria-hidden="true" />
        </AuroraIconButton>
      </template>
    </AuroraTopBar>

    <TodayOpening class="home__opening" :opening="todayOpening" />

    <div class="home__dashboard" :class="{ 'home__dashboard--single': !hasPrimaryContent }">
      <div v-if="hasPrimaryContent" class="home__column home__column--primary">
        <AuroraReturnCard
          v-if="isReturning"
          eyebrow="Podemos continuar desde aquí"
          headline="Tu avance sigue seguro."
          body="Ve paso a paso. Lo que ya hiciste permanece y lo que hagas hoy también cuenta."
          :action-label="null"
        />

        <AuroraSurface v-if="dayIsResolved" accent padding="20px" as="section" class="home__resolved" role="status">
          <CheckCircle2 :size="24" :stroke-width="1.75" aria-hidden="true" />
          <div>
            <h2>{{ dayCloseCopy.title }}</h2>
            <p>{{ dayCloseCopy.body }}</p>
          </div>
          <AuroraButton variant="secondary" size="sm" @click="openDayClosure">{{ closureNeedsUpdate ? 'Actualizar cierre' : todayClosure ? 'Ver cierre' : 'Cerrar el día' }}</AuroraButton>
        </AuroraSurface>

        <AuroraGoalFocus
          v-else-if="goalIsPrimary"
          :goal="focusedGoalTitle"
          :state="focusedGoalState"
          :action="focusedGoalState === 'blocked' ? undefined : focusedActionTitle"
          :reason="focusedGoalReason"
          :elapsed="focusedGoalState === 'active' ? goalsStore.runningSession?.elapsedLabel || 'en curso' : undefined"
          :eyebrow="`Tu foco · ${horizonLabels[focusedGoal.horizon ?? 'short']}`"
          @primary="startFocusedGoal"
          @detail="openFocusedGoal"
        />

        <section v-if="directions.length" class="home__section" aria-labelledby="directions-title">
          <div class="section-heading">
            <h2 id="directions-title">Tus direcciones</h2>
            <button type="button" @click="router.push('/settings/goals')">Administrar</button>
          </div>
          <div class="home__directions">
            <button v-for="goal in directions" :key="goal.id" type="button" @click="router.push(`/goals/${goal.id}`)">
              <span>{{ horizonLabels[goal.horizon] || horizonLabels.short }}</span>
              <strong>{{ goal.title }}</strong>
            </button>
          </div>
        </section>

        <AuroraSurface v-if="goalsStore?.error" as="section" level="2" padding="16px" class="home__goal-error" role="alert">
          <div>
            <h2>No pudimos cargar tus metas.</h2>
            <p>Tus hábitos y registros guardados siguen disponibles.</p>
          </div>
          <AuroraButton variant="secondary" size="sm" :disabled="goalsStore.loading" :loading="goalsStore.loading" @click="retryGoals">Reintentar</AuroraButton>
        </AuroraSurface>
      </div>

      <div class="home__column home__column--habits">
        <FlexibleOptions
          :groups="flexibleAgenda.groups"
          :options="flexibleAgenda.options"
          :log-for-habit="todayLog"
          @log="handleHabitLog"
        />

        <template v-if="auroraHabits.length">
          <AuroraHabitList
            title="Continúa hoy"
            :habits="auroraHabits"
            :visible="3"
            @log="handleHabitLog"
            @open="handleHabitOpen"
          />

          <section class="home__section home__section--progress" aria-labelledby="progress-title">
            <div class="section-heading">
              <h2 id="progress-title">Tu avance</h2>
              <button type="button" @click="router.push('/progress')">Abrir progreso</button>
            </div>
            <AuroraWeeklyPath :days="weeklyPath" />
            <p class="home__weekly-summary">{{ weeklySummary }}</p>
          </section>
        </template>

        <section v-else-if="activeHabits.length && !flexibleAgenda.groups.length" class="home__empty home__empty--quiet">
          <span><CalendarDays :size="28" :stroke-width="1.75" aria-hidden="true" /></span>
          <h2>Hoy está despejado.</h2>
          <p>Tus hábitos siguen guardados. Volverán a aparecer en los días que elegiste.</p>
          <AuroraButton variant="secondary" @click="router.push('/habits')">Ajustar calendario</AuroraButton>
        </section>

        <section v-else class="home__empty">
          <span><Sparkles :size="28" :stroke-width="1.75" aria-hidden="true" /></span>
          <h2>Empieza con un hábito pequeño.</h2>
          <p>Elige algo que quieras cuidar. Después podrás reducirlo, pausarlo o retomarlo.</p>
          <AuroraButton :variant="goalIsPrimary ? 'secondary' : 'primary'" size="lg" @click="showCreate = true">
            <template #icon-left><Plus :size="18" aria-hidden="true" /></template>
            Crear un hábito
          </AuroraButton>
        </section>

        <AuroraSurface v-if="todayCheckin || settings.dailyCheckinPrompt !== 'never'" as="section" level="2" padding="18px" class="home__checkin" aria-labelledby="daily-checkin-title">
          <div class="home__checkin-icon" aria-hidden="true"><HeartPulse :size="20" :stroke-width="1.75" /></div>
          <div class="home__checkin-copy">
            <h2 id="daily-checkin-title">{{ todayCheckin ? 'Check-in guardado' : '¿Cómo llegas hoy?' }}</h2>
            <p>{{ checkinSummary }}</p>
            <span>
              <component :is="todayCheckin?.syncScope === 'cloud' ? Cloud : LockKeyhole" :size="13" aria-hidden="true" />
              {{ checkinSyncLabel }}
            </span>
          </div>
          <AuroraButton variant="secondary" size="sm" @click="showCheckin = true">
            {{ todayCheckin ? 'Editar' : 'Hacer check-in' }}
          </AuroraButton>
        </AuroraSurface>

        <AuroraSurface v-if="!todayClosure && !daySummary.isSufficient" as="section" level="2" padding="18px" class="home__day-close" aria-labelledby="day-close-title">
          <Moon :size="20" :stroke-width="1.75" aria-hidden="true" />
          <div>
            <h2 id="day-close-title">Cerrar por hoy</h2>
            <p>Guarda lo que sí pasó y deja el resto aquí. Mañana empieza sin deuda.</p>
          </div>
          <AuroraButton variant="secondary" size="sm" @click="openDayClosure">Ver resumen</AuroraButton>
        </AuroraSurface>
      </div>
    </div>

    <CreateHabitModal v-if="showCreate" @close="showCreate = false" />
    <LogModal v-if="selectedHabit" :habit="selectedHabit" :day="store.getCurrentDay(selectedHabit)" @saved="handleHabitSaved" @close="selectedHabit = null" />
    <DailyCheckinSheet v-if="showCheckin" :checkin="todayCheckin" @save="saveCheckin" @skip-always="skipDailyCheckins" @close="showCheckin = false" />
    <DayCloseModal
      v-if="showDayClose"
      :summary="dayCloseSummary"
      :closure="todayClosure"
      :can-update="closureNeedsUpdate"
      :unlocked-claims="visibleDayClaims"
      @confirm="confirmDayClosure"
      @checkin="openCheckinFromClosure"
      @close="showDayClose = false"
    />
  </main>
</template>

<style scoped>
.home{box-sizing:border-box;display:flex;width:100%;min-height:100svh;padding:52px 20px 112px;flex-direction:column;gap:28px}
.home__topbar{flex-wrap:wrap;row-gap:10px}
.home__opening{width:100%}
.home__dashboard{display:flex;flex-direction:column;gap:28px}
.home__column{display:contents}
.home__section{display:flex;flex-direction:column;gap:10px}
.section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.section-heading h2{margin:0;color:var(--text-muted);font:600 12px/1 var(--font-core);letter-spacing:.06em;text-transform:uppercase}
.section-heading button{min-height:32px;padding:0;border:0;background:transparent;color:var(--text-secondary);font:600 13px/1 var(--font-core);cursor:pointer}
.section-heading button:hover{color:var(--text-primary)}
.home__directions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.home__directions button{display:flex;min-width:0;padding:10px 0;flex-direction:column;gap:4px;border:0;border-block:1px solid var(--border-subtle);background:transparent;text-align:left;cursor:pointer}
.home__directions span{color:var(--text-muted);font:600 11px/1.3 var(--font-core);letter-spacing:.04em;text-transform:uppercase}
.home__directions strong{color:var(--text-primary);font:600 13px/1.4 var(--font-core);overflow-wrap:anywhere}
.home__resolved{display:flex;flex-direction:column;align-items:flex-start;gap:12px;color:var(--action-primary)}
.home__resolved h2{margin:0;color:var(--text-primary);font:600 20px/1.3 var(--font-core);letter-spacing:-.015em}
.home__resolved p{margin:4px 0 0;color:var(--text-secondary);font:400 14px/1.5 var(--font-core);text-wrap:pretty}
.home__goal-error{display:flex;align-items:center;justify-content:space-between;gap:12px;border-color:color-mix(in srgb,var(--status-destructive) 30%,var(--border-subtle))}
.home__goal-error h2{margin:0;color:var(--text-primary);font:600 14px/1.5 var(--font-core)}
.home__goal-error p{margin:0;color:var(--text-secondary);font:400 13px/1.5 var(--font-core)}
.home__weekly-summary{max-width:65ch;margin:10px 0 0;color:var(--text-secondary);font:400 14px/1.5 var(--font-core);text-wrap:pretty}
.home__checkin{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px}
.home__checkin-icon{display:grid;width:40px;height:40px;place-items:center;color:var(--text-muted)}
.home__checkin-copy{min-width:0}
.home__checkin-copy h2{margin:0;color:var(--text-primary);font:600 15px/1.35 var(--font-core)}
.home__checkin-copy p{max-width:52ch;margin:3px 0 0;color:var(--text-secondary);font:400 13px/1.45 var(--font-core);text-wrap:pretty}
.home__checkin-copy span{display:flex;align-items:center;gap:5px;margin-top:7px;color:var(--text-muted);font:400 11px/1.3 var(--font-core)}
.home__day-close{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;color:var(--text-muted)}
.home__day-close h2{margin:0;color:var(--text-primary);font:600 15px/1.35 var(--font-core)}
.home__day-close p{max-width:52ch;margin:3px 0 0;color:var(--text-secondary);font:400 13px/1.45 var(--font-core);text-wrap:pretty}
.home__empty{display:flex;padding:32px 0;flex-direction:column;align-items:flex-start;justify-content:center}
.home__empty>span{display:grid;width:56px;height:56px;margin-bottom:20px;place-items:center;border-radius:var(--radius-lg);background:color-mix(in srgb,var(--action-primary) 14%,transparent);color:var(--action-primary)}
.home__empty h2{max-width:20rem;margin:0;color:var(--text-primary);font:400 26px/1.28 var(--font-editorial);letter-spacing:-.01em}
.home__empty p{max-width:26rem;margin:10px 0 20px;color:var(--text-secondary);font:400 15px/1.55 var(--font-core)}
@media(max-width:520px){.home__goal-error{align-items:flex-start;flex-direction:column}.home__checkin,.home__day-close{grid-template-columns:auto minmax(0,1fr)}.home__checkin>.a-button,.home__day-close>.a-button{grid-column:1/-1;width:100%}}
@media(max-width:359px){.home__section--progress .section-heading{padding-right:84px}}
@media(min-width:768px){
  .home{padding:48px;gap:28px}
  .home__dashboard{width:100%;max-width:640px;margin-inline:auto;gap:24px}
}
@media(min-width:1320px){
  .home__dashboard{display:grid;max-width:1120px;margin-inline:0;grid-template-columns:360px minmax(0,1fr);gap:32px;align-items:start}
  .home__dashboard--single{max-width:640px;margin-inline:auto;grid-template-columns:minmax(0,1fr)}
  .home__column{display:flex;min-width:0;flex-direction:column;gap:24px}
}
</style>
