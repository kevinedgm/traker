<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { Gift, Pencil, Plus, Sparkles, Trash2 } from 'lucide-vue-next'
import { features } from '@/config/features.js'
import { useHabitsStore } from '@stores/habits'
import { useGoalsStore } from '@stores/goals'
import { useRewardsStore } from '@stores/rewards'
import { useFlexibleGroupsStore } from '@stores/flexibleGroups'
import RewardForm from '@components/rewards/RewardForm.vue'
import AuroraConfirmDialog from '@components/aurora/surfaces/AuroraConfirmDialog.vue'
import AuroraModal from '@components/aurora/surfaces/AuroraModal.vue'

const habitsStore = useHabitsStore()
const goalsStore = useGoalsStore()
const rewardsStore = useRewardsStore()
const flexibleGroupsStore = useFlexibleGroupsStore()
const formOpen = ref(false)
const editing = ref(null)
const deleting = ref(null)
const newButton = ref(null)
let formReturnFocus = null

const sourceName = computed(() => Object.fromEntries([
  ...habitsStore.habits.map(habit => [habit.id, habit.name]),
  ...goalsStore.goals.map(goal => [goal.id, goal.title]),
  ...goalsStore.milestones.filter(milestone => !milestone.deletedAt).map(milestone => [milestone.id, milestone.title]),
  ...flexibleGroupsStore.groups.filter(group => !group.deletedAt).map(group => [group.id, group.name]),
]))
const rules = computed(() => rewardsStore.rewards)
const history = computed(() => rewardsStore.redeemedClaims.slice(0, 5))

function missingSource(reward) {
  if (reward.trigger === 'day_sufficient') return false
  return !reward.sourceIds?.length || reward.sourceIds.some(id => !sourceName.value[id])
}

function triggerLabel(reward) {
  if (missingSource(reward)) return 'Fuente eliminada o no disponible'
  if (reward.trigger === 'day_sufficient') return 'Al cerrar un día suficiente'
  if (reward.trigger === 'habits_combo') {
    const names = reward.sourceIds.map(id => sourceName.value[id] ?? 'Hábito').join(', ')
    return `${reward.targetCount} de ${reward.sourceIds.length} hoy · ${names}`
  }
  if (reward.trigger === 'goal_completed') return `Al terminar “${sourceName.value[reward.sourceId] ?? 'una meta'}”`
  if (reward.trigger === 'milestone_completed') return `Al completar el hito “${sourceName.value[reward.sourceId] ?? 'seleccionado'}”`
  if (reward.trigger === 'flexible_group') return `Al cubrir “${sourceName.value[reward.sourceId] ?? 'un grupo flexible'}”`
  if (reward.trigger === 'habit_weekly') return `${reward.targetCount} veces por semana · ${sourceName.value[reward.sourceId] ?? 'Hábito'}`
  return `Al cumplir hoy · ${sourceName.value[reward.sourceId] ?? 'Hábito'}`
}

function save(input) {
  if (editing.value) rewardsStore.updateReward(editing.value.id, input)
  else rewardsStore.addReward(input)
  rewardsStore.evaluate(habitsStore.habits, goalsStore.goals, new Date(), { flexibleGroups: flexibleGroupsStore.activeGroups, milestones: goalsStore.milestones })
  closeForm()
}

async function openForm(reward = null) {
  formReturnFocus = document.activeElement
  editing.value = reward
  formOpen.value = true
  await nextTick()
  document.querySelector('#reward-form input:not([type="checkbox"])')?.focus()
}
function edit(reward) { openForm(reward) }
async function closeForm() {
  editing.value = null
  formOpen.value = false
  await nextTick()
  ;(formReturnFocus?.isConnected ? formReturnFocus : newButton.value)?.focus()
}
function redeem(claim) { rewardsStore.redeem(claim.id) }

onMounted(async () => {
  if (features.goals && !goalsStore.loaded) await goalsStore.load().catch(() => {})
  rewardsStore.evaluate(habitsStore.habits, goalsStore.goals, new Date(), { flexibleGroups: flexibleGroupsStore.activeGroups, milestones: goalsStore.milestones })
})
</script>

