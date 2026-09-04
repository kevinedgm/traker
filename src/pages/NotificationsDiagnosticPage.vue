<script setup>
/**
 * NotificationsDiagnosticPage — /settings/notifications
 *
 * Answers one question for the user: "¿por qué (no) me llegan
 * los recordatorios?" — with live checks, a test button and an
 * honest explanation of what a PWA can and cannot do today.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { BellRing, RefreshCw } from 'lucide-vue-next'
import { useAuthStore }     from '@stores/auth'
import { useHabitsStore }   from '@stores/habits'
import { useSettingsStore } from '@stores/settings'
import { useDayClosuresStore } from '@stores/dayClosures'
import { currentTimezone, isHabitScheduledForDate, localDateKey } from '@/features/habits/domain.js'
import {
  getDiagnostics,
  getNotificationLog,
  requestPermission,
  sendTestNotification,
  startScheduler,
} from '@services/notifications.service'
import { ensurePushSubscription, isPushConfigured } from '@services/push.service'
import SettingsShell from '@components/settings/SettingsShell.vue'

const authStore     = useAuthStore()
const habitsStore   = useHabitsStore()
const settingsStore = useSettingsStore()
const dayClosuresStore = useDayClosuresStore()

/* ── Live diagnostics ─────────────────────────────── */
const diag    = ref(null)
const log     = ref([])
const loading = ref(false)
const refreshError = ref('')

async function refresh() {
  if (loading.value) return
  loading.value = true
  refreshError.value = ''
  try {
    // Self-healing: try to (re)connect cloud reminders before reading state.
    // No-ops when permission/session/config are missing.
    await ensurePushSubscription().catch(() => {})
    diag.value = await getDiagnostics()
    log.value  = getNotificationLog()
  } catch {
    refreshError.value = 'No pudimos comprobar las notificaciones. Intenta otra vez.'
  } finally {
    loading.value = false
  }
}

const clockMinute = ref('')
let clockTimer = null

onMounted(() => {
  clockMinute.value = nowHHMM()
  clockTimer = window.setInterval(() => { clockMinute.value = nowHHMM() }, 30_000)
  refresh()
})

onUnmounted(() => {
  if (clockTimer !== null) window.clearInterval(clockTimer)
})

/* ── Status rows ──────────────────────────────────── */
// tone: 'ok' | 'warn' | 'pending'
const rows = computed(() => {
  if (!diag.value) return []
  const d = diag.value

  const permission = {
    granted: { tone: 'ok',      badge: 'Concedido',     sub: 'El navegador permite mostrar notificaciones' },
    default: { tone: 'pending', badge: 'Sin solicitar', sub: 'Aún no has activado el permiso' },
    denied:  { tone: 'warn',    badge: 'Bloqueado',     sub: 'Desbloquéalo en los ajustes de notificaciones de tu navegador o dispositivo' },
    unsupported: { tone: 'warn', badge: 'No compatible', sub: 'Este navegador no soporta notificaciones' },
  }[d.permission]

  const sw = {
    active:      { tone: 'ok',   badge: 'Activo',        sub: 'El proceso que muestra las notificaciones está corriendo' },
    registered:  { tone: 'pending', badge: 'Instalando…', sub: 'Registrado pero aún no activo — recarga la app' },
    none:        { tone: 'warn', badge: 'No registrado', sub: 'Recarga la app; si persiste, reinstálala' },
    error:       { tone: 'warn', badge: 'Error',         sub: 'No se pudo consultar el service worker' },
    unsupported: { tone: 'warn', badge: 'No compatible', sub: 'Este navegador no soporta service workers' },
  }[d.swState]

  return [
    { label: 'Permiso de notificaciones', ...permission },
    { label: 'Service worker', ...sw },
    d.standalone
      ? { label: 'App instalada', tone: 'ok', badge: 'Instalada', sub: 'Corriendo como app desde tu pantalla de inicio' }
      : d.requiresHomeScreenForPush
        ? { label: 'App instalada', tone: 'pending', badge: 'Falta instalar', sub: 'En iPhone, añade Traker a la pantalla de inicio antes de activar avisos con la app cerrada' }
        : { label: 'App instalada', tone: 'pending', badge: 'Navegador', sub: 'Busca “Instalar app” o “Añadir a pantalla de inicio” en el menú de tu navegador' },
    cloudRow(d),
  ]
})

