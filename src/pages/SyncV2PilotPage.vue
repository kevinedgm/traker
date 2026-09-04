<script setup>
/**
 * THESIS: El piloto debe mostrar convergencia y huecos con calma, sin convertir datos técnicos en una consola ni sugerir un cutover automático.
 * OWN-WORLD: Aurora 2 operativa; superficies carbón/papel, divisores, estados con icono y texto, y un único azul para actualizar.
 * STORY: La persona comprueba local y servidor, recorre cinco casos en dos perfiles, exporta evidencia y decide si el resultado merece revisión humana.
 * FIRST VIEWPORT: Estado resumido arriba, acción Actualizar en el encabezado y conteos concretos antes de la matriz manual.
 * FORM: Extensión estrecha de Ajustes; FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and docs/archive/2026-08-30/project/DESIGN.md
 */
import { computed, onMounted, ref } from 'vue'
import {
  Check,
  Circle,
  Database,
  Download,
  LogIn,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  WifiOff,
} from 'lucide-vue-next'
import SettingsShell from '@components/settings/SettingsShell.vue'
import {
  collectSyncV2PilotReadiness,
  loadSyncV2PilotSession,
  resetSyncV2PilotSession,
  saveSyncV2PilotSession,
  SYNC_V2_PILOT_MATRIX,
} from '@/services/syncV2Pilot.service.js'
import { exportV2Data } from '@/services/local/v2.export.js'
import {
  acknowledgeResolvedPilotV2Operations,
  loadLatestPilotV2HabitRestoreState,
} from '@/services/syncV2PilotBridge.service.js'
import { pullAll as pullCanonicalSnapshot } from '@/services/supabase/sync.service.js'
import { useHabitsStore } from '@stores/habits'
import { useRewardsStore } from '@stores/rewards'

const habitsStore = useHabitsStore()
const rewardsStore = useRewardsStore()
const report = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const exportState = ref('idle')
const completedChecks = ref(new Set())
const latestDeletedHabit = ref(null)
const restoreState = ref('idle')
const reconciliationState = ref('idle')

const completedCount = computed(() => completedChecks.value.size)
const matrixComplete = computed(() => {
  const expected = report.value?.matrix?.length ?? 0
  return expected > 0 && completedCount.value === expected
})
const reviewReady = computed(() => Boolean(report.value?.ready && matrixComplete.value))
const backfillGaps = computed(() => {
  const logs = Number(report.value?.server?.missingLegacyLogs)
  const schedules = Number(report.value?.server?.missingReminderSchedules)
  return Number.isFinite(logs) && Number.isFinite(schedules) ? logs + schedules : null
})
const backfillGapLabel = computed(() => {
  if (backfillGaps.value !== null) return String(backfillGaps.value)
  return report.value?.server ? 'Reporte incompleto' : '—'
})
const unresolvedOperationCount = computed(() => (
  report.value?.local?.unresolvedOperations
  ?? report.value?.local?.pendingOperations
  ?? 0
))
const unresolvedOperationDetail = computed(() => {
  const states = report.value?.local?.operationStates
  if (!states || unresolvedOperationCount.value === 0) return 'No hay cambios locales esperando conciliación'
  const labels = [
    ['pending', 'pendiente', 'pendientes'],
    ['conflict', 'en conflicto', 'en conflicto'],
    ['rejected', 'rechazada', 'rechazadas'],
    ['blocked', 'bloqueada', 'bloqueadas'],
    ['unknown', 'sin clasificar', 'sin clasificar'],
  ]
  const parts = labels.flatMap(([state, singular, plural]) => {
    const count = Number(states[state]) || 0
    return count ? [`${count} ${count === 1 ? singular : plural}`] : []
  })
  return parts.length ? parts.join(' · ') : 'Estado no disponible; actualiza para volver a comprobarlo'
})
const terminalOperationCount = computed(() => {
  const states = report.value?.local?.operationStates ?? {}
  return (Number(states.conflict) || 0)
    + (Number(states.rejected) || 0)
    + (Number(states.blocked) || 0)
})
const needsLocalSession = computed(() => Boolean(
  report.value
  && report.value.environment === 'localhost'
  && !report.value.serverReachable,
))

