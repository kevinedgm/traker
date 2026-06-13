<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore }      from '@stores/app'
import { useAuthStore }     from '@stores/auth'
import { useSettingsStore } from '@stores/settings'
import { useHabitsStore }   from '@stores/habits'
import { signOut }           from '@services/supabase/auth.service'
import { isSupabaseEnabled } from '@services/supabase/client.js'
import {
  getPermission,
  requestPermission,
  startScheduler,
  showNotification,
} from '@services/notifications.service'
import { ensurePushSubscription } from '@services/push.service'
import { pushSettings } from '@services/supabase/sync.service'

const router        = useRouter()
const appStore      = useAppStore()
const authStore     = useAuthStore()
const settingsStore = useSettingsStore()
const habitsStore   = useHabitsStore()

/* ── Cloud account ── */
async function handleSignOut() {
  await signOut()
  router.replace('/')
}

/* ── Notifications ── */
const notifPermission = ref(getPermission())

const notifLabel = {
  granted:     'Activadas ✓',
  denied:      'Bloqueadas por el navegador',
  default:     'Sin activar',
  unsupported: 'No compatible con este navegador',
}

async function askNotifPermission() {
  const result = await requestPermission()
  notifPermission.value = result
  if (result === 'granted') {
    settingsStore.notificationsEnabled = true
    startScheduler(() => habitsStore.habits, () => settingsStore.$state)
    showNotification('Traker', { body: '🔔 Notificaciones activadas correctamente' })
    // Cloud reminders: register this device + sync prefs (no-op if signed out)
    pushSettings(settingsStore.$state).catch(console.warn)
    ensurePushSubscription().catch(console.warn)
  }
}

function habitsWithReminder() {
  return habitsStore.habits.filter(h => h.reminder).length
}

/* ── Theme ── */
const themeOptions = [
  { value: 'light',  label: 'Claro'   },
  { value: 'dark',   label: 'Oscuro'   },
  { value: 'system', label: 'Sistema'  },
]

/* ── PIN ── */
const showPinForm  = ref(false)
const pinInput     = ref('')
const pinConfirm   = ref('')
const pinError     = ref('')

function savePinForm() {
  pinError.value = ''
  if (pinInput.value.length < 4) {
    pinError.value = 'El PIN debe tener al menos 4 dígitos.'
    return
  }
  if (pinInput.value !== pinConfirm.value) {
    pinError.value = 'Los PIN no coinciden.'
    return
  }
  authStore.setPin(pinInput.value)
  showPinForm.value = false
  pinInput.value    = ''
  pinConfirm.value  = ''
}

function removePin() {
  if (confirm('¿Eliminar el PIN? La app quedará sin protección.')) {
    authStore.resetPin()
  }
}

/* ── Danger ── */
function resetAllData() {
  if (confirm('⚠️ ¿Eliminar TODOS los hábitos y registros? Esta acción no se puede deshacer.')) {
    habitsStore.habits.splice(0, habitsStore.habits.length)
  }
}
</script>