<template>
  <main class="rewards-page">
    <div class="rewards-page__grid">
      <div class="rewards-page__primary">
        <header class="rewards-page__header">
          <h1>Recompensas</h1><p>Premios pequeños que tú eliges. Se desbloquean cuando algo cuenta; usarlos también queda en tus manos.</p>
        </header>
        <button v-if="rules.length" ref="newButton" class="rewards-page__new" type="button" aria-controls="reward-form" :aria-expanded="formOpen" @click="openForm()"><Plus :size="18" />Nueva recompensa</button>

        <section class="reward-vault" aria-labelledby="vault-title">
      <div class="reward-vault__intro">
        <span aria-hidden="true"><Sparkles :size="22" /></span>
        <div><h2 id="vault-title">Ya te las ganaste</h2><p>{{ rewardsStore.availableClaims.length ? 'Puedes elegir una o guardarlas para después. No se vencen.' : 'Cuando cumplas una condición, tu recompensa aparecerá aquí. Nada se pierde ni se vence.' }}</p></div>
      </div>
      <div v-if="rewardsStore.availableClaims.length" class="reward-vault__available">
        <article v-for="claim in rewardsStore.availableClaims" :key="claim.id">
          <Gift :size="20" aria-hidden="true" /><div><strong>{{ claim.rewardName }}</strong><small v-if="claim.rewardNote">{{ claim.rewardNote }}</small></div><button type="button" :aria-label="`Usar ${claim.rewardName}`" @click="redeem(claim)">Usar</button>
        </article>
      </div>
        </section>
      </div>

      <div class="rewards-page__secondary">
        <section class="reward-rules" aria-labelledby="rules-title">
      <div class="reward-rules__head"><div><h2 id="rules-title">Tus acuerdos contigo</h2><p>No son obligaciones. Puedes pausarlos, cambiarlos o borrarlos cuando quieras.</p></div><span>{{ rules.length }}</span></div>
      <div v-if="rules.length" class="reward-rules__list">
        <article v-for="reward in rules" :key="reward.id" :class="{ 'is-paused': !reward.enabled, 'needs-review': missingSource(reward) }">
          <span class="reward-rules__gift" aria-hidden="true"><Gift :size="20" /></span>
          <div>
            <strong>{{ reward.name }}</strong>
            <small>{{ triggerLabel(reward) }}</small>
            <span class="reward-rules__tags">
              <em v-if="!reward.enabled">En pausa</em>
              <em v-if="missingSource(reward)">Requiere revisión</em>
              <em v-if="reward.trigger === 'goal_completed'">Sólo en este dispositivo</em>
            </span>
          </div>
          <div class="reward-rules__actions"><button type="button" :aria-label="`Editar ${reward.name}`" @click="edit(reward)"><Pencil :size="17" /></button><button type="button" :aria-label="`Eliminar ${reward.name}`" @click="deleting = reward"><Trash2 :size="17" /></button></div>
        </article>
      </div>
      <div v-else class="reward-rules__empty"><Gift :size="28" /><h3>Empieza con algo sencillo</h3><p>Por ejemplo: “Si voy tres veces al gym esta semana, el sábado me regalo una tlayuda”.</p><button type="button" aria-controls="reward-form" :aria-expanded="formOpen" @click="openForm()">Crear mi primera recompensa</button></div>
        </section>

        <section v-if="history.length" class="reward-history" aria-labelledby="history-title"><h2 id="history-title">Disfrutadas recientemente</h2><ul><li v-for="claim in history" :key="claim.id"><span>{{ claim.rewardName }}</span><time :datetime="claim.redeemedAt">{{ new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(claim.redeemedAt)) }}</time></li></ul></section>
      </div>
    </div>

    <AuroraModal :open="formOpen" :title="editing ? 'Editar recompensa' : 'Nueva recompensa'" :width="480" @close="closeForm">
      <RewardForm id="reward-form" :reward="editing" :habits="habitsStore.habits" :goals="goalsStore.activeGoals" :milestones="goalsStore.milestones.filter(milestone => !milestone.deletedAt)" :flexible-groups="flexibleGroupsStore.activeGroups" @save="save" @cancel="closeForm" />
    </AuroraModal>

    <AuroraConfirmDialog v-if="deleting" :open="Boolean(deleting)" title="¿Borrar esta recompensa?" :body="`Se eliminará “${deleting.name}” y las veces que estuviera disponible. Tus hábitos y metas no cambian.`" cancel-label="Conservar" confirm-label="Borrar" destructive @cancel="deleting = null" @confirm="rewardsStore.removeReward(deleting.id); deleting = null" />
  </main>
</template>

