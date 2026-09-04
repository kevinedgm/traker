<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals.js'
import { useSettingsStore } from '@/stores/settings.js'
import { useAuthStore } from '@/stores/auth.js'
import GoalsPrivacyPanel from '@/components/goals/GoalsPrivacyPanel.vue'
import { useRouter } from 'vue-router'
import { revokeGoalsConsent, saveGoalsConsent } from '@/services/supabase/goals.service.js'
import { useGoalsSyncStore } from '@/stores/goalsSync.js'
import SettingsShell from '@/components/settings/SettingsShell.vue'
import AuroraConfirmDialog from '@/components/aurora/surfaces/AuroraConfirmDialog.vue'

const goalsStore = useGoalsStore()
const settings = useSettingsStore()
const auth = useAuthStore()
const router = useRouter()
const syncStore = useGoalsSyncStore()
const online = ref(navigator.onLine)
const selectedIds = ref([])
const busy = ref(false)
const message = ref('')
const messageTone = ref('status')
const pendingLimit = ref(null)
const activeGoals = computed(() => goalsStore.activeGoals)

onMounted(async () => {
  if (!goalsStore.loaded) await goalsStore.load().catch(() => {})
  selectedIds.value = goalsStore.focusedGoals.slice(0, settings.goalsFocusLimit).map(goal => goal.id)
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})

function updateOnline() { online.value = navigator.onLine }
async function toggleSyncConsent() {
  const wasEnabled = settings.goalsSyncConsented
  const version = settings.goalsSyncConsentVersion ?? 'goals-sync-v1'
  const grantedAt = settings.goalsSyncConsentGrantedAt
  if (wasEnabled) settings.revokeGoalsSyncConsent()
  else settings.grantGoalsSyncConsent(version)
  if (!auth.isCloudAuthenticated) return
  const { error } = wasEnabled
    ? await revokeGoalsConsent({ purpose: 'goals_sync', consentVersion: version, grantedAt })
    : await saveGoalsConsent({ purpose: 'goals_sync', consentVersion: settings.goalsSyncConsentVersion, grantedAt: settings.goalsSyncConsentGrantedAt })
  if (error) { messageTone.value = 'error'; message.value = 'El consentimiento quedó guardado localmente, pero no pudimos actualizar la nube.' }
  else { messageTone.value = 'status'; message.value = 'Tu preferencia de sincronización quedó guardada.'; if (!wasEnabled) await syncStore.flush({ consented: true }) }
}
async function toggleAnalyticsConsent() {
  const wasEnabled = settings.goalsAnalyticsConsented
  const version = settings.goalsAnalyticsConsentVersion ?? 'goals-analytics-v1'
  const grantedAt = settings.goalsAnalyticsConsentGrantedAt
  if (wasEnabled) settings.revokeGoalsAnalyticsConsent()
  else settings.grantGoalsAnalyticsConsent(version)
  if (!auth.isCloudAuthenticated) return
  const { error } = wasEnabled
    ? await revokeGoalsConsent({ purpose: 'goals_analytics', consentVersion: version, grantedAt })
    : await saveGoalsConsent({ purpose: 'goals_analytics', consentVersion: settings.goalsAnalyticsConsentVersion, grantedAt: settings.goalsAnalyticsConsentGrantedAt })
  if (error) { messageTone.value = 'error'; message.value = 'El consentimiento quedó guardado localmente, pero no pudimos actualizar la nube.' }
  else { messageTone.value = 'status'; message.value = 'Tu preferencia de analítica quedó guardada.' }
}

async function persist(ids) {
  busy.value = true
  message.value = ''
  try {
    await goalsStore.setFocus(ids)
    selectedIds.value = [...ids]
    messageTone.value = 'status'
    message.value = 'Tu foco quedó guardado.'
  } catch (_) {
    messageTone.value = 'error'
    message.value = goalsStore.error?.message ?? 'No pudimos guardar el foco.'
  } finally { busy.value = false }
}

function toggle(goalId) {
  if (selectedIds.value.includes(goalId)) return persist(selectedIds.value.filter(id => id !== goalId))
  if (selectedIds.value.length >= settings.goalsFocusLimit) return
  return persist([...selectedIds.value, goalId])
}

function move(goalId, offset) {
  const ids = [...selectedIds.value]
  const index = ids.indexOf(goalId)
  const nextIndex = index + offset
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return
  ;[ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]]
  persist(ids)
}

async function changeLimit(event) {
  const nextLimit = Number(event.target.value)
  if (selectedIds.value.length > nextLimit) pendingLimit.value = nextLimit
  else settings.goalsFocusLimit = nextLimit
}