<template>
  <div class="sp">

    <!-- Header -->
    <header class="sp-header">
      <h1 class="sp-header__title">Ajustes</h1>
      <p class="sp-header__sub">Personaliza tu experiencia</p>
    </header>

    <!-- ── Profile ── -->
    <section class="sp-section">
      <p class="sp-section__heading">Perfil</p>

      <div class="sp-card">
        <div class="sp-row sp-row--col">
          <label class="sp-row__label" for="display-name">Tu nombre</label>
          <span class="sp-row__sub">Aparece en el saludo del tablero</span>
          <input
            id="display-name"
            v-model="settingsStore.displayName"
            class="sp-input sp-input--inline"
            type="text"
            maxlength="32"
            placeholder="Escribe tu nombre…"
            autocomplete="given-name"
            spellcheck="false"
          />
        </div>
      </div>
    </section>

    <!-- ── Appearance ── -->
    <section class="sp-section">
      <p class="sp-section__heading">Apariencia</p>

      <div class="sp-card">
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label">Tema</span>
            <span class="sp-row__sub">Elige entre claro, oscuro o el del sistema</span>
          </div>
        </div>
        <div class="sp-segmented">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            class="sp-seg-btn"
            :class="{ 'sp-seg-btn--active': appStore.theme === opt.value }"
            type="button"
            :aria-pressed="appStore.theme === opt.value"
            @click="appStore.setTheme(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </section>

    <!-- ── Display ── -->
    <section class="sp-section">
      <p class="sp-section__heading">Visualización</p>

      <div class="sp-card">
        <div class="sp-row sp-row--toggle">
          <div class="sp-row__text">
            <span class="sp-row__label">Mostrar continuidad</span>
            <span class="sp-row__sub">Indicadores suaves de avance acumulado</span>
          </div>
          <button
            class="sp-toggle"
            :class="{ 'sp-toggle--on': settingsStore.showStreak }"
            type="button"
            role="switch"
            :aria-pressed="settingsStore.showStreak"
            :aria-checked="settingsStore.showStreak"
            aria-label="Mostrar continuidad"
            @click="settingsStore.showStreak = !settingsStore.showStreak"
          >
            <span class="sp-toggle__thumb" />
          </button>
        </div>

        <div class="sp-divider" />

        <div class="sp-row sp-row--toggle">
          <div class="sp-row__text">
            <span class="sp-row__label">Mostrar progreso</span>
            <span class="sp-row__sub">Contador de completados en el tablero</span>
          </div>
          <button
            class="sp-toggle"
            :class="{ 'sp-toggle--on': settingsStore.showProgress }"
            type="button"
            role="switch"
            :aria-pressed="settingsStore.showProgress"
            :aria-checked="settingsStore.showProgress"
            aria-label="Mostrar progreso"
            @click="settingsStore.showProgress = !settingsStore.showProgress"
          >
            <span class="sp-toggle__thumb" />
          </button>
        </div>
      </div>
    </section>

    <!-- ── Security ── -->
    <section class="sp-section">
      <p class="sp-section__heading">Seguridad</p>

      <div class="sp-card">
        <!-- PIN status -->
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label">PIN de acceso</span>
            <span class="sp-row__sub">{{ authStore.hasPin ? 'PIN configurado ✓' : 'Sin PIN' }}</span>
          </div>
          <div class="sp-row__actions">
            <button class="sp-action-btn" type="button" @click="showPinForm = !showPinForm">
              {{ authStore.hasPin ? 'Cambiar' : 'Activar' }}
            </button>
            <button v-if="authStore.hasPin" class="sp-action-btn sp-action-btn--danger" type="button" @click="removePin">
              Quitar
            </button>
          </div>
        </div>

        <!-- PIN form (inline) -->
        <Transition name="sp-slide">
          <div v-if="showPinForm" class="sp-pin-form">
            <input
              v-model="pinInput"
              class="sp-input"
              type="password"
              inputmode="numeric"
              maxlength="8"
              placeholder="Nuevo PIN (mínimo 4 dígitos)"
              aria-label="Nuevo PIN"
            />
            <input
              v-model="pinConfirm"
              class="sp-input"
              type="password"
              inputmode="numeric"
              maxlength="8"
              placeholder="Confirmar PIN"
              aria-label="Confirmar PIN"
            />
            <p v-if="pinError" class="sp-pin-error" role="alert">{{ pinError }}</p>
            <div class="sp-pin-actions">
              <button class="sp-action-btn" type="button" @click="showPinForm = false; pinError = ''">Cancelar</button>
              <button class="sp-action-btn sp-action-btn--primary" type="button" @click="savePinForm">Guardar PIN</button>
            </div>
          </div>
        </Transition>
      </div>
    </section>

    <!-- ── Data ── -->
    <section class="sp-section">
      <p class="sp-section__heading">Datos</p>

      <div class="sp-card">
        <div class="sp-row sp-row--toggle">
          <div class="sp-row__text">
            <span class="sp-row__label">Incluir emociones en exportación</span>
          </div>
          <button
            class="sp-toggle"
            :class="{ 'sp-toggle--on': settingsStore.includeEmotionsInExport }"
            type="button"
            role="switch"
            :aria-pressed="settingsStore.includeEmotionsInExport"
            :aria-checked="settingsStore.includeEmotionsInExport"
            aria-label="Incluir emociones en exportación"
            @click="settingsStore.includeEmotionsInExport = !settingsStore.includeEmotionsInExport"
          >
            <span class="sp-toggle__thumb" />
          </button>
        </div>
      </div>
    </section>

    <!-- ── Notifications ── -->
    <section v-if="notifPermission !== 'unsupported'" class="sp-section">
      <p class="sp-section__heading">Recordatorios</p>

      <div class="sp-card">
        <!-- Permission status row -->
        <div class="sp-row">
          <div class="sp-row__text">
            <span
              class="sp-row__label"
              :class="{
                'sp-row__label--brand':  notifPermission === 'granted',
                'sp-row__label--danger': notifPermission === 'denied',
              }"
            >
              {{ notifLabel[notifPermission] }}
            </span>
            <span class="sp-row__sub">
              <template v-if="notifPermission === 'granted'">
                {{ habitsWithReminder() }} hábito{{ habitsWithReminder() !== 1 ? 's' : '' }} con recordatorio activo
              </template>
              <template v-else-if="notifPermission === 'denied'">
                Actívalas en Configuración del navegador → Notificaciones
              </template>
              <template v-else>
                Activa para recibir avisos a la hora que elijas por hábito
              </template>
            </span>
          </div>

          <!-- CTA depending on state -->
          <button
            v-if="notifPermission === 'default'"
            class="sp-action-btn sp-action-btn--primary"
            type="button"
            @click="askNotifPermission"
          >
            Activar
          </button>
          <span v-else-if="notifPermission === 'denied'" class="sp-badge sp-badge--danger">
            Bloqueado
          </span>
          <span v-else class="sp-badge sp-badge--ok">
            Activo
          </span>
        </div>

        <!-- Diagnostics — always reachable, whatever the permission state -->
        <div class="sp-divider" />
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label">Diagnóstico y prueba</span>
            <span class="sp-row__sub">Comprueba por qué llegan (o no) los avisos</span>
          </div>
          <button class="sp-action-btn" type="button" @click="router.push('/settings/notifications')">
            Abrir
          </button>
        </div>

        <!-- Info row: configure reminders per habit -->
        <div v-if="notifPermission === 'granted'" class="sp-divider" />
        <div v-if="notifPermission === 'granted'" class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label">Horarios por hábito</span>
            <span class="sp-row__sub">Configura la hora y días al crear o editar cada hábito</span>
          </div>
          <button class="sp-action-btn" type="button" @click="router.push('/')">
            Ver hábitos
          </button>
        </div>

        <template v-if="notifPermission === 'granted'">
          <div class="sp-divider" />

          <div class="sp-row sp-row--toggle">
            <div class="sp-row__text">
              <span class="sp-row__label">Motivación por la mañana</span>
              <span class="sp-row__sub">Un mensaje suave para arrancar el día</span>
            </div>
            <button
              class="sp-toggle"
              :class="{ 'sp-toggle--on': settingsStore.morningReminderEnabled }"
              type="button"
              role="switch"
              :aria-pressed="settingsStore.morningReminderEnabled"
              :aria-checked="settingsStore.morningReminderEnabled"
              aria-label="Activar recordatorio matutino de motivacion"
              @click="settingsStore.morningReminderEnabled = !settingsStore.morningReminderEnabled"
            >
              <span class="sp-toggle__thumb" />
            </button>
          </div>

          <div v-if="settingsStore.morningReminderEnabled" class="sp-divider" />
          <div v-if="settingsStore.morningReminderEnabled" class="sp-row">
            <div class="sp-row__text">
              <span class="sp-row__label">Hora del mensaje matutino</span>
              <span class="sp-row__sub">Se manda una vez al día aunque todavía no toque un hábito</span>
            </div>
            <input
              v-model="settingsStore.morningReminderTime"
              class="sp-input sp-input--inline sp-input--time"
              type="time"
              aria-label="Hora del mensaje matutino"
            />
          </div>

          <div class="sp-divider" />

          <div class="sp-row sp-row--toggle">
            <div class="sp-row__text">
              <span class="sp-row__label">Recordatorio si no registraste nada</span>
              <span class="sp-row__sub">Te avisa una vez al día si todavía no hay ningún registro</span>
            </div>
            <button
              class="sp-toggle"
              :class="{ 'sp-toggle--on': settingsStore.inactivityReminderEnabled }"
              type="button"
              role="switch"
              :aria-pressed="settingsStore.inactivityReminderEnabled"
              :aria-checked="settingsStore.inactivityReminderEnabled"
              aria-label="Activar recordatorio por falta de registro"
              @click="settingsStore.inactivityReminderEnabled = !settingsStore.inactivityReminderEnabled"
            >
              <span class="sp-toggle__thumb" />
            </button>
          </div>

          <div v-if="settingsStore.inactivityReminderEnabled" class="sp-divider" />
          <div v-if="settingsStore.inactivityReminderEnabled" class="sp-row">
            <div class="sp-row__text">
              <span class="sp-row__label">Hora del recordatorio general</span>
              <span class="sp-row__sub">Solo aparece si ese día aún no has registrado nada</span>
            </div>
            <input
              v-model="settingsStore.inactivityReminderTime"
              class="sp-input sp-input--inline sp-input--time"
              type="time"
              aria-label="Hora del recordatorio general"
            />
          </div>
        </template>
      </div>
    </section>

    <!-- ── Cloud account ── -->
    <section v-if="isSupabaseEnabled" class="sp-section">
      <p class="sp-section__heading">Cuenta en la nube</p>

      <div class="sp-card">
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label" :class="{ 'sp-row__label--brand': authStore.isCloudAuthenticated }">
              {{ authStore.isCloudAuthenticated ? 'Sesión activa' : 'Sin cuenta' }}
            </span>
            <span class="sp-row__sub">
              {{ authStore.isCloudAuthenticated
                ? authStore.cloudUser?.email
                : 'Conecta para sincronizar tus datos en la nube' }}
            </span>
          </div>
          <div class="sp-row__actions">
            <button
              v-if="!authStore.isCloudAuthenticated"
              class="sp-action-btn sp-action-btn--primary"
              type="button"
              @click="router.push('/auth/login')"
            >
              Conectar
            </button>
            <template v-else>
              <button class="sp-action-btn" type="button" @click="router.push('/auth/login')">
                Cuenta
              </button>
              <button class="sp-action-btn sp-action-btn--danger" type="button" @click="handleSignOut">
                Salir
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Danger zone ── -->
    <section class="sp-section">
      <p class="sp-section__heading">Zona peligrosa</p>
      <div class="sp-card sp-card--danger">
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label sp-row__label--danger">Eliminar todos los datos</span>
            <span class="sp-row__sub">Borra hábitos y registros de forma permanente</span>
          </div>
          <button class="sp-action-btn sp-action-btn--danger" type="button" @click="resetAllData">
            Eliminar
          </button>
        </div>
      </div>
    </section>

    <!-- Spacer -->
    <p class="sp-version">Traker · v1.0</p>

  </div>