function cloudRow(d) {
  const label = 'Recordatorios en la nube'
  if (d.pushSubscribed) {
    return { label, tone: 'ok', badge: 'Suscripción activa', sub: 'El dispositivo está registrado; la siguiente entrega confirmará el canal completo' }
  }
  if (!isPushConfigured()) {
    return { label, tone: 'pending', badge: 'Sin configurar', sub: 'Falta la clave de notificaciones del servidor (VAPID) en este despliegue' }
  }
  if (!authStore.isCloudAuthenticated) {
    return { label, tone: 'pending', badge: 'Requiere sesión', sub: 'Inicia sesión (Ajustes → Cuenta en la nube) para recibir avisos con la app cerrada' }
  }
  if (d.permission !== 'granted') {
    return { label, tone: 'pending', badge: 'Falta permiso', sub: 'Concede el permiso de notificaciones y vuelve a actualizar' }
  }
  return { label, tone: 'warn', badge: 'Sin conectar', sub: 'Toca el botón de actualizar (arriba a la derecha) para reintentar la conexión' }
}

/* ── Test notification ────────────────────────────── */
const testState = ref('idle')   // idle | sending | ok | failed
const testHint  = ref('')

async function runTest() {
  if (testState.value === 'sending') return
  testState.value = 'sending'
  testHint.value  = ''

  try {
    // If permission was never asked, ask now — best moment: user-initiated.
    if (diag.value?.permission === 'default') {
      const result = await requestPermission()
      await refresh()
      if (result === 'granted') {
        settingsStore.notificationsEnabled = true
        startScheduler(
          () => habitsStore.habits,
          () => settingsStore.$state,
          () => {
            const timezone = currentTimezone()
            return { timezone, dayClosure: dayClosuresStore.forDate(localDateKey(new Date(), timezone)) }
          },
        )
      } else {
        testState.value = 'failed'
        testHint.value  = result === 'denied'
          ? 'Permiso rechazado. Puedes reactivarlo en los ajustes del sistema.'
          : 'No se concedió el permiso.'
        return
      }
    }

    const res = await sendTestNotification()
    log.value = getNotificationLog()

    if (res.ok) {
      testState.value = 'ok'
      testHint.value  = 'Mostrada en este dispositivo.'
    } else {
      testState.value = 'failed'
      testHint.value  = res.reason === 'denied'
        ? 'El permiso está bloqueado en este dispositivo.'
        : `No se pudo mostrar (${res.reason}).`
    }
  } catch {
    testState.value = 'failed'
    testHint.value = 'No pudimos completar la prueba. Intenta otra vez.'
  }
}

/* ── Today's scheduled reminders ──────────────────── */
const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const todaySchedule = computed(() => {
  const items = []

  const groups = new Map()
  for (const h of habitsStore.habits) {
    if (!h.isActive || !h.reminder) continue
    if (!isHabitScheduledForDate(h, new Date())) continue
    groups.set(h.reminder, (groups.get(h.reminder) ?? 0) + 1)
  }
  for (const [time, count] of groups) items.push({ time, label: `${count} mínimo${count === 1 ? '' : 's'} programado${count === 1 ? '' : 's'}`, color: null })

  if (settingsStore.morningReminderEnabled && !groups.has(settingsStore.morningReminderTime)) {
    items.push({ time: settingsStore.morningReminderTime, label: 'Apertura del día', color: null })
  }

  if (settingsStore.closingReminderEnabled && !dayClosuresStore.forDate(localDateKey())) {
    items.push({ time: settingsStore.closingReminderTime, label: 'Cierre del día', color: null })
  }

  const now = clockMinute.value || nowHHMM()
  return items
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(i => ({ ...i, past: i.time <= now }))
})

/* ── Last sent ────────────────────────────────────── */
const lastSent = computed(() => log.value[0] ?? null)
const remindersShownToday = computed(() => {
  const today = new Date().toDateString()
  return log.value.filter(item => item.kind && new Date(item.at).toDateString() === today).length
})

