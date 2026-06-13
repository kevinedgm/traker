<script setup>
/**
 * NotificationsDiagnosticPage — /settings/notifications
 *
 * Answers one question for the user: "¿por qué (no) me llegan
 * los recordatorios?" — with live checks, a test button and an
 * honest explanation of what a PWA can and cannot do today.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, BellRing, RefreshCw } from 'lucide-vue-next'
import { useAuthStore }     from '@stores/auth'
import { useHabitsStore }   from '@stores/habits'
import { useSettingsStore } from '@stores/settings'
import {
  getDiagnostics,
  getNotificationLog,
  requestPermission,
  sendTestNotification,
  startScheduler,
} from '@services/notifications.service'
import { ensurePushSubscription, isPushConfigured } from '@services/push.service'

const router        = useRouter()
const authStore     = useAuthStore()
const habitsStore   = useHabitsStore()
const settingsStore = useSettingsStore()

/* ── Live diagnostics ─────────────────────────────── */
const diag    = ref(null)
const log     = ref([])
const loading = ref(true)

async function refresh() {
  loading.value = true
  // Self-healing: try to (re)connect cloud reminders before reading state.
  // No-ops when permission/session/config are missing.
  await ensurePushSubscription().catch(() => {})
  diag.value = await getDiagnostics()
  log.value  = getNotificationLog()
  loading.value = false
}

onMounted(refresh)

/* ── Status rows ──────────────────────────────────── */
// tone: 'ok' | 'warn' | 'pending'
const rows = computed(() => {
  if (!diag.value) return []
  const d = diag.value

  const permission = {
    granted: { tone: 'ok',      badge: 'Concedido',     sub: 'El navegador permite mostrar notificaciones' },
    default: { tone: 'pending', badge: 'Sin solicitar', sub: 'Aún no has activado el permiso' },
    denied:  { tone: 'warn',    badge: 'Bloqueado',     sub: 'Desbloquéalo en Ajustes de Android → Apps → Traker (o Chrome) → Notificaciones' },
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
      : { label: 'App instalada', tone: 'pending', badge: 'Navegador', sub: 'Instálala: menú de Chrome → "Añadir a pantalla de inicio"' },
    cloudRow(d),
  ]
})