async function refresh() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    report.value = await collectSyncV2PilotReadiness()
    const restore = await loadLatestPilotV2HabitRestoreState()
      .catch(() => ({ state: 'idle', habit: null }))
    latestDeletedHabit.value = restore.habit
    if (restore.state === 'queued' || restore.state === 'failed') {
      restoreState.value = restore.state
    } else if (restore.habit) {
      restoreState.value = 'idle'
    } else if (restoreState.value !== 'done' && restoreState.value !== 'failed') {
      restoreState.value = 'idle'
    }
  } catch {
    report.value = null
    errorMessage.value = 'No pudimos leer el diagnóstico local. El lector anterior sigue activo; recarga e intenta otra vez.'
  } finally {
    loading.value = false
  }
}

async function restoreDeletedHabit() {
  if (!latestDeletedHabit.value || restoreState.value === 'working') return
  restoreState.value = 'working'
  errorMessage.value = ''
  try {
    const result = await habitsStore.restoreHabitFromPilot(latestDeletedHabit.value)
    if (result?.status === 'conflict' || result?.status === 'rejected') {
      restoreState.value = 'failed'
      latestDeletedHabit.value = null
      errorMessage.value = 'La restauración encontró una versión más reciente. Conservamos el conflicto para revisarlo sin sobrescribirla.'
      return
    }
    restoreState.value = result?.status === 'queued' ? 'queued' : 'done'
    if (restoreState.value === 'done') {
      latestDeletedHabit.value = null
      await refresh()
    }
  } catch {
    restoreState.value = 'failed'
    errorMessage.value = 'No pudimos preparar la restauración. El tombstone sigue disponible; actualiza e intenta otra vez.'
  }
}

async function reconcileResolvedOperations() {
  if (reconciliationState.value === 'working') return
  reconciliationState.value = 'working'
  errorMessage.value = ''
  try {
    // Refresh the owner-scoped canonical snapshot first. The bridge only
    // acknowledges terminal operations when their logical entity is already
    // represented in IndexedDB, so a stale local snapshot must never decide.
    const snapshot = await pullCanonicalSnapshot()
    if (!snapshot) {
      reconciliationState.value = 'blocked'
      errorMessage.value = 'No pudimos actualizar la copia canónica. Las operaciones siguen intactas; revisa la conexión e inténtalo otra vez.'
      return
    }
    habitsStore.mergeFromCloud(snapshot.habits ?? [], { preferCloud: true })
    rewardsStore.mergeFromCloud(snapshot.rewards ?? { rewards: [], claims: [] })
    const result = await acknowledgeResolvedPilotV2Operations()
    if (!result.acknowledged) {
      reconciliationState.value = 'blocked'
      errorMessage.value = 'El conflicto todavía no coincide con la copia canónica. Se conserva intacto para evitar pérdida de datos.'
      return
    }
    reconciliationState.value = 'done'
    await refresh()
  } catch {
    reconciliationState.value = 'failed'
    errorMessage.value = 'No pudimos cerrar el conflicto revisado. La evidencia local sigue intacta; actualiza e intenta otra vez.'
  }
}