</template>

<style scoped>
.sp {
  min-height: 100svh;
  background: var(--color-bg);
  padding-bottom: calc(var(--space-6) + 5rem); /* space for pill nav */
  max-width: 600px;
  margin-inline: auto;
  width: 100%;
}

@media (min-width: 768px) {
  .sp {
    padding-bottom: var(--space-10);
  }
}

@media (min-width: 1024px) {
  .sp {
    max-width: 720px;
    padding-bottom: var(--space-12);
  }
}

/* ── Header ── */
.sp-header {
  padding: max(var(--space-6), env(safe-area-inset-top)) var(--space-5) var(--space-4);
}

.sp-header__title {
  color: var(--color-text);
  font-size: var(--text-2xl);
  font-weight: 760;
  letter-spacing: -0.01em;
}

.sp-header__sub {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* ── Section ── */
.sp-section {
  padding: 0 var(--space-4) var(--space-4);
}

.sp-section__heading {
  color: var(--color-text-faint);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}

/* ── Card ── */
.sp-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  overflow: hidden;
}

.sp-card--danger {
  border-color: color-mix(in srgb, var(--color-danger) 24%, var(--color-border));
}

/* ── Row ── */
.sp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
}

.sp-row--toggle {
  align-items: center;
}

.sp-row--col {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.sp-input--inline {
  min-height: 2.5rem;
  border-radius: var(--radius-xl);
}

.sp-row__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sp-row__label {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 650;
  line-height: 1.2;
}

.sp-row__label--danger {
  color: var(--color-danger);
}

.sp-row__label--brand {
  color: var(--color-brand);
}

.sp-row__sub {
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 500;
}

.sp-row__actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* ── Divider ── */
.sp-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0 var(--space-4);
}