async function confirmLimit() {
  const nextLimit = pendingLimit.value
  if (!nextLimit) return
  settings.goalsFocusLimit = nextLimit
  pendingLimit.value = null
  await persist(selectedIds.value.slice(0, nextLimit))
}
</script>

<template>
  <SettingsShell title="Foco de Metas" subtitle="Decide qué merece estar más cerca. Las demás metas activas no se pausan ni pierden progreso." back-to="/settings">

    <section class="focus-settings__limit" aria-labelledby="focus-limit-title">
      <div><h2 id="focus-limit-title">Límite de foco</h2><p>Una lista corta reduce decisiones. Hoy seguirá mostrando sólo la primera.</p></div>
      <select :value="settings.goalsFocusLimit" aria-label="Número máximo de metas en foco" @change="changeLimit">
        <option :value="1">1 meta</option><option :value="2">2 metas</option><option :value="3">3 metas</option>
      </select>
    </section>

    <section class="focus-settings__goals" aria-labelledby="active-goals-title">
      <div class="focus-settings__section-head"><h2 id="active-goals-title">Metas activas</h2><span>{{ selectedIds.length }} / {{ settings.goalsFocusLimit }} en foco</span></div>
      <p v-if="goalsStore.loading" role="status">Cargando metas…</p>
      <div v-else-if="activeGoals.length === 0" class="focus-settings__empty"><p>No tienes metas activas todavía.</p><RouterLink to="/goals/new">Crear una meta</RouterLink></div>
      <ol v-else>
        <li v-for="goal in activeGoals" :key="goal.id" :class="{ 'is-focused': selectedIds.includes(goal.id) }">
          <button class="focus-settings__toggle" type="button" :aria-pressed="selectedIds.includes(goal.id)" :disabled="busy || (!selectedIds.includes(goal.id) && selectedIds.length >= settings.goalsFocusLimit)" @click="toggle(goal.id)">
            <span class="focus-settings__rank">{{ selectedIds.includes(goal.id) ? selectedIds.indexOf(goal.id) + 1 : '—' }}</span>
            <span><strong>{{ goal.title }}</strong><small>{{ selectedIds.includes(goal.id) ? 'En foco' : 'Fuera de foco' }}</small></span>
          </button>
          <Transition name="focus-order">
            <div v-if="selectedIds.includes(goal.id)" class="focus-settings__order" aria-label="Cambiar prioridad">
              <button type="button" aria-label="Subir prioridad" :disabled="busy || selectedIds.indexOf(goal.id) === 0" @click="move(goal.id, -1)"><ChevronUp :size="18" /></button>
              <button type="button" aria-label="Bajar prioridad" :disabled="busy || selectedIds.indexOf(goal.id) === selectedIds.length - 1" @click="move(goal.id, 1)"><ChevronDown :size="18" /></button>
            </div>
          </Transition>
        </li>
      </ol>
    </section>
    <Transition name="focus-message">
      <p v-if="message" class="focus-settings__message" :class="{ 'is-error': messageTone === 'error' }" :role="messageTone === 'error' ? 'alert' : 'status'">{{ message }}</p>
    </Transition>
    <GoalsPrivacyPanel
      :sync-enabled="settings.goalsSyncConsented"
      :analytics-enabled="settings.goalsAnalyticsConsented"
      :authenticated="auth.isCloudAuthenticated"
      :online="online"
      :sync-granted-at="settings.goalsSyncConsentGrantedAt"
      :sync-status="syncStore.status"
      :pending-count="syncStore.pendingCount"
      :conflict-count="syncStore.conflicts.length"
      :last-synced-at="syncStore.lastSyncedAt"
      @toggle-sync="toggleSyncConsent"
      @toggle-analytics="toggleAnalyticsConsent"
      @connect="router.push('/auth/login')"
      @retry="syncStore.flush({ consented: settings.goalsSyncConsented })"
    />
    <AuroraConfirmDialog
      v-if="pendingLimit"
      :open="Boolean(pendingLimit)"
      title="¿Reducir tu foco?"
      :body="`Saldrán del foco: ${selectedIds.slice(pendingLimit).map(id => activeGoals.find(goal => goal.id === id)?.title).filter(Boolean).join(', ')}. No se pausan ni pierden progreso.`"
      cancel-label="Conservar foco"
      confirm-label="Reducir foco"
      @cancel="pendingLimit = null"
      @confirm="confirmLimit"
    />
  </SettingsShell>
</template>