const plannerExplanation = computed(() => ({
  disabled: 'Los recordatorios están apagados en Traker.',
  silenced: 'Pausaste los recordatorios hasta terminar hoy.',
  quiet_hours: 'Ahora estás dentro de tus horas de silencio.',
  daily_budget: 'Ya se usó el máximo de avisos de hoy.',
  cooldown: 'Hay una pausa entre avisos para evitar saturarte.',
  already_sent: 'El aviso correspondiente ya fue mostrado.',
  cloud_delivery: 'El canal en la nube está activo; el planificador local evita un aviso duplicado.',
  not_due: 'No hay ningún aviso que corresponda a esta hora.',
}[diag.value?.planner?.suppression] ?? 'El planificador todavía no ha evaluado un horario.'))

function formatWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Hoy, ${time}`
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}, ${time}`
}

</script>

<template>
  <SettingsShell title="Diagnóstico de notificaciones" subtitle="Comprueba si los recordatorios pueden funcionar en este dispositivo" back-to="/settings">
    <template #actions>
      <button class="nd-refresh" type="button" aria-label="Actualizar diagnóstico" :aria-busy="loading" :disabled="loading" @click="refresh">
        <RefreshCw :size="16" :stroke-width="2" aria-hidden="true" :class="{ 'is-refreshing': loading }" />
        {{ loading ? 'Comprobando…' : 'Actualizar' }}
      </button>
    </template>
    <div class="nd">

    <!-- ── System status ── -->
    <section class="nd-section" aria-label="Estado del sistema">
      <h2 class="nd-section__heading">Estado del sistema</h2>
      <div class="nd-card" :aria-busy="loading">
        <template v-if="loading">
          <div class="nd-row" role="status"><span class="nd-row__sub">Comprobando…</span></div>
        </template>
        <div v-else-if="refreshError" class="nd-row nd-row--action" role="alert">
          <div class="nd-row__text"><span class="nd-row__label">No se pudo actualizar</span><span class="nd-row__sub">{{ refreshError }}</span></div>
          <button class="nd-retry-btn" type="button" @click="refresh">Reintentar</button>
        </div>
        <template v-else>
          <template v-for="(row, i) in rows" :key="row.label">
            <div v-if="i > 0" class="nd-divider" />
            <div class="nd-row">
              <div class="nd-row__text">
                <span class="nd-row__label">{{ row.label }}</span>
                <span class="nd-row__sub">{{ row.sub }}</span>
              </div>
              <span class="nd-badge" :class="`nd-badge--${row.tone}`">{{ row.badge }}</span>
            </div>
          </template>
        </template>
      </div>
    </section>

    <!-- ── Test ── -->
    <section class="nd-section" aria-label="Prueba de notificación">
      <h2 class="nd-section__heading">Prueba</h2>
      <div class="nd-card">
        <div class="nd-row nd-row--action">
          <div class="nd-row__text">
            <span class="nd-row__label">Notificación de prueba</span>
            <span class="nd-row__sub">Usa el mismo camino que los recordatorios reales</span>
          </div>
          <button
            class="nd-test-btn"
            :class="`nd-test-btn--${testState}`"
            type="button"
            :disabled="testState === 'sending' || diag?.permission === 'denied' || diag?.permission === 'unsupported'"
            @click="runTest"
          >
            <BellRing :size="15" :stroke-width="2.2" aria-hidden="true" />
            {{ testState === 'sending' ? 'Enviando…' : 'Probar' }}
          </button>
        </div>
        <Transition name="nd-hint">
          <p
            v-if="testHint"
            class="nd-test-hint"
            :class="{ 'nd-test-hint--ok': testState === 'ok', 'nd-test-hint--bad': testState === 'failed' }"
            :role="testState === 'failed' ? 'alert' : 'status'"
          >
            {{ testHint }}
          </p>
        </Transition>
      </div>
    </section>

    <!-- ── Activity ── -->
    <section class="nd-section" aria-label="Actividad">
      <h2 class="nd-section__heading">Actividad</h2>
      <div class="nd-card">
        <div class="nd-row">
          <div class="nd-row__text">
            <span class="nd-row__label">Última notificación mostrada</span>
            <span v-if="lastSent" class="nd-row__sub">{{ lastSent.title }} · {{ formatWhen(lastSent.at) }}</span>
            <span v-else class="nd-row__sub">Ninguna todavía en este dispositivo</span>
          </div>
        </div>

        <div class="nd-divider" />

        <div class="nd-row">
          <div class="nd-row__text">
            <span class="nd-row__label">Presupuesto de hoy</span>
            <span class="nd-row__sub">{{ remindersShownToday }} de {{ settingsStore.notificationDailyBudget }} avisos mostrados</span>
          </div>
          <span class="nd-badge nd-badge--pending">{{ Math.max(0, settingsStore.notificationDailyBudget - remindersShownToday) }} disponibles</span>
        </div>

        <div class="nd-divider" />

        <div class="nd-row">
          <div class="nd-row__text">
            <span class="nd-row__label">Decisión del planificador local</span>
            <span class="nd-row__sub">{{ plannerExplanation }}</span>
          </div>
        </div>

        <div class="nd-divider" />

        <div class="nd-row nd-row--col">
          <span class="nd-row__label">Programadas para hoy</span>
          <template v-if="todaySchedule.length">
            <ul class="nd-sched">
              <li
                v-for="item in todaySchedule"
                :key="item.time + item.label"
                class="nd-sched__item"
                :class="{ 'nd-sched__item--past': item.past }"
              >
                <span class="nd-sched__time">{{ item.time }}</span>
                <span v-if="item.color" class="nd-sched__dot" :style="{ background: item.color }" aria-hidden="true" />
                <span class="nd-sched__label">{{ item.label }}</span>
                <span v-if="item.past" class="nd-sched__past-tag">hora cumplida</span>
              </li>
            </ul>
          </template>
          <span v-else class="nd-row__sub">Sin recordatorios configurados para hoy</span>
        </div>
      </div>
    </section>

    <!-- ── How reminders work / honest limitation ── -->
    <section class="nd-section" aria-label="Cómo funcionan los recordatorios">
      <div v-if="diag?.requiresHomeScreenForPush" class="nd-note" role="note">
        <p class="nd-note__title">En iPhone, primero añádela a tu pantalla de inicio</p>
        <p class="nd-note__body">
          Abre <strong>Compartir → Añadir a pantalla de inicio</strong>. Después
          abre Traker desde ese icono y activa las notificaciones desde Ajustes.
          Hasta entonces, los recordatorios sólo pueden mostrarse dentro de la
          app mientras está abierta.
        </p>
      </div>
      <div v-else-if="diag?.pushSubscribed" class="nd-note" role="note">
        <p class="nd-note__title">Dispositivo conectado</p>
        <p class="nd-note__body">
          La suscripción de este dispositivo está activa. Los recordatorios en
          la nube pueden llegar con la app cerrada; la primera entrega exitosa
          confirma el recorrido completo. Si dejan de llegar, vuelve aquí y
          actualiza para reparar la suscripción.
        </p>
      </div>
      <div v-else class="nd-note" role="note">
        <p class="nd-note__title">Importante: cómo funcionan hoy los recordatorios</p>
        <p class="nd-note__body">
          Sin la conexión a la nube, los avisos solo pueden aparecer
          <strong>mientras la app está abierta</strong>. Android pausa las apps
          web al cerrarlas o bloquear la pantalla, así que un recordatorio de
          las 8:00 no sonará si la app no está abierta a esa hora. No es un
          fallo de tu teléfono ni de los permisos.
        </p>
        <p class="nd-note__body">
          Para recibir avisos con la app cerrada, completa la fila
          <strong>"Recordatorios en la nube"</strong> de arriba: concede el
          permiso, inicia sesión y toca actualizar.
        </p>
      </div>
    </section>

    </div>
  </SettingsShell>