function cloudRow(d) {
  const label = 'Recordatorios en la nube'
  if (d.pushSubscribed) {
    return { label, tone: 'ok', badge: 'Conectado', sub: 'Recibirás avisos aunque la app esté cerrada' }
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
  testState.value = 'sending'
  testHint.value  = ''

  // If permission was never asked, ask now — best moment: user-initiated.
  if (diag.value?.permission === 'default') {
    const result = await requestPermission()
    await refresh()
    if (result === 'granted') {
      settingsStore.notificationsEnabled = true
      startScheduler(() => habitsStore.habits, () => settingsStore.$state)
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
    testHint.value  = 'Enviada — revisa tu barra de notificaciones.'
  } else {
    testState.value = 'failed'
    testHint.value  = res.reason === 'denied'
      ? 'El permiso está bloqueado en este dispositivo.'
      : `No se pudo mostrar (${res.reason}).`
  }
}

/* ── Today's scheduled reminders ──────────────────── */
const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const todaySchedule = computed(() => {
  const weekday = new Date().getDay()
  const items = []

  if (settingsStore.morningReminderEnabled) {
    items.push({ time: settingsStore.morningReminderTime, label: 'Motivación de la mañana', color: null })
  }

  for (const h of habitsStore.habits) {
    if (!h.isActive || !h.reminder) continue
    if (Array.isArray(h.reminderDays) && h.reminderDays.length && !h.reminderDays.includes(weekday)) continue
    items.push({ time: h.reminder, label: h.name, color: h.color })
  }

  if (settingsStore.inactivityReminderEnabled) {
    items.push({ time: settingsStore.inactivityReminderTime, label: 'Aviso si no registras nada', color: null })
  }

  const now = nowHHMM()
  return items
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(i => ({ ...i, past: i.time <= now }))
})

/* ── Last sent ────────────────────────────────────── */
const lastSent = computed(() => log.value[0] ?? null)

function formatWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Hoy, ${time}`
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}, ${time}`
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/settings')
}
</script>

<template>
  <div class="nd">

    <!-- ── Nav ── -->
    <nav class="nd-nav">
      <button class="nd-nav__btn" type="button" aria-label="Volver" @click="goBack">
        <ArrowLeft :size="18" :stroke-width="2" />
        <span>Volver</span>
      </button>
      <span class="nd-nav__title">Notificaciones</span>
      <button class="nd-nav__btn nd-nav__btn--icon" type="button" aria-label="Actualizar diagnóstico" @click="refresh">
        <RefreshCw :size="16" :stroke-width="2" />
      </button>
    </nav>

    <header class="nd-header">
      <h1 class="nd-header__title">Diagnóstico</h1>
      <p class="nd-header__sub">Comprueba si los recordatorios pueden funcionar en este dispositivo</p>
    </header>

    <!-- ── System status ── -->
    <section class="nd-section" aria-label="Estado del sistema">
      <p class="nd-section__heading">Estado del sistema</p>
      <div class="nd-card">
        <template v-if="loading">
          <div class="nd-row"><span class="nd-row__sub">Comprobando…</span></div>
        </template>
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
      <p class="nd-section__heading">Prueba</p>
      <div class="nd-card">
        <div class="nd-row">
          <div class="nd-row__text">
            <span class="nd-row__label">Notificación de prueba</span>
            <span class="nd-row__sub">Usa el mismo camino que los recordatorios reales</span>
          </div>
          <button
            class="nd-test-btn"
            type="button"
            :disabled="testState === 'sending' || diag?.permission === 'denied' || diag?.permission === 'unsupported'"
            @click="runTest"
          >
            <BellRing :size="15" :stroke-width="2.2" />
            {{ testState === 'sending' ? 'Enviando…' : 'Probar' }}
          </button>
        </div>
        <p
          v-if="testHint"
          class="nd-test-hint"
          :class="{ 'nd-test-hint--ok': testState === 'ok', 'nd-test-hint--bad': testState === 'failed' }"
          role="status"
        >
          {{ testHint }}
        </p>
      </div>
    </section>

    <!-- ── Activity ── -->
    <section class="nd-section" aria-label="Actividad">
      <p class="nd-section__heading">Actividad</p>
      <div class="nd-card">
        <div class="nd-row">
          <div class="nd-row__text">
            <span class="nd-row__label">Última notificación mostrada</span>
            <span v-if="lastSent" class="nd-row__sub">{{ lastSent.title }} · {{ formatWhen(lastSent.at) }}</span>
            <span v-else class="nd-row__sub">Ninguna todavía en este dispositivo</span>
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
                <span v-if="item.past" class="nd-sched__past-tag">pasó</span>
              </li>
            </ul>
          </template>
          <span v-else class="nd-row__sub">Sin recordatorios configurados para hoy</span>
        </div>
      </div>
    </section>

    <!-- ── How reminders work / honest limitation ── -->
    <section class="nd-section" aria-label="Cómo funcionan los recordatorios">
      <div v-if="diag?.pushSubscribed" class="nd-note" role="note">
        <p class="nd-note__title">Todo listo</p>
        <p class="nd-note__body">
          Este dispositivo está conectado a los <strong>recordatorios en la
          nube</strong>: los avisos llegan aunque la app esté cerrada o la
          pantalla bloqueada. Si dejan de llegar, vuelve aquí y toca el botón
          de actualizar — la conexión se repara sola.
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
</template>

<style scoped>
.nd {
  min-height: 100svh;
  background: var(--color-bg);
  padding-bottom: var(--space-10);
  max-width: 600px;
  margin-inline: auto;
  width: 100%;
}

/* ── Nav ── */
.nd-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-4) 0;
}

.nd-nav__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 2.25rem;
  padding: 0 var(--space-3);
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

.nd-nav__btn:hover { border-color: var(--color-brand); color: var(--color-text); }

.nd-nav__btn--icon { padding: 0 var(--space-2); aspect-ratio: 1; justify-content: center; }

.nd-nav__title {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 700;
}

/* ── Header ── */
.nd-header {
  padding: var(--space-5) var(--space-5) var(--space-4);
}

.nd-header__title {
  color: var(--color-text);
  font-size: var(--text-2xl);
  font-weight: 760;
  letter-spacing: -0.01em;
}

.nd-header__sub {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* ── Sections / cards (same language as SettingsPage) ── */
.nd-section {
  padding: 0 var(--space-4) var(--space-4);
}

.nd-section__heading {
  color: var(--color-text-faint);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.10em;
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
  font-size: var(--text-sm);
  font-weight: 650;
  line-height: 1.2;
}

.nd-row__sub {
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 500;
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
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
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
  height: 2.25rem;
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

.nd-test-btn:active { transform: scale(0.97); }

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
  font-size: var(--text-xs);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nd-sched__past-tag {
  color: var(--color-text-faint);
  font-size: 0.625rem;
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
  font-size: var(--text-sm);
  font-weight: 760;
  letter-spacing: -0.01em;
}

.nd-note__body {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: 1.6;
  font-weight: 500;
}

.nd-note__body strong { color: var(--color-text); font-weight: 700; }
</style>