<style scoped>
.focus-settings__limit { box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); padding: var(--space-5) 0; border-block: 1px solid var(--color-border); }
.focus-settings__limit h2,.focus-settings__section-head h2 { margin: 0; font:var(--title-weight) var(--title-size)/var(--title-line) var(--font-core); letter-spacing:var(--title-track); }
.focus-settings__limit p { max-width:60ch; margin: 5px 0 0; color: var(--color-text-muted); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); text-wrap:pretty; }
select { min-height: 46px; flex: none; padding: 0 36px 0 14px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); color: var(--color-text); background: var(--color-surface); font: inherit; font-weight: 700; }
.focus-settings__goals { margin-top: var(--space-10) !important; }
.focus-settings__section-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-3); }
.focus-settings__section-head span { color: var(--color-text-faint); font:600 var(--caption-size)/var(--caption-line) var(--font-core); letter-spacing:var(--caption-track); }
ol { margin: 0; padding: 0; border-top: 1px solid var(--color-border); list-style: none; }
li { display: flex; min-width: 0; align-items: stretch; border-bottom: 1px solid var(--color-border); }
.focus-settings__toggle { display: flex; min-width: 0; min-height: 74px; flex: 1; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-2) var(--space-3) 0; border: 0; color: var(--color-text); background: transparent; text-align: left; }
.focus-settings__toggle:disabled { cursor: not-allowed; opacity: .48; }
.focus-settings__rank { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border-radius: 50%; color: var(--color-text-faint); background: var(--color-surface-raised); font:700 var(--label-size)/1 var(--font-numeric); font-variant-numeric:tabular-nums; transition:color var(--dur-base) var(--ease-calm),background var(--dur-base) var(--ease-calm),box-shadow var(--dur-base) var(--ease-calm); }
.is-focused .focus-settings__rank { color: var(--color-brand-contrast); background: var(--color-brand); }
.is-focused .focus-settings__rank { animation:focus-confirm var(--dur-celebrate) var(--ease-enter); }
.focus-settings__toggle > span:last-child { display: grid; min-width: 0; gap: 4px; }
.focus-settings__toggle strong { overflow-wrap:anywhere; font:600 var(--body-size)/1.3 var(--font-core); }
.focus-settings__toggle small { color: var(--color-text-faint); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.focus-settings__order { display: flex; align-items: center; gap: 4px; }
.focus-settings__order button { display: grid; width: 44px; height: 44px; place-items: center; border: 0; border-radius: 50%; color: var(--color-text-muted); background: transparent; transition:color var(--dur-fast) var(--ease-calm),background var(--dur-fast) var(--ease-calm),transform var(--dur-fast) var(--ease-calm); }
.focus-settings__order button:active:not(:disabled) { transform:scale(.9); }
.focus-settings__order button:hover:not(:disabled) { color: var(--color-brand); background: var(--color-surface-raised); }
.focus-settings__order button:disabled { opacity: .25; }
.focus-settings__empty { padding: 28px 0; color: var(--color-text-muted); }
.focus-settings__empty a { color: var(--color-brand); font-weight: 750; }
.focus-settings__message { margin:var(--space-3) 0 0; color:var(--action-primary); font:600 var(--label-size)/1.4 var(--font-core); }
.focus-settings__message.is-error { color:var(--color-danger); }
.focus-order-enter-active { transition:opacity var(--dur-base) var(--ease-calm),transform var(--dur-view) var(--ease-enter),clip-path var(--dur-view) var(--ease-enter); }
.focus-order-leave-active { transition:opacity var(--dur-fast) var(--ease-calm),transform var(--dur-fast) var(--ease-calm); }
.focus-order-enter-from { opacity:0; transform:translateX(8px); clip-path:inset(0 0 0 100%); }
.focus-order-leave-to { opacity:0; transform:translateX(4px); }
.focus-message-enter-active { transition:opacity var(--dur-base) var(--ease-calm),filter var(--dur-view) var(--ease-enter); }
.focus-message-leave-active { transition:opacity var(--dur-fast) var(--ease-calm); }
.focus-message-enter-from { opacity:0; filter:blur(3px); }
.focus-message-leave-to { opacity:0; }
@keyframes focus-confirm { 45% { box-shadow:0 3px 12px color-mix(in srgb,var(--color-brand) 28%,transparent); } }
@media (max-width: 500px) { .focus-settings__limit { align-items: stretch; flex-direction: column; } select { width: 100%; } .focus-settings__order { align-self:center; } }
@media (prefers-reduced-motion:reduce) {
  .is-focused .focus-settings__rank { animation:none; }
  .focus-order-enter-from,.focus-order-leave-to { transform:none; clip-path:none; }
  .focus-message-enter-from { filter:none; }
}
</style>