</template>

<style scoped>
.nd {
  width: 100%;
}

.nd-refresh {
  display: inline-flex;
  align-items: center;
  justify-content:center;
  gap: var(--space-2);
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: border-color var(--duration-base) var(--ease-standard);
}

.nd-refresh:disabled { cursor: wait; opacity: .62; }

/* ── Sections / cards (same language as SettingsPage) ── */
.nd-section {
  padding-bottom:var(--space-5);
}

.nd-section__heading {
  margin-top: 0;
  color: var(--color-text-faint);
  font-size: var(--label-size);
  line-height: var(--label-line);
  font-weight: var(--label-weight);
  letter-spacing: 0.045em;
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}

.nd-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  overflow: hidden;
}

.nd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
}

.nd-row--col {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.nd-row__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nd-row__label {
  color: var(--color-text);
  font-size: var(--body-size);
  font-weight: 600;
  line-height: 1.3;
}

.nd-row__sub {
  color: var(--color-text-faint);
  font-size: var(--body-small-size);
  font-weight: 400;
  line-height: var(--body-small-line);
  overflow-wrap: anywhere;
}

.nd-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0 var(--space-4);
}

/* ── Badges ── */
.nd-badge {
  display: inline-flex;
  align-items: center;
  height: 1.625rem;
  padding: 0 var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
}