/* ── Segmented theme selector ── */
.sp-segmented {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.sp-seg-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-xl);
  border: 1.5px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    border-color    var(--duration-base) var(--ease-standard),
    background      var(--duration-base) var(--ease-standard),
    color           var(--duration-base) var(--ease-standard);
}

.sp-seg-btn--active {
  border-color: var(--color-brand);
  background: color-mix(in srgb, var(--color-brand) 12%, var(--color-surface));
  color: var(--color-brand);
}

/* ── Toggle ── */
.sp-toggle {
  flex-shrink: 0;
  position: relative;
  width: 2.75rem;
  height: 1.625rem;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-surface-raised);
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--duration-base) var(--ease-standard);
}

.sp-toggle--on {
  background: var(--color-brand);
}

.sp-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  background: white;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.2);
  transition: transform var(--duration-base) var(--ease-emphasis);
}

.sp-toggle--on .sp-toggle__thumb {
  transform: translateX(1.125rem);
}

/* ── Action buttons ── */
.sp-action-btn {
  display: inline-flex;
  align-items: center;
  height: 2rem;
  padding: 0 var(--space-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background     var(--duration-base) var(--ease-standard),
    border-color   var(--duration-base) var(--ease-standard),
    transform      var(--duration-fast) var(--ease-standard);
  white-space: nowrap;
}

.sp-action-btn:hover  { border-color: var(--primary-border); box-shadow: var(--shadow-hover-glow); }
.sp-action-btn:active { transform: scale(0.98); }

.sp-action-btn--primary {
  border-color: var(--color-brand);
  background: var(--color-brand);
  color: var(--color-brand-contrast);
}

.sp-action-btn--danger {
  border-color: color-mix(in srgb, var(--color-danger) 30%, var(--color-border));
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface-raised));
}