<style scoped>
.rewards-page{box-sizing:border-box;width:min(100%,1120px);min-height:100svh;margin:auto;padding:52px 20px 40px;color:var(--text-primary)}
.rewards-page__grid,.rewards-page__primary,.rewards-page__secondary{display:flex;flex-direction:column;gap:24px}
.rewards-page__header h1{margin:0;color:var(--text-primary);font:600 28px/1.2 var(--font-core);letter-spacing:-.02em}
.rewards-page__header p{margin:6px 0 0;color:var(--text-secondary);font:400 14px/1.5 var(--font-core);text-wrap:pretty}
.rewards-page__new,.reward-rules__empty button{display:inline-flex;min-height:48px;flex:none;align-items:center;justify-content:center;gap:var(--space-2);padding-inline:var(--space-5);border:0;border-radius:var(--radius-pill);color:var(--action-primary-fg);background:var(--action-primary);font:600 var(--body-small-size)/1 var(--font-core);cursor:pointer}
.reward-vault{position:relative;overflow:hidden;padding:20px;border:1px solid var(--border-accent);border-radius:var(--radius-xl);background:var(--aurora-veil)}
.reward-vault::after{position:absolute;right:-60px;bottom:-90px;width:220px;height:220px;border:1px solid color-mix(in srgb,var(--action-primary) 20%,transparent);border-radius:50%;content:'';pointer-events:none}
.reward-vault__intro{position:relative;z-index:1;display:flex;gap:var(--space-3)}.reward-vault__intro>span{display:grid;width:44px;height:44px;flex:none;place-items:center;border-radius:50%;color:var(--action-primary);background:var(--surface-primary)}
.reward-vault h2,.reward-rules h2,.reward-history h2{margin:0;font:600 var(--h2-size)/var(--h2-line) var(--font-core);letter-spacing:var(--h2-track)}
.reward-vault p,.reward-rules__head p{max-width:62ch;margin:var(--space-1) 0 0;color:var(--text-secondary);font:400 var(--body-small-size)/var(--body-small-line) var(--font-core)}
.reward-vault__available{position:relative;z-index:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-2);margin-top:var(--space-5)}
.reward-vault__available article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--space-3);padding:var(--space-3);border-radius:var(--radius-lg);background:var(--surface-primary)}
.reward-vault__available article>svg{color:var(--accent-return)}.reward-vault__available article div{display:grid;min-width:0;gap:2px}.reward-vault__available strong,.reward-rules__list strong{overflow-wrap:anywhere;font:600 var(--body-size)/1.3 var(--font-core)}.reward-vault__available small,.reward-rules__list small{color:var(--text-muted);font:400 var(--body-small-size)/var(--body-small-line) var(--font-core)}
.reward-vault__available button{min-height:44px;padding-inline:var(--space-4);border:1px solid var(--border-subtle);border-radius:var(--radius-pill);color:var(--text-primary);background:var(--action-secondary-bg);font-weight:700;cursor:pointer}
.reward-rules__head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}.reward-rules__head>span{color:var(--text-muted);font:600 13px/1 var(--font-numeric)}
.reward-rules__list{display:grid;grid-template-columns:1fr;border-block:1px solid var(--border-subtle)}.reward-rules__list article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--border-subtle)}.reward-rules__list article:last-child{border-bottom:1px solid var(--border-subtle)}.reward-rules__list article.is-paused{opacity:.58}.reward-rules__gift{display:grid;width:44px;height:44px;place-items:center;border-radius:var(--radius-md);color:var(--accent-return);background:color-mix(in srgb,var(--accent-return) 12%,var(--surface-secondary))}.reward-rules__list article>div:nth-child(2){display:grid;gap:3px}.reward-rules__tags{display:flex;flex-wrap:wrap;gap:5px}.reward-rules__list em{width:max-content;padding:4px 8px;border-radius:var(--radius-pill);color:var(--text-muted);background:var(--surface-secondary);font:normal 600 var(--caption-size)/1 var(--font-core)}.reward-rules__list article.needs-review em{color:var(--status-warning)}
.reward-rules__actions{display:flex}.reward-rules__actions button{display:grid;width:44px;height:44px;place-items:center;border:0;border-radius:var(--radius-md);color:var(--text-muted);background:transparent;cursor:pointer}.reward-rules__actions button:hover{color:var(--text-primary);background:var(--surface-secondary)}
.reward-rules__empty{display:grid;min-height:17rem;justify-items:center;align-content:center;text-align:center}.reward-rules__empty>svg{color:var(--action-primary)}.reward-rules__empty h3{margin:var(--space-3) 0 var(--space-1);font:600 var(--title-size)/var(--title-line) var(--font-core)}.reward-rules__empty p{max-width:48ch;margin:0 0 var(--space-5);color:var(--text-secondary);font:400 var(--body-size)/var(--body-line) var(--font-core)}
.reward-history h2{font-size:16px}.reward-history ul{margin:10px 0 0;padding:0;border-top:1px solid var(--border-subtle);list-style:none}.reward-history li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-subtle);color:var(--text-secondary);font:400 14px/1.4 var(--font-core)}.reward-history time{color:var(--text-muted);font-variant-numeric:tabular-nums}
@media(max-width:640px){.rewards-page__grid{gap:28px}.rewards-page__new{width:100%}.reward-vault__available{grid-template-columns:1fr}}
@media(max-width:390px){.reward-vault__available article{grid-template-columns:auto minmax(0,1fr)}.reward-vault__available article button{grid-column:1/-1;width:100%}.reward-rules__list article{grid-template-columns:auto minmax(0,1fr)}.reward-rules__actions{grid-column:2;justify-content:flex-end}}

@media(min-width:640px){.rewards-page{width:min(100%,640px);padding:48px}.reward-vault__available{grid-template-columns:1fr}}
@media(min-width:1100px){.rewards-page{width:min(100%,1120px);padding:48px}.rewards-page__grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:32px;align-items:start}.reward-vault__available{grid-template-columns:1fr}}
</style>