.nd-badge--ok {
  background: color-mix(in srgb, var(--color-brand) 14%, transparent);
  color: var(--color-brand);
}

.nd-badge--warn {
  background: color-mix(in srgb, var(--status-warning) 12%, transparent);
  color: var(--status-warning);
}

.nd-badge--pending {
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
}

/* ── Test button ── */
.nd-test-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-brand);
  background: var(--color-brand);
  color: var(--color-brand-contrast);
  font-size: var(--text-xs);
  font-weight: 800;
  cursor: pointer;
  touch-action: manipulation;
  flex-shrink: 0;
  transition: transform var(--duration-fast) var(--ease-standard), opacity var(--duration-base);
}

.nd-retry-btn {
  min-height: var(--touch-min);
  padding-inline: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text);
  background: var(--color-surface-raised);
  font: 700 var(--text-xs)/1 var(--font-sans);
  cursor: pointer;
}

.nd-test-btn:active { transform: scale(0.97); }
.nd-test-btn--ok { animation:nd-test-confirm var(--dur-celebrate) var(--ease-enter); }

.nd-test-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.nd-test-hint {
  padding: 0 var(--space-3) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.nd-test-hint--ok  { color: var(--color-brand); }
.nd-test-hint--bad { color: var(--color-danger); }
.nd-hint-enter-active { transition:opacity var(--dur-base) var(--ease-calm),filter var(--dur-view) var(--ease-enter); }
.nd-hint-leave-active { transition:opacity var(--dur-fast) var(--ease-calm); }
.nd-hint-enter-from { opacity:0; filter:blur(3px); }
.nd-hint-leave-to { opacity:0; }

/* ── Today schedule ── */
.nd-sched {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}

.nd-sched__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--body-small-size);
}

.nd-sched__item--past { opacity: 0.5; }

.nd-sched__time {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--color-text);
  min-width: 2.9rem;
}

.nd-sched__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.nd-sched__label {
  color: var(--color-text-muted);
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.nd-sched__past-tag {
  color: var(--color-text-faint);
  font-size: var(--caption-size);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ── Limitation note ── */
.nd-note {
  border: 1px solid color-mix(in srgb, var(--color-brand) 22%, var(--color-border));
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--color-brand) 7%, var(--color-surface)),
      var(--color-surface));
  border-radius: var(--radius-2xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.nd-note__title {
  color: var(--color-text);
  font-size: var(--body-size);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.nd-note__body {
  color: var(--color-text-muted);
  max-width: 65ch;
  font-size: var(--body-small-size);
  line-height: var(--body-small-line);
  font-weight: 400;
}

.nd-note__body strong { color: var(--color-text); font-weight: 700; }

@media (max-width: 520px) {
  .nd-row { align-items: flex-start; }
  .nd-row--action { flex-direction: column; }
  .nd-test-btn,
  .nd-retry-btn { width: 100%; justify-content: center; }
  .nd-badge { align-self: flex-start; }
  .nd-sched__item { align-items: baseline; flex-wrap: wrap; }
  .nd-sched__label { flex-basis: calc(100% - 4.9rem); }
}

@media (max-width: 360px) {
  .nd-row { flex-direction: column; }
}

@media (min-width: 640px) {
  .nd-row { padding: var(--space-4); }
}

@media (hover: hover) and (pointer: fine) {
  .nd-refresh:not(:disabled):hover,
  .nd-retry-btn:hover { border-color: var(--color-brand); color: var(--color-text); }
  .nd-test-btn:not(:disabled):hover { background: var(--action-primary-hover); }
}

@media (prefers-reduced-motion: no-preference) {
  .is-refreshing { animation: nd-refresh-spin 800ms linear infinite; }
}

@keyframes nd-refresh-spin { to { transform: rotate(360deg); } }
@keyframes nd-test-confirm { 45% { box-shadow:0 4px 18px color-mix(in srgb,var(--color-brand) 28%,transparent); } }
@media (prefers-reduced-motion:reduce) {
  .nd-test-btn--ok { animation:none; }
  .nd-hint-enter-from { filter:none; }
}
</style>