async function toggleCheck(id) {
  const next = new Set(completedChecks.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  completedChecks.value = next
  try {
    await saveSyncV2PilotSession(next)
  } catch {
    errorMessage.value = 'La marca sólo quedó en esta vista porque no pudo guardarse en la copia local.'
  }
}

async function resetChecks() {
  completedChecks.value = new Set()
  try {
    await resetSyncV2PilotSession()
  } catch {
    errorMessage.value = 'Las marcas se ocultaron, pero no pudimos borrar la sesión guardada.'
  }
}

async function downloadEvidence() {
  if (exportState.value === 'working') return
  exportState.value = 'working'
  try {
    const data = await exportV2Data()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `traker-v2-pilot-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    exportState.value = 'done'
  } catch {
    exportState.value = 'failed'
  }
}

function statusLabel() {
  if (!report.value) return 'Sin comprobar'
  if (report.value.converged) return 'Convergencia lista'
  if (report.value.backfillReady) return 'Backfill listo · sync pendiente'
  if (report.value.environment === 'blocked_non_local') return 'Endpoint no local bloqueado'
  if (!report.value.serverReachable) return 'Requiere sesión local'
  return 'Requiere revisión'
}

onMounted(async () => {
  const session = await loadSyncV2PilotSession().catch(() => null)
  const allowedIds = new Set(SYNC_V2_PILOT_MATRIX.map(item => item.id))
  completedChecks.value = new Set(
    Object.keys(session?.checks ?? {}).filter(id => allowedIds.has(id)),
  )
  await refresh()
})
</script>

<template>
  <SettingsShell
    title="Piloto de sincronización"
    subtitle="Supervisa el cutover local sin retirar los lectores heredados"
    back-to="/settings"
  >
    <template #actions>
      <button class="sv-refresh" type="button" :disabled="loading" :aria-busy="loading" @click="refresh">
        <RefreshCw :size="16" :class="{ 'is-refreshing': loading }" aria-hidden="true" />
        {{ loading ? 'Comprobando…' : 'Actualizar' }}
      </button>
    </template>

    <div class="sv">
      <p v-if="errorMessage" class="sv-alert" role="alert">{{ errorMessage }}</p>

      <section class="sv-section" aria-labelledby="sv-state-heading">
        <div class="sv-heading-row">
          <h2 id="sv-state-heading">Estado del piloto</h2>
          <span class="sv-status" :class="{ 'sv-status--ready': report?.converged }">
            <Check v-if="report?.converged" :size="14" aria-hidden="true" />
            <Circle v-else :size="12" aria-hidden="true" />
            {{ statusLabel() }}
          </span>
        </div>

        <div class="sv-card" :aria-busy="loading">
          <div v-if="loading && !report" class="sv-empty" role="status">Leyendo la copia local y el reporte del servidor…</div>
          <template v-else-if="report">
            <div class="sv-row">
              <div class="sv-row__icon"><Database :size="18" aria-hidden="true" /></div>
              <div class="sv-row__text">
                <strong>Copia local</strong>
                <span>{{ report.local.migrationStatus === 'completed' ? 'Backfill terminado' : 'Backfill pendiente' }}</span>
              </div>
              <span class="sv-value">{{ report.local.habits }} hábitos · {{ report.local.habitLogs }} logs</span>
            </div>
            <div class="sv-divider" />
            <div class="sv-row">
              <div class="sv-row__icon" :class="{ 'sv-row__icon--warn': !report.serverReachable }">
                <ShieldCheck v-if="report.serverReachable" :size="18" aria-hidden="true" />
                <WifiOff v-else :size="18" aria-hidden="true" />
              </div>
              <div class="sv-row__text">
                <strong>Supabase en localhost</strong>
                <span>{{ report.serverReachable ? 'Endpoint local verificado y reporte privado disponible' : report.environment === 'blocked_non_local' ? 'El piloto bloqueó un endpoint que no es local' : 'Inicia sesión en la cuenta local para comprobarlo' }}</span>
              </div>
              <RouterLink
                v-if="needsLocalSession"
                class="sv-session-link"
                :to="{ name: 'login', query: { returnTo: 'sync-v2-pilot' } }"
              >
                <LogIn :size="16" aria-hidden="true" />
                Iniciar sesión
              </RouterLink>
              <span v-else class="sv-value">{{ report.serverReachable ? 'Conectado' : 'No disponible' }}</span>
            </div>
            <div class="sv-divider" />
            <div class="sv-row">
              <div class="sv-row__text">
                <strong>Huecos del backfill</strong>
                <span>Logs y horarios heredados todavía sin correspondencia</span>
              </div>
              <span class="sv-value">
                {{ backfillGapLabel }}
              </span>
            </div>
            <div class="sv-divider" />
            <div class="sv-row">
              <div class="sv-row__text">
                <strong>Operaciones por resolver</strong>
                <span aria-live="polite">{{ unresolvedOperationDetail }}</span>
              </div>
              <span class="sv-value">{{ unresolvedOperationCount }}</span>
              <button
                v-if="terminalOperationCount"
                class="sv-reconcile"
                type="button"
                :disabled="reconciliationState === 'working'"
                :aria-busy="reconciliationState === 'working'"
                @click="reconcileResolvedOperations"
              >
                <Check :size="15" aria-hidden="true" />
                {{ reconciliationState === 'working' ? 'Comprobando…' : 'Usar copia de Supabase' }}
              </button>
            </div>
          </template>
          <div v-else class="sv-empty">Actualiza para comenzar el diagnóstico.</div>
        </div>
      </section>

      <section class="sv-section" aria-labelledby="sv-matrix-heading">
        <div class="sv-heading-row">
          <div>
            <h2 id="sv-matrix-heading">Dos perfiles, cinco comprobaciones</h2>
            <p>Marca un caso sólo después de observar el resultado en ambos perfiles.</p>
          </div>
          <div class="sv-matrix-meta">
            <button v-if="completedCount" class="sv-reset" type="button" @click="resetChecks">Reiniciar marcas</button>
            <span class="sv-count">{{ completedCount }}/{{ report?.matrix?.length ?? 5 }}</span>
          </div>
        </div>

        <ol class="sv-checklist">
          <li v-for="item in report?.matrix ?? []" :key="item.id">
            <button
              class="sv-check"
              type="button"
              role="checkbox"
              :aria-checked="completedChecks.has(item.id)"
              @click="toggleCheck(item.id)"
            >
              <span class="sv-check__mark" aria-hidden="true">
                <Check v-if="completedChecks.has(item.id)" :size="15" />
              </span>
              <span class="sv-check__text">
                <strong>{{ item.action }}</strong>
                <span>{{ item.expected }}</span>
              </span>
            </button>
          </li>
        </ol>

        <div v-if="latestDeletedHabit || restoreState !== 'idle'" class="sv-restore" aria-live="polite">
          <div class="sv-restore__icon"><RotateCcw :size="18" aria-hidden="true" /></div>
          <div class="sv-restore__text">
            <strong>Restauración controlada</strong>
            <p v-if="restoreState === 'queued'">Restauración guardada en la cola local. Se enviará cuando vuelva la conexión.</p>
            <p v-else-if="restoreState === 'done'">Restauración aceptada. El otro perfil la recibirá al recuperar foco o en el siguiente sondeo.</p>
            <p v-else-if="restoreState === 'failed'">La versión local quedó intacta. Revisa el conflicto antes de intentar otra restauración.</p>
            <p v-else-if="latestDeletedHabit">Hay un hábito eliminado en esta copia. Restáuralo aquí después de confirmar el tombstone en el otro perfil.</p>
            <p v-else>Después de borrar un hábito, vuelve a esta pantalla y pulsa Actualizar para habilitar este control.</p>
          </div>
          <button
            v-if="latestDeletedHabit && (restoreState === 'idle' || restoreState === 'working')"
            class="sv-restore__button"
            type="button"
            :disabled="restoreState === 'working'"
            :aria-busy="restoreState === 'working'"
            @click="restoreDeletedHabit"
          >
            <RotateCcw :size="16" aria-hidden="true" />
            {{ restoreState === 'working' ? 'Restaurando…' : 'Restaurar hábito' }}
          </button>
        </div>

        <p v-if="reviewReady" class="sv-review" role="status">
          La base y la matriz están completas. Sync v2 local está activo; conserva la evidencia durante la ventana de observación.
        </p>
      </section>

      <section class="sv-section" aria-labelledby="sv-evidence-heading">
        <h2 id="sv-evidence-heading">Evidencia y privacidad</h2>
        <div class="sv-evidence">
          <div>
            <strong>Exporta antes de decidir</strong>
            <p>El archivo incluye la copia v2 y el respaldo heredado. El diagnóstico visible sólo muestra conteos, nunca nombres ni notas.</p>
          </div>
          <button class="sv-export" type="button" :disabled="exportState === 'working'" @click="downloadEvidence">
            <Download :size="16" aria-hidden="true" />
            {{ exportState === 'working' ? 'Preparando…' : exportState === 'done' ? 'Exportado' : 'Exportar evidencia' }}
          </button>
        </div>
        <p v-if="exportState === 'failed'" class="sv-export-error" role="alert">No se pudo crear el archivo. Recarga e intenta otra vez.</p>
      </section>
    </div>
  </SettingsShell>
</template>

<style scoped>
.sv { width: 100%; }
.sv-section { margin-bottom: var(--space-8); }
.sv-section h2 { margin: 0; color: var(--text-primary); font: 600 1.08rem/1.3 var(--font-core); letter-spacing: -.006em; }
.sv-heading-row { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--space-4); margin-bottom:var(--space-3); }
.sv-heading-row p { max-width:58ch; margin:var(--space-1) 0 0; color:var(--text-muted); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.sv-status,.sv-count { display:inline-flex; flex:none; align-items:center; gap:var(--space-2); min-height:1.75rem; padding:0 var(--space-3); border-radius:var(--radius-full); background:var(--surface-secondary); color:var(--text-secondary); font:600 var(--label-size)/1 var(--font-core); }
.sv-matrix-meta { display:flex; flex:none; align-items:center; gap:var(--space-2); }
.sv-reset { min-height:var(--touch-min); padding:0 var(--space-2); border:0; background:transparent; color:var(--text-secondary); font:600 var(--label-size)/1 var(--font-core); cursor:pointer; }
.sv-status--ready { color:var(--status-success); background:color-mix(in srgb,var(--status-success) 12%,transparent); }
.sv-card { overflow:hidden; border:1px solid var(--border-subtle); border-radius:var(--radius-card-md); background:var(--surface-primary); }
.sv-row { display:flex; align-items:center; gap:var(--space-3); min-height:4.5rem; padding:var(--space-3) var(--space-4); }
.sv-row__icon { display:grid; flex:none; width:2rem; height:2rem; place-items:center; color:var(--status-info); }
.sv-row__icon--warn { color:var(--status-warning); }
.sv-row__text { display:grid; flex:1; min-width:0; gap:2px; }
.sv-row__text strong,.sv-evidence strong { color:var(--text-primary); font:600 var(--body-size)/1.35 var(--font-core); }
.sv-row__text span { color:var(--text-muted); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.sv-value { flex:none; max-width:42%; color:var(--text-secondary); font:600 var(--label-size)/1.35 var(--font-core); text-align:right; font-variant-numeric:tabular-nums; }
.sv-session-link,.sv-reconcile { display:inline-flex; flex:none; min-height:var(--touch-min); align-items:center; justify-content:center; gap:var(--space-2); padding:0 var(--space-4); border:1px solid var(--border-strong); border-radius:var(--radius-full); background:var(--surface-secondary); color:var(--text-primary); font:600 var(--label-size)/1 var(--font-core); text-decoration:none; }
.sv-reconcile { cursor:pointer; }
.sv-reconcile:disabled { cursor:wait; opacity:.55; }
.sv-divider { height:1px; margin-inline:var(--space-4); background:var(--border-subtle); }
.sv-empty { padding:var(--space-5); color:var(--text-secondary); font:400 var(--body-size)/var(--body-line) var(--font-core); }
.sv-checklist { overflow:hidden; margin:0; padding:0; border-block:1px solid var(--border-subtle); list-style:none; }
.sv-checklist li + li { border-top:1px solid var(--border-subtle); }
.sv-check { display:flex; width:100%; min-height:4.75rem; align-items:center; gap:var(--space-3); padding:var(--space-3) 0; border:0; background:transparent; color:inherit; text-align:left; cursor:pointer; }
.sv-check__mark { display:grid; flex:none; width:1.5rem; height:1.5rem; place-items:center; border:1px solid var(--border-strong); border-radius:var(--radius-cell); color:var(--text-on-accent); }
.sv-check[aria-checked='true'] .sv-check__mark { border-color:var(--action-primary); background:var(--action-primary); }
.sv-check__text { display:grid; gap:3px; }
.sv-check__text strong { color:var(--text-primary); font:600 var(--body-size)/1.35 var(--font-core); }
.sv-check__text span { color:var(--text-muted); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.sv-restore { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-4) 0; border-bottom:1px solid var(--border-subtle); }
.sv-restore__icon { display:grid; flex:none; width:2rem; height:2rem; place-items:center; color:var(--status-info); }
.sv-restore__text { flex:1; min-width:0; }
.sv-restore__text strong { color:var(--text-primary); font:600 var(--body-size)/1.35 var(--font-core); }
.sv-restore__text p { max-width:58ch; margin:2px 0 0; color:var(--text-muted); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); overflow-wrap:anywhere; }
.sv-restore__button { display:inline-flex; flex:none; min-height:var(--touch-min); align-items:center; justify-content:center; gap:var(--space-2); padding:0 var(--space-4); border:1px solid var(--border-strong); border-radius:var(--radius-full); background:var(--surface-secondary); color:var(--text-primary); font:600 var(--label-size)/1 var(--font-core); cursor:pointer; }
.sv-restore__button:disabled { cursor:wait; opacity:.55; }
.sv-review,.sv-alert { margin:var(--space-4) 0 0; padding:var(--space-4); border-radius:var(--radius-md); background:color-mix(in srgb,var(--status-success) 10%,var(--surface-primary)); color:var(--text-primary); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.sv-alert { margin:0 0 var(--space-5); background:color-mix(in srgb,var(--status-warning) 10%,var(--surface-primary)); }
.sv-evidence { display:flex; align-items:center; justify-content:space-between; gap:var(--space-5); margin-top:var(--space-3); padding-top:var(--space-4); border-top:1px solid var(--border-subtle); }
.sv-evidence p { max-width:54ch; margin:var(--space-1) 0 0; color:var(--text-muted); font:400 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.sv-refresh,.sv-export { display:inline-flex; min-height:var(--touch-min); align-items:center; justify-content:center; gap:var(--space-2); padding:0 var(--space-4); border-radius:var(--radius-full); font:600 var(--label-size)/1 var(--font-core); cursor:pointer; }
.sv-refresh { border:1px solid var(--action-primary); background:var(--action-primary); color:var(--text-on-accent); }
.sv-export { flex:none; border:1px solid var(--border-strong); background:var(--surface-secondary); color:var(--text-primary); }
.sv-refresh:disabled,.sv-export:disabled { cursor:wait; opacity:.55; }
.sv-refresh:focus-visible,.sv-export:focus-visible,.sv-check:focus-visible,.sv-reset:focus-visible,.sv-restore__button:focus-visible,.sv-session-link:focus-visible,.sv-reconcile:focus-visible { outline:2px solid var(--accent-focus); outline-offset:3px; }
.sv-export-error { margin:var(--space-3) 0 0; color:var(--status-destructive); font:500 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.is-refreshing { animation:sv-spin .8s linear infinite; }
@keyframes sv-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) { .is-refreshing { animation:none; opacity:.72; } }
@media (hover:hover) {
  .sv-refresh:hover { background:var(--action-primary-hover); border-color:var(--action-primary-hover); }
  .sv-export:hover,.sv-check:hover,.sv-restore__button:hover,.sv-session-link:hover,.sv-reconcile:hover { background:var(--action-secondary-bg); }
  .sv-reset:hover { color:var(--text-primary); }
}
.sv-refresh:active { background:var(--action-primary-pressed); border-color:var(--action-primary-pressed); transform:scale(var(--press-scale)); }
.sv-export:active,.sv-check:active,.sv-restore__button:active,.sv-session-link:active,.sv-reconcile:active { background:var(--action-secondary-bg); transform:scale(var(--press-scale)); }
@media (max-width:560px) {
  .sv-heading-row,.sv-evidence { align-items:flex-start; flex-direction:column; }
  .sv-value { max-width:38%; }
  .sv-row { align-items:flex-start; }
  .sv-export,.sv-restore__button,.sv-session-link,.sv-reconcile { width:100%; }
  .sv-restore { align-items:flex-start; flex-wrap:wrap; }
  .sv-restore__text { flex-basis:calc(100% - 2.75rem); }
}
</style>
