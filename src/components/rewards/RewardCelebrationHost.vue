<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Gift, X } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { features } from '@/config/features.js'
import { useHabitsStore } from '@stores/habits'
import { useRewardsStore } from '@stores/rewards'
import { useFlexibleGroupsStore } from '@stores/flexibleGroups'

const route = useRoute()
const habitsStore = useHabitsStore()
const rewardsStore = useRewardsStore()
const flexibleGroupsStore = useFlexibleGroupsStore()
const goals = ref([])
const milestones = ref([])
const noticeCount = ref(0)
let ready = false
let stopGoalsWatch

onMounted(async () => {
  if (!features.goals) return
  const { useGoalsStore } = await import('@stores/goals')
  const goalsStore = useGoalsStore()
  stopGoalsWatch = watch(
    [() => goalsStore.goals, () => goalsStore.milestones],
    ([goalValues, milestoneValues]) => {
      goals.value = goalValues
      milestones.value = milestoneValues
    },
    { deep: true, immediate: true },
  )
})

onBeforeUnmount(() => stopGoalsWatch?.())

watch(
  [() => habitsStore.habits, () => goals.value, () => milestones.value, () => rewardsStore.rewards, () => flexibleGroupsStore.groups],
  () => {
    const created = rewardsStore.evaluate(habitsStore.habits, goals.value, new Date(), { flexibleGroups: flexibleGroupsStore.activeGroups, milestones: milestones.value })
    if (ready && created.length && route.path !== '/rewards') {
      noticeCount.value += created.length
    }
    ready = true
  },
  { deep: true, immediate: true, flush: 'post' },
)

</script>

<template>
  <Transition name="reward-notice">
    <aside v-if="noticeCount" class="reward-notice" role="status">
      <Gift :size="20" aria-hidden="true" />
      <div><strong>{{ noticeCount === 1 ? 'Tienes una recompensa nueva' : `Tienes ${noticeCount} recompensas nuevas` }}</strong><small>Ya está guardada. Puedes verla cuando se te antoje.</small></div>
      <RouterLink to="/rewards" @click="noticeCount = 0">Ver</RouterLink>
      <button type="button" aria-label="Cerrar aviso" @click="noticeCount = 0"><X :size="18" /></button>
    </aside>
  </Transition>
</template>

<style scoped>
.reward-notice{position:fixed;z-index:55;right:max(var(--space-4),env(safe-area-inset-right));bottom:var(--nav-clearance);display:grid;width:min(calc(100% - 2 * var(--space-4)),28rem);grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);color:var(--text-primary);background:var(--surface-primary);box-shadow:var(--elev-4)}
.reward-notice>svg{color:var(--accent-return)}.reward-notice div{display:grid;gap:2px}.reward-notice strong{font:600 var(--body-small-size)/1.3 var(--font-core)}.reward-notice small{color:var(--text-muted);font:400 var(--label-size)/1.4 var(--font-core)}
.reward-notice a,.reward-notice button{display:grid;min-width:44px;min-height:44px;place-items:center;border:0;border-radius:var(--radius-md);color:var(--action-primary);background:transparent;font-weight:700;text-decoration:none}.reward-notice button{color:var(--text-muted);cursor:pointer}
.reward-notice-enter-active{transition:opacity var(--dur-base) var(--ease-calm),transform var(--dur-panel) var(--ease-enter)}.reward-notice-leave-active{transition:opacity var(--dur-fast) var(--ease-calm)}.reward-notice-enter-from{opacity:0;transform:translateY(10px)}.reward-notice-leave-to{opacity:0}
@media(max-width:520px){.reward-notice{right:var(--space-4);bottom:var(--nav-clearance);grid-template-columns:auto minmax(0,1fr) auto}.reward-notice a{grid-column:2;justify-self:start;padding-inline:var(--space-3)}.reward-notice>button{grid-column:3;grid-row:1}}
@media(prefers-reduced-motion:reduce){.reward-notice-enter-active,.reward-notice-leave-active{transition-duration:1ms}.reward-notice-enter-from{transform:none}}
</style>