/* ── PIN form ── */
.sp-pin-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: 0 var(--space-4) var(--space-4);
  border-top: 1px solid var(--color-border);
}

.sp-input {
  width: 100%;
  min-height: 2.75rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-text);
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
  font-family: inherit;
  outline: none;
  transition: border-color var(--duration-base) var(--ease-standard);
}

.sp-input:focus {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-brand) 12%, transparent);
}

.sp-input::placeholder { color: var(--color-text-faint); }

.sp-pin-error {
  color: var(--color-danger);
  font-size: var(--text-xs);
  font-weight: 600;
}

.sp-pin-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* ── Slide transition ── */
.sp-slide-enter-active,
.sp-slide-leave-active {
  transition:
    opacity    var(--duration-base) var(--ease-standard),
    max-height var(--duration-slow) var(--ease-standard);
  overflow: hidden;
  max-height: 20rem;
}

.sp-slide-enter-from,
.sp-slide-leave-to {
  opacity: 0;
  max-height: 0;
}

/* ── Status badges ── */
.sp-badge {
  display: inline-flex;
  align-items: center;
  height: 1.625rem;
  padding: 0 var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  flex-shrink: 0;
}

.sp-badge--ok {
  background: color-mix(in srgb, var(--color-brand) 14%, transparent);
  color: var(--color-brand);
}

.sp-badge--danger {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}

/* ── Version ── */
.sp-version {
  text-align: center;
  color: var(--color-text-faint);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: var(--space-5) 0;
}
</style>
