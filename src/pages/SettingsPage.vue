<script setup>
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore }      from '@stores/app'
import { useAuthStore }     from '@stores/auth'
import { useSettingsStore } from '@stores/settings'
import { useHabitsStore }   from '@stores/habits'
import { useDayClosuresStore } from '@stores/dayClosures'
import { useFlexibleGroupsStore } from '@stores/flexibleGroups'
import {
  deleteCloudAccount,
  signInWithPassword,
  signOut,
} from '@services/supabase/auth.service'
import { isSupabaseEnabled, supabase } from '@services/supabase/client.js'
import {
  getPermission,
  requestPermission,
  startScheduler,
  showNotification,
} from '@services/notifications.service'
import { ensurePushSubscription } from '@services/push.service'
import { removePushSubscription } from '@services/push.service'
import { pushSettings } from '@services/supabase/sync.service'
import { ChevronRight, Database, ListChecks, Target } from 'lucide-vue-next'
import { features } from '@/config/features.js'
import { currentTimezone, localDateKey } from '@/features/habits/domain.js'
import {
  deleteAccountDeviceData,
  deleteLocalDeviceData,
  exportLocalDeviceData,
  importLocalDeviceData,
  validateLocalDeviceBackup,
} from '@/services/local/dataPortability.service.js'
import AuroraConfirmDialog from '@components/aurora/surfaces/AuroraConfirmDialog.vue'
import SettingsShell from '@components/settings/SettingsShell.vue'
import BaseSegmentedControl from '@components/ui/BaseSegmentedControl.vue'
import DeleteCloudAccountDialog from '@components/settings/DeleteCloudAccountDialog.vue'

const router        = useRouter()
const appStore      = useAppStore()
const authStore     = useAuthStore()
const settingsStore = useSettingsStore()
const habitsStore   = useHabitsStore()
const dayClosuresStore = useDayClosuresStore()
const flexibleGroupsStore = useFlexibleGroupsStore()
const signingOut = ref(false)
const deleteAccountOpen = ref(false)
const deleteAccountBusy = ref(false)
const deleteAccountError = ref('')
const resetBusy = ref(false)
const exportBusy = ref(false)
const restoreBusy = ref(false)
const permissionBusy = ref(false)
const operationMessage = ref('')
const operationFailed = ref(false)
const backupInput = ref(null)
const pendingBackup = ref(null)
const pendingBackupName = ref('')
const RESTORE_NOTICE_KEY = 'traker:restore-notice'
const ids = {
  theme: useId(),
  tone: useId(),
  pin: useId(),
  pinConfirm: useId(),
  pinError: useId(),
  backup: useId(),
}

onMounted(() => {
  const notice = sessionStorage.getItem(RESTORE_NOTICE_KEY)
  if (!notice) return
  sessionStorage.removeItem(RESTORE_NOTICE_KEY)
  operationFailed.value = false
  operationMessage.value = notice
})

/* ── Cloud account ── */
async function handleSignOut() {
  if (signingOut.value) return
  signingOut.value = true
  operationMessage.value = ''
  try {
    const pushRemoval = await removePushSubscription()
    if (!pushRemoval?.ok) throw pushRemoval?.error ?? new Error('push-removal-failed')
    const { error } = await signOut()
    if (error) throw error
    await router.replace('/')
  } catch {
    operationFailed.value = true
    operationMessage.value = 'No pudimos cerrar tu sesión. Revisa tu conexión e inténtalo otra vez.'
  } finally {
    signingOut.value = false
  }
}

function openDeleteAccount() {
  deleteAccountError.value = ''
  deleteAccountOpen.value = true
}

function closeDeleteAccount() {
  if (deleteAccountBusy.value) return
  deleteAccountOpen.value = false
  deleteAccountError.value = ''
}

function accountDeletionMessage(code) {
  if (code === 'REAUTHENTICATION_REQUIRED') {
    return 'Tu inicio de sesión ya no es reciente. Escribe tu contraseña actual o vuelve a entrar con enlace mágico.'
  }
  if (code === 'ACTIVE_SESSION_REQUIRED' || code === 'AUTH_INVALID') {
    return 'La sesión dejó de ser válida. Vuelve a iniciar sesión antes de borrar la cuenta.'
  }
  if (String(code).startsWith('STORAGE_')) {
    return 'No pudimos borrar todos los archivos de la cuenta. No se eliminó Auth; inténtalo otra vez.'
  }
  if (code === 'AUTH_DELETE_FAILED') {
    return 'Supabase no pudo eliminar la cuenta. La copia local permanece intacta para que puedas reintentar.'
  }
  return 'No pudimos completar y verificar el borrado. Tu copia local permanece intacta; revisa la conexión e inténtalo otra vez.'
}

function pauseCloudForAccountDeletion() {
  return new Promise(resolve => {
    const detail = { handled: false, resolve }
    window.dispatchEvent(new CustomEvent('traker:account-deletion-pause', { detail }))
    if (!detail.handled) resolve()
  })
}

function resumeCloudAfterAccountDeletionFailure() {
  window.dispatchEvent(new CustomEvent('traker:account-deletion-resume'))
}

async function handleDeleteAccount({ confirmation, password }) {
  if (deleteAccountBusy.value) return
  deleteAccountBusy.value = true
  deleteAccountError.value = ''
  operationMessage.value = ''
  try {
    if (password) {
      const email = authStore.cloudUser?.email
      if (!email) throw Object.assign(new Error('AUTH_INVALID'), { code: 'AUTH_INVALID' })
      const { error: reauthenticationError } = await signInWithPassword(email, password)
      if (reauthenticationError) {
        deleteAccountError.value = 'La contraseña no coincide. La cuenta y tus datos siguen intactos.'
        return
      }
    }

    await pauseCloudForAccountDeletion()
    const { error } = await deleteCloudAccount(confirmation)
    if (error) {
      resumeCloudAfterAccountDeletionFailure()
      deleteAccountError.value = accountDeletionMessage(error.code)
      return
    }

    try {
      // Prevent detached Pinia/auth persistence callbacks from restoring the
      // old PIN or deleted JWT in the instant before the hard reload.
      authStore.resetPin()
      await nextTick()
      supabase?.auth.stopAutoRefresh()
      await deleteAccountDeviceData()
    } catch {
      deleteAccountError.value = 'La cuenta ya fue eliminada, pero el navegador no terminó de limpiar este dispositivo. Recarga para completar la limpieza local.'
      return
    }

    authStore.setCloudUser(null)
    sessionStorage.setItem(
      RESTORE_NOTICE_KEY,
      'La cuenta, la nube y la copia de este dispositivo quedaron eliminadas permanentemente.',
    )
    window.location.reload()
  } finally {
    deleteAccountBusy.value = false
  }
}

/* ── Notifications ── */
const notifPermission = ref(getPermission())

const notifLabel = {
  granted:     'Activadas',
  denied:      'Bloqueadas por el navegador',
  default:     'Sin activar',
  unsupported: 'No compatible con este navegador',
}

async function askNotifPermission() {
  if (permissionBusy.value) return
  permissionBusy.value = true
  operationMessage.value = ''
  try {
    const result = await requestPermission()
    notifPermission.value = result
    if (result === 'granted') {
      settingsStore.notificationsEnabled = true
      startScheduler(
        () => habitsStore.habits.filter(habit => !flexibleGroupsStore.activeMemberIds.has(habit.id)),
        () => settingsStore.$state,
        () => {
          const timezone = currentTimezone()
          return { timezone, dayClosure: dayClosuresStore.forDate(localDateKey(new Date(), timezone)) }
        },
      )
      showNotification('Traker', { body: 'Notificaciones activadas correctamente' })
      operationFailed.value = false
      operationMessage.value = 'Listo, las notificaciones quedaron activadas.'
      // Cloud reminders: register this device + sync prefs (no-op if signed out)
      Promise.allSettled([pushSettings(settingsStore.$state), ensurePushSubscription()])
    } else if (result === 'denied') {
      operationFailed.value = true
      operationMessage.value = 'El navegador bloqueó las notificaciones. Puedes activarlas desde sus ajustes.'
    }
  } catch {
    operationFailed.value = true
    operationMessage.value = 'No pudimos pedir el permiso. Inténtalo otra vez desde este botón.'
  } finally {
    permissionBusy.value = false
  }
}

function habitsWithReminder() {
  return habitsStore.habits.filter(h => h.reminder && !flexibleGroupsStore.activeMemberIds.has(h.id)).length
}

const notificationsSilenced = computed(() => {
  const until = Date.parse(settingsStore.notificationSilencedUntil)
  return Number.isFinite(until) && until > Date.now()
})

function toggleNotificationSilence() {
  if (notificationsSilenced.value) settingsStore.clearNotificationSilence()
  else settingsStore.silenceNotificationsForToday()
}

/* ── Theme ── */
const themeOptions = [
  { value: 'light',  label: 'Claro'   },
  { value: 'dark',   label: 'Oscuro'   },
  { value: 'system', label: 'Sistema'  },
]

/* ── Personality / copy tone ── */
const toneOptions = [
  { value: 'normal',     label: 'Normalito' },
  { value: 'trusted',    label: 'Con confianza' },
  { value: 'no_respect', label: 'Háblame culero' },
]

/* ── PIN ── */
const showPinForm  = ref(false)
const pinInput     = ref('')
const pinConfirm   = ref('')
const pinError     = ref('')

function savePinForm() {
  pinError.value = ''
  if (!/^\d{4,8}$/.test(pinInput.value)) {
    pinError.value = 'Usa entre 4 y 8 dígitos, sin letras ni espacios.'
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
  pendingConfirmation.value = 'remove-pin'
}

/* ── Danger ── */
const pendingConfirmation = ref(null)

function resetAllData() {
  pendingConfirmation.value = 'reset-data'
}

function cancelPendingAction() {
  if (pendingConfirmation.value === 'restore-data') {
    pendingBackup.value = null
    pendingBackupName.value = ''
  }
  pendingConfirmation.value = null
}

const confirmationDialog = computed(() => {
  if (pendingConfirmation.value === 'remove-pin') {
    return {
      title: '¿Quitar el PIN?',
      body: 'La app quedará sin protección al abrirla. Podrás configurar otro PIN cuando quieras.',
      confirmLabel: 'Quitar PIN',
    }
  }
  if (pendingConfirmation.value === 'restore-data') {
    return {
      title: '¿Restaurar respaldo local?',
      body: `Se reemplazará la copia de este dispositivo con ${pendingBackupName.value || 'el archivo elegido'}. No se borrará Supabase y tu sesión actual permanecerá abierta.`,
      confirmLabel: 'Restaurar copia',
    }
  }
  return {
    title: '¿Borrar la copia local?',
    body: 'Se eliminarán de este dispositivo metas, hábitos, registros, cierres, recompensas, colas y preferencias. La información sincronizada en Supabase permanece y puede volver a descargarse.',
    confirmLabel: 'Borrar copia local',
  }
})

async function downloadLocalBackup() {
  if (exportBusy.value) return
  exportBusy.value = true
  operationMessage.value = ''
  operationFailed.value = false
  let downloadUrl = ''
  let downloadLink = null
  try {
    const backup = await exportLocalDeviceData()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    downloadUrl = URL.createObjectURL(blob)
    downloadLink = document.createElement('a')
    const exportDay = backup._exportedAt.slice(0, 10)
    downloadLink.href = downloadUrl
    downloadLink.download = `traker-respaldo-${exportDay}.json`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    operationMessage.value = settingsStore.includeEmotionsInExport
      ? 'Respaldo descargado. Incluye tus emociones y excluye PIN, sesión y tokens.'
      : 'Respaldo descargado sin emociones. También excluye PIN, sesión y tokens.'
  } catch {
    operationFailed.value = true
    operationMessage.value = 'No pudimos preparar el respaldo. Tus datos siguen intactos; recarga e inténtalo otra vez.'
  } finally {
    downloadLink?.remove()
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    exportBusy.value = false
  }
}

function chooseLocalBackup() {
  if (!restoreBusy.value) backupInput.value?.click()
}

async function prepareLocalRestore(event) {
  const input = event.target
  const file = input.files?.[0]
  operationMessage.value = ''
  operationFailed.value = false
  try {
    if (!file) return
    if (file.size > 25 * 1024 * 1024) throw new Error('El respaldo supera el límite local de 25 MB.')
    const parsed = JSON.parse(await file.text())
    pendingBackup.value = validateLocalDeviceBackup(parsed)
    pendingBackupName.value = file.name
    pendingConfirmation.value = 'restore-data'
  } catch (error) {
    pendingBackup.value = null
    pendingBackupName.value = ''
    operationFailed.value = true
    operationMessage.value = error instanceof SyntaxError
      ? 'El archivo no contiene JSON válido. Elige un respaldo creado por Traker.'
      : (error?.message || 'No pudimos leer el respaldo. Tus datos actuales siguen intactos.')
  } finally {
    input.value = ''
  }
}

async function confirmPendingAction() {
  if (pendingConfirmation.value === 'remove-pin') {
    authStore.resetPin()
    pendingConfirmation.value = null
    return
  }
  if (pendingConfirmation.value === 'restore-data') {
    if (restoreBusy.value || !pendingBackup.value) return
    restoreBusy.value = true
    const backup = pendingBackup.value
    pendingConfirmation.value = null
    operationMessage.value = ''
    try {
      await importLocalDeviceData(backup)
      sessionStorage.setItem(
        RESTORE_NOTICE_KEY,
        'Respaldo restaurado. Metas, hábitos, registros, colas y preferencias volvieron a este dispositivo. Configura un PIN nuevo para continuar.',
      )
      window.location.reload()
    } catch {
      operationFailed.value = true
      operationMessage.value = 'No pudimos terminar la restauración. Supabase no se modificó; conserva el archivo, recarga e inténtalo otra vez.'
      restoreBusy.value = false
    } finally {
      pendingBackup.value = null
      pendingBackupName.value = ''
    }
    return
  }
  if (pendingConfirmation.value !== 'reset-data' || resetBusy.value) return

  resetBusy.value = true
  pendingConfirmation.value = null
  operationMessage.value = ''
  try {
    await deleteLocalDeviceData()
    sessionStorage.setItem(
      RESTORE_NOTICE_KEY,
      'La copia local quedó limpia. Supabase no se borró. Configura un PIN nuevo para continuar.',
    )
    window.location.reload()
  } catch {
    operationFailed.value = true
    operationMessage.value = 'No pudimos borrar toda la copia local. Tus datos no se marcaron como eliminados en Supabase; recarga e inténtalo otra vez.'
  } finally {
    resetBusy.value = false
  }
}
</script>

<template>
  <SettingsShell class="sp-shell" title="Ajustes" subtitle="Personaliza Traker sin perder de vista lo importante.">
    <div class="sp">
    <p class="sp-saved" role="status">Los cambios se guardan automáticamente en este dispositivo.</p>
    <p v-if="operationMessage" class="sp-operation-message" :class="{ 'is-error': operationFailed }" :role="operationFailed ? 'alert' : 'status'">{{ operationMessage }}</p>

    <!-- ── Profile ── -->
    <section id="experience" class="sp-section">
      <h2 class="sp-section__heading">Perfil</h2>

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
      <h2 :id="ids.theme" class="sp-section__heading">Apariencia</h2>

      <div class="sp-card">
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label">Tema</span>
            <span class="sp-row__sub">Elige entre claro, oscuro o el del sistema</span>
          </div>
        </div>
        <div class="sp-segmented" role="group" :aria-labelledby="ids.theme">
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

    <!-- ── Personality / tone ── -->
    <section class="sp-section">
      <h2 :id="ids.tone" class="sp-section__heading">Personalidad</h2>

      <div class="sp-card">
        <div class="sp-row sp-row--col">
          <span class="sp-row__label">¿Cómo quieres que te trate esta madre?</span>
          <span class="sp-row__sub">Cambia el tono de todos los mensajes, recordatorios y notificaciones de Traker.</span>
          <BaseSegmentedControl
            v-model="settingsStore.tone"
            :items="toneOptions"
            :aria-labelledby="ids.tone"
          />
          <span v-if="settingsStore.tone === 'no_respect'" class="sp-row__sub">
            Carrilla pesada, groserías y cero solemnidad. Con tantito amor, tampoco somos animales.
          </span>
        </div>
      </div>
    </section>

    <!-- ── Display ── -->
    <section class="sp-section">
      <h2 class="sp-section__heading">Visualización</h2>

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
            <span class="sp-row__label">Preguntar por el check-in diario</span>
            <span class="sp-row__sub">Si lo desactivas, el cierre del día seguirá funcionando sin pedir ánimo, carga o energía.</span>
          </div>
          <button
            class="sp-toggle"
            :class="{ 'sp-toggle--on': settingsStore.dailyCheckinPrompt !== 'never' }"
            type="button"
            role="switch"
            :aria-checked="settingsStore.dailyCheckinPrompt !== 'never'"
            aria-label="Preguntar por el check-in diario"
            @click="settingsStore.dailyCheckinPrompt = settingsStore.dailyCheckinPrompt === 'never' ? 'ask' : 'never'"
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
            :aria-checked="settingsStore.showProgress"
            aria-label="Mostrar progreso"
            @click="settingsStore.showProgress = !settingsStore.showProgress"
          >
            <span class="sp-toggle__thumb" />
          </button>
        </div>

      </div>
    </section>

    <section id="habits-goals" class="sp-section sp-section--group-start">
      <h2 class="sp-section__heading">Hábitos y metas</h2>
      <div class="sp-card">
        <RouterLink class="sp-goals-link" to="/habits">
          <ListChecks :size="20" aria-hidden="true" />
          <span><strong>Administrar hábitos</strong><small>Edita, pausa o elimina tus hábitos</small></span>
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
        <div v-if="features.goals" class="sp-divider" />
        <RouterLink v-if="features.goals" class="sp-goals-link" to="/settings/goals">
          <Target :size="20" aria-hidden="true" />
          <span><strong>Foco de Metas</strong><small>Elige cuáles aparecen primero en Hoy</small></span>
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <section v-if="features.syncV2Pilot" class="sp-section sp-section--group-start">
      <h2 class="sp-section__heading">Piloto local</h2>
      <div class="sp-card">
        <RouterLink class="sp-goals-link" to="/settings/sync-v2-pilot">
          <Database :size="20" aria-hidden="true" />
          <span><strong>Sincronización v2</strong><small>Comprueba backfill, privacidad y dos perfiles</small></span>
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <!-- ── Security ── -->
    <section id="privacy" class="sp-section sp-section--group-start">
      <h2 class="sp-section__heading">Seguridad</h2>

      <div class="sp-card">
        <!-- PIN status -->
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label">PIN de acceso</span>
            <span class="sp-row__sub">{{ authStore.hasPin ? 'PIN configurado' : 'Sin PIN' }}. Bloquea la interfaz en este dispositivo; no cifra los datos guardados.</span>
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
          <div v-if="showPinForm" class="sp-pin-reveal">
            <form class="sp-pin-form" @submit.prevent="savePinForm">
              <label class="sp-field-label" :for="ids.pin">Nuevo PIN</label>
              <input
                :id="ids.pin"
                v-model="pinInput"
                class="sp-input"
                type="password"
                inputmode="numeric"
                maxlength="8"
                pattern="[0-9]*"
                autocomplete="new-password"
                placeholder="Mínimo 4 dígitos"
                :aria-invalid="Boolean(pinError)"
                :aria-describedby="pinError ? ids.pinError : undefined"
              />
              <label class="sp-field-label" :for="ids.pinConfirm">Confirma el PIN</label>
              <input
                :id="ids.pinConfirm"
                v-model="pinConfirm"
                class="sp-input"
                type="password"
                inputmode="numeric"
                maxlength="8"
                pattern="[0-9]*"
                autocomplete="new-password"
                placeholder="Escríbelo otra vez"
                :aria-invalid="Boolean(pinError)"
                :aria-describedby="pinError ? ids.pinError : undefined"
              />
              <p v-if="pinError" :id="ids.pinError" class="sp-pin-error" role="alert">{{ pinError }}</p>
              <div class="sp-pin-actions">
                <button class="sp-action-btn" type="button" @click="showPinForm = false; pinError = ''">Cancelar</button>
                <button class="sp-action-btn sp-action-btn--primary" type="submit">Guardar PIN</button>
              </div>
            </form>
          </div>
        </Transition>
      </div>
    </section>

    <!-- ── Data ── -->
    <section class="sp-section">
      <h2 class="sp-section__heading">Datos</h2>

      <div class="sp-card">
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label">Exportar respaldo local</span>
            <span class="sp-row__sub">Guarda metas, hábitos, registros, colas y preferencias en un archivo JSON. Nunca incluye PIN, sesión ni tokens.</span>
          </div>
          <button class="sp-action-btn" type="button" :disabled="exportBusy" :aria-busy="exportBusy" @click="downloadLocalBackup">
            {{ exportBusy ? 'Preparando…' : 'Exportar' }}
          </button>
        </div>

        <div class="sp-divider" />

        <div class="sp-row sp-row--toggle">
          <div class="sp-row__text">
            <span class="sp-row__label">Incluir emociones en exportación</span>
            <span class="sp-row__sub">Desactívalo para excluir tus check-ins emocionales del archivo.</span>
          </div>
          <button
            class="sp-toggle"
            :class="{ 'sp-toggle--on': settingsStore.includeEmotionsInExport }"
            type="button"
            role="switch"
            :aria-checked="settingsStore.includeEmotionsInExport"
            aria-label="Incluir emociones en exportación"
            @click="settingsStore.includeEmotionsInExport = !settingsStore.includeEmotionsInExport"
          >
            <span class="sp-toggle__thumb" />
          </button>
        </div>

        <div class="sp-divider" />

        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label">Restaurar respaldo local</span>
            <span class="sp-row__sub">Valida el archivo antes de reemplazar esta copia. No importa PIN, sesión ni tokens.</span>
          </div>
          <input
            :id="ids.backup"
            ref="backupInput"
            class="sp-file-input"
            type="file"
            accept="application/json,.json"
            aria-label="Archivo de respaldo local"
            tabindex="-1"
            @change="prepareLocalRestore"
          />
          <button class="sp-action-btn" type="button" :aria-controls="ids.backup" :disabled="restoreBusy" :aria-busy="restoreBusy" @click="chooseLocalBackup">
            {{ restoreBusy ? 'Restaurando…' : 'Importar' }}
          </button>
        </div>
      </div>
    </section>

    <!-- ── Cloud account ── -->
    <section v-if="isSupabaseEnabled" class="sp-section">
      <h2 class="sp-section__heading">Cuenta en la nube</h2>

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
              <button class="sp-action-btn sp-action-btn--danger" type="button" :disabled="signingOut" :aria-busy="signingOut" @click="handleSignOut">
                {{ signingOut ? 'Saliendo…' : 'Salir' }}
              </button>
            </template>
          </div>
        </div>
        <template v-if="authStore.isCloudAuthenticated">
          <div class="sp-divider" />
          <div class="sp-row">
            <div class="sp-row__text">
              <span class="sp-row__label sp-row__label--danger">Borrar cuenta y nube</span>
              <span class="sp-row__sub">Elimina permanentemente Auth, datos sincronizados, notificaciones y la copia de este dispositivo.</span>
            </div>
            <button class="sp-action-btn sp-action-btn--danger" type="button" @click="openDeleteAccount">
              Borrar cuenta
            </button>
          </div>
        </template>
      </div>
    </section>

    <!-- ── Irreversible actions ── -->
    <section class="sp-section">
      <h2 class="sp-section__heading">Datos de este dispositivo</h2>
      <div class="sp-card sp-card--danger">
        <div class="sp-row">
          <div class="sp-row__text">
            <span class="sp-row__label sp-row__label--danger">Borrar copia local</span>
            <span class="sp-row__sub">Elimina metas, hábitos, registros, colas y preferencias guardadas aquí. No borra Supabase.</span>
          </div>
          <button class="sp-action-btn sp-action-btn--danger" type="button" :disabled="resetBusy" :aria-busy="resetBusy" @click="resetAllData">
            {{ resetBusy ? 'Borrando…' : 'Borrar' }}
          </button>
        </div>
      </div>
    </section>

    <!-- ── Notifications ── -->
    <section v-if="notifPermission !== 'unsupported'" id="reminders" class="sp-section sp-section--group-start">
      <h2 class="sp-section__heading">Recordatorios</h2>

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
                El sistema permite avisos; tú decides cuáles y cuándo
              </template>
              <template v-else-if="notifPermission === 'denied'">
                Actívalas en Configuración del navegador → Notificaciones
              </template>
              <template v-else>
                Activa para recibir recordatorios agrupados y sin saturación
              </template>
            </span>
          </div>

          <!-- CTA depending on state -->
          <button
            v-if="notifPermission === 'default'"
            class="sp-action-btn sp-action-btn--primary"
            type="button"
            :disabled="permissionBusy"
            :aria-busy="permissionBusy"
            @click="askNotifPermission"
          >
            {{ permissionBusy ? 'Pidiendo permiso…' : 'Activar' }}
          </button>
          <span v-else-if="notifPermission === 'denied'" class="sp-badge sp-badge--danger">
            Bloqueado
          </span>
          <span v-else class="sp-badge sp-badge--ok">
            Permitido
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
              <span class="sp-row__label">Recordatorios de Traker</span>
              <span class="sp-row__sub">Máximo {{ settingsStore.notificationDailyBudget }} al día en este dispositivo</span>
            </div>
            <button
              class="sp-toggle"
              :class="{ 'sp-toggle--on': settingsStore.notificationsEnabled }"
              type="button"
              role="switch"
              :aria-checked="settingsStore.notificationsEnabled"
              aria-label="Activar recordatorios de Traker"
              @click="settingsStore.notificationsEnabled = !settingsStore.notificationsEnabled"
            >
              <span class="sp-toggle__thumb" />
            </button>
          </div>

          <div class="sp-divider" />

          <div class="sp-row sp-row--toggle">
            <div class="sp-row__text">
              <span class="sp-row__label">Mínimos programados</span>
              <span class="sp-row__sub">Agrupa los hábitos que coincidan en un solo aviso</span>
            </div>
            <button
              class="sp-toggle"
              :class="{ 'sp-toggle--on': settingsStore.habitRemindersEnabled }"
              type="button"
              role="switch"
              :aria-checked="settingsStore.habitRemindersEnabled"
              aria-label="Activar recordatorios agrupados de mínimos"
              @click="settingsStore.habitRemindersEnabled = !settingsStore.habitRemindersEnabled"
            >
              <span class="sp-toggle__thumb" />
            </button>
          </div>

          <div class="sp-divider" />

          <div class="sp-row sp-row--toggle">
            <div class="sp-row__text">
              <span class="sp-row__label">Apertura del día</span>
              <span class="sp-row__sub">Una invitación breve para elegir tu siguiente paso</span>
            </div>
            <button
              class="sp-toggle"
              :class="{ 'sp-toggle--on': settingsStore.morningReminderEnabled }"
              type="button"
              role="switch"
              :aria-checked="settingsStore.morningReminderEnabled"
              aria-label="Activar apertura del día"
              @click="settingsStore.morningReminderEnabled = !settingsStore.morningReminderEnabled"
            >
              <span class="sp-toggle__thumb" />
            </button>
          </div>

          <div v-if="settingsStore.morningReminderEnabled" class="sp-divider" />
          <div v-if="settingsStore.morningReminderEnabled" class="sp-row">
            <div class="sp-row__text">
              <span class="sp-row__label">Hora de apertura</span>
              <span class="sp-row__sub">Si coincide con un mínimo, recibirás solo el aviso agrupado</span>
            </div>
            <input
              v-model="settingsStore.morningReminderTime"
              class="sp-input sp-input--inline sp-input--time"
              type="time"
              aria-label="Hora de apertura del día"
            />
          </div>

          <div class="sp-divider" />

          <div class="sp-row sp-row--toggle">
            <div class="sp-row__text">
              <span class="sp-row__label">Cierre del día</span>
              <span class="sp-row__sub">No aparece si ya cerraste el día desde Hoy</span>
            </div>
            <button
              class="sp-toggle"
              :class="{ 'sp-toggle--on': settingsStore.closingReminderEnabled }"
              type="button"
              role="switch"
              :aria-checked="settingsStore.closingReminderEnabled"
              aria-label="Activar cierre del día"
              @click="settingsStore.closingReminderEnabled = !settingsStore.closingReminderEnabled"
            >
              <span class="sp-toggle__thumb" />
            </button>
          </div>

          <div v-if="settingsStore.closingReminderEnabled" class="sp-divider" />
          <div v-if="settingsStore.closingReminderEnabled" class="sp-row">
            <div class="sp-row__text">
              <span class="sp-row__label">Hora de cierre</span>
              <span class="sp-row__sub">Guarda lo que sí pasó y deja mañana sin deuda</span>
            </div>
            <input
              v-model="settingsStore.closingReminderTime"
              class="sp-input sp-input--inline sp-input--time"
              type="time"
              aria-label="Hora de cierre del día"
            />
          </div>

          <div class="sp-divider" />

          <div class="sp-row sp-row--toggle">
            <div class="sp-row__text">
              <span class="sp-row__label">Volver sin ponerse al corriente</span>
              <span class="sp-row__sub">Como máximo una invitación cada siete días de ausencia</span>
            </div>
            <button
              class="sp-toggle"
              :class="{ 'sp-toggle--on': settingsStore.returnReminderEnabled }"
              type="button"
              role="switch"
              :aria-checked="settingsStore.returnReminderEnabled"
              aria-label="Activar invitaciones para volver"
              @click="settingsStore.returnReminderEnabled = !settingsStore.returnReminderEnabled"
            >
              <span class="sp-toggle__thumb" />
            </button>
          </div>

          <div class="sp-divider" />

          <div class="sp-row sp-row--col">
            <div class="sp-row__text">
              <span class="sp-row__label">Horas de silencio</span>
              <span class="sp-row__sub">No se programa ningún aviso dentro de este intervalo</span>
            </div>
            <div class="sp-time-pair">
              <label>
                <span>Desde</span>
                <input v-model="settingsStore.notificationQuietStart" class="sp-input sp-input--time" type="time" />
              </label>
              <label>
                <span>Hasta</span>
                <input v-model="settingsStore.notificationQuietEnd" class="sp-input sp-input--time" type="time" />
              </label>
            </div>
          </div>

          <div class="sp-divider" />

          <div class="sp-row">
            <div class="sp-row__text">
              <span class="sp-row__label">Presupuesto diario</span>
              <span class="sp-row__sub">Las pruebas no cuentan; solo los recordatorios realmente mostrados</span>
            </div>
            <select v-model.number="settingsStore.notificationDailyBudget" class="sp-input sp-input--inline" aria-label="Máximo de recordatorios por día">
              <option :value="1">1 aviso</option>
              <option :value="2">2 avisos</option>
              <option :value="3">3 avisos</option>
            </select>
          </div>

          <div class="sp-divider" />

          <div class="sp-row">
            <div class="sp-row__text">
              <span class="sp-row__label">Privacidad en pantalla bloqueada</span>
              <span class="sp-row__sub">Los avisos usan texto general y no muestran nombres ni notas</span>
            </div>
            <span class="sp-badge">Privado</span>
          </div>

          <div class="sp-divider" />

          <div class="sp-row">
            <div class="sp-row__text">
              <span class="sp-row__label">{{ notificationsSilenced ? 'Silenciado por hoy' : '¿Necesitas menos ruido hoy?' }}</span>
              <span class="sp-row__sub">{{ notificationsSilenced ? 'Puedes reactivar los avisos cuando quieras' : 'Pausa los recordatorios hasta terminar el día' }}</span>
            </div>
            <button class="sp-action-btn" type="button" @click="toggleNotificationSilence">
              {{ notificationsSilenced ? 'Reactivar' : 'Silenciar hoy' }}
            </button>
          </div>
        </template>
      </div>
    </section>

    <!-- Spacer -->
    <p class="sp-version">Traker · v1.0</p>

    <AuroraConfirmDialog
      v-if="pendingConfirmation"
      :open="Boolean(pendingConfirmation)"
      :title="confirmationDialog.title"
      :body="confirmationDialog.body"
      cancel-label="Mejor no"
      :confirm-label="confirmationDialog.confirmLabel"
      destructive
      @cancel="cancelPendingAction"
      @confirm="confirmPendingAction"
    />

    <DeleteCloudAccountDialog
      :open="deleteAccountOpen"
      :busy="deleteAccountBusy"
      :email="authStore.cloudUser?.email"
      :error="deleteAccountError"
      @cancel="closeDeleteAccount"
      @confirm="handleDeleteAccount"
      @export="downloadLocalBackup"
    />

    </div>
  </SettingsShell>
</template>

<style scoped>
.sp {
  width: 100%;
}
.sp-saved { margin:0 0 var(--space-8); color:var(--text-muted); font:500 var(--label-size)/1.4 var(--font-core); }
.sp-operation-message { margin:calc(-1 * var(--space-5)) 0 var(--space-8); overflow-wrap:anywhere; color:var(--action-primary); font:600 var(--body-small-size)/var(--body-small-line) var(--font-core); }
.sp-operation-message.is-error { color:var(--status-destructive); }
.sp-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Section ── */
.sp-section {
  padding-bottom:var(--space-5);
  scroll-margin-top:var(--space-4);
}
.sp-section--group-start { padding-top:var(--space-5); }

.sp-section__heading {
  margin-top: 0;
  color: var(--color-text-faint);
  font-size: var(--label-size);
  line-height: var(--label-line);
  font-weight: var(--label-weight);
  letter-spacing: 0.045em;
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
  font-size: var(--body-size);
  font-weight: 600;
  line-height: 1.3;
}

.sp-row__label--danger {
  color: var(--color-danger);
}

.sp-row__label--brand {
  color: var(--color-brand);
}

.sp-row__sub {
  color: var(--color-text-faint);
  font-size: var(--body-small-size);
  font-weight: 400;
  line-height: var(--body-small-line);
  overflow-wrap: anywhere;
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
  min-height: var(--touch-min);
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
  animation:sp-choice-confirm var(--dur-celebrate) var(--ease-enter);
}

/* ── Toggle ── */
.sp-toggle {
  flex-shrink: 0;
  position: relative;
  width: 3.25rem;
  height: var(--touch-min);
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--duration-base) var(--ease-standard);
}

.sp-toggle::before {
  position: absolute;
  inset-inline: 3px;
  top: 9px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--color-surface-raised);
  content: '';
  transition: background var(--duration-base) var(--ease-standard);
}

.sp-toggle--on::before { background: var(--color-brand); }
.sp-toggle--on::after { position:absolute; inset:8px 2px; border-radius:var(--radius-full); background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--text-on-accent) 28%,transparent),transparent); content:''; pointer-events:none; animation:sp-toggle-light var(--dur-celebrate) var(--ease-enter) both; }

.sp-toggle__thumb {
  position: absolute;
  top: 13px;
  inset-inline-start: 7px;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  background: var(--text-on-accent);
  box-shadow: var(--elev-2);
  transition: transform var(--duration-base) var(--ease-emphasis);
}

.sp-toggle--on .sp-toggle__thumb {
  transform: translateX(20px);
}

:global([dir='rtl']) .sp-toggle--on .sp-toggle__thumb { transform: translateX(-20px); }

/* ── Action buttons ── */
.sp-action-btn {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-min);
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
  min-height: 0;
  padding: var(--space-4);
}

.sp-field-label { color: var(--color-text-muted); font: var(--label-weight) var(--label-size)/var(--label-line) var(--font-core); }

.sp-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.75rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-text);
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
  font-family: inherit;
  transition: border-color var(--duration-base) var(--ease-standard);
}

.sp-input--time { width: min(11rem, 100%); flex: none; }
.sp-input--inline { width: min(11rem, 100%); flex: none; }

.sp-time-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  width: 100%;
}

.sp-time-pair label { display: grid; gap: var(--space-2); color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 600; }
.sp-time-pair .sp-input--time { width: 100%; }

.sp-input:focus-visible {
  border-color: var(--color-brand);
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  box-shadow: none;
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
.sp-pin-reveal { display: grid; grid-template-rows: 1fr; border-top: 1px solid var(--color-border); }
.sp-pin-reveal > .sp-pin-form { overflow: hidden; }
.sp-slide-enter-active,
.sp-slide-leave-active { transition: opacity var(--duration-base) var(--ease-standard), grid-template-rows var(--duration-slow) var(--ease-standard); }

.sp-slide-enter-from,
.sp-slide-leave-to {
  opacity: 0;
  grid-template-rows: 0fr;
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
  font-size: var(--caption-size);
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: var(--space-5) 0;
}

.sp-goals-link {
  display: grid;
  min-height: 72px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--color-text);
  text-decoration: none;
}

.sp-goals-link > svg:first-child { color: var(--color-brand); }
.sp-goals-link > span { display: grid; gap: 4px; }
.sp-goals-link strong { font-size: var(--body-size); font-weight:600; line-height:1.3; }
.sp-goals-link small { color: var(--color-text-muted); font-size: var(--body-small-size); line-height:var(--body-small-line); }
.sp-goals-link > svg:last-child { color: var(--color-text-faint); }
.sp-goals-link > svg:last-child { transition:transform var(--dur-fast) var(--ease-calm),color var(--dur-fast) var(--ease-calm); }

@media (max-width: 520px) {
  .sp-index { grid-template-columns:1fr; }
  .sp-row:not(.sp-row--toggle) { align-items: stretch; flex-direction: column; }
  .sp-row__actions { width: 100%; flex-wrap: wrap; }
  .sp-row__actions .sp-action-btn { flex: 1 1 auto; justify-content: center; }
  .sp-row:not(.sp-row--toggle) > .sp-action-btn { width: 100%; justify-content: center; }
  .sp-row:not(.sp-row--toggle) > .sp-badge { align-self: flex-start; }
  .sp-input--time { width: 100%; }
  .sp-input--inline { width: 100%; }
  .sp-time-pair { grid-template-columns: 1fr; }
  .sp-pin-actions { flex-direction: column-reverse; }
  .sp-pin-actions .sp-action-btn { width: 100%; justify-content: center; }
}

@media (max-width: 380px) {
  .sp-segmented { grid-template-columns: 1fr; display: grid; }
  .sp-row { padding: var(--space-3); }
  .sp-goals-link { grid-template-columns: auto minmax(0, 1fr); }
  .sp-goals-link > svg:last-child { display: none; }
}

@media (min-width: 640px) {
  .sp-row { padding: var(--space-4); }
}

@media (hover: hover) and (pointer: fine) {
  .sp-seg-btn:not(.sp-seg-btn--active):hover { border-color: var(--color-border-strong); background: var(--action-secondary-bg); color: var(--color-text); }
  .sp-action-btn:hover { border-color: var(--primary-border); box-shadow: var(--shadow-hover-glow); }
  .sp-goals-link:hover { background: var(--action-secondary-bg); }
  .sp-goals-link:hover > svg:last-child { color:var(--action-primary); transform:translateX(3px); }
}

@media (hover: none), (pointer: coarse) {
  .sp-seg-btn:not(.sp-seg-btn--active):active,
  .sp-action-btn:not(.sp-action-btn--primary):not(.sp-action-btn--danger):active,
  .sp-goals-link:active { background: var(--action-secondary-bg); }
}
@keyframes sp-choice-confirm { 45% { box-shadow:0 3px 14px color-mix(in srgb,var(--color-brand) 18%,transparent); } }
@keyframes sp-toggle-light { from { opacity:0; transform:translateX(-30%); } 45% { opacity:1; } to { opacity:0; transform:translateX(30%); } }
@media (prefers-reduced-motion:reduce) {
  .sp-seg-btn--active,.sp-toggle--on::after { animation:none; }
  .sp-goals-link:hover > svg:last-child { transform:none; }
  .sp-slide-enter-from,.sp-slide-leave-to { transform:none; }
}

/* Settings.html — composición Aurora exacta */
:global(.sp-shell) {
  width: min(100%, 390px);
  padding: 52px 20px 40px;
}
:global(.sp-shell .settings-shell__header) { margin-bottom: 26px; }
:global(.sp-shell .settings-shell__header h1) { font: 600 28px/1.2 var(--font-core); letter-spacing: -.02em; }
:global(.sp-shell .settings-shell__header p) { margin-top: 6px; font: 400 14px/1.5 var(--font-core); }
.sp { display: flex; flex-direction: column; gap: 26px; }
.sp-saved { margin: 0; color: var(--text-muted); font: 500 12px/1.4 var(--font-core); }
.sp-operation-message { margin: -14px 0 0; }
.sp-section,.sp-section--group-start { padding: 0; }
.sp-section__heading { margin: 0 0 10px; color: var(--text-muted); font: 600 11px/1 var(--font-core); letter-spacing: .06em; }
.sp-card { border-color: var(--border-subtle); border-radius: var(--radius-xl); background: var(--surface-primary); }
.sp-row { gap: 12px; padding: 14px; }
.sp-row__text { gap: 2px; }
.sp-row__label { color: var(--text-primary); font: 600 15px/1.3 var(--font-core); }
.sp-row__sub { color: var(--text-muted); font: 400 13px/1.4 var(--font-core); }
.sp-divider { margin: 0; background: var(--border-subtle); }
.sp-goals-link { min-height: 0; gap: 12px; padding: 14px; }
.sp-goals-link strong { font: 600 15px/1.3 var(--font-core); }
.sp-goals-link small { color: var(--text-muted); font: 400 13px/1.4 var(--font-core); }
.sp-segmented { gap: 8px; padding: 14px; border-color: var(--border-subtle); }
.sp-seg-btn { min-height: 44px; border-color: var(--border-strong); border-radius: var(--radius-md); color: var(--text-secondary); font: 600 13px/1 var(--font-core); }
.sp-seg-btn--active { border-color: var(--action-primary); color: var(--action-primary); background: color-mix(in srgb,var(--action-primary) 12%,var(--surface-secondary)); }
.sp-action-btn { min-height: 40px; padding: 0 14px; border-color: var(--border-subtle); color: var(--text-primary); background: var(--action-secondary-bg); font: 600 13px/1 var(--font-core); }
.sp-action-btn--primary { color: var(--action-primary-fg); background: var(--action-primary); }
.sp-badge { font: 600 12px/1 var(--font-core); }
.sp-version { margin: 4px 0 0; padding: 0; color: var(--text-muted); font: 600 11px/1 var(--font-core); }
@media (min-width: 640px) {
  :global(.sp-shell) { width: min(100%, 640px); padding: 48px; }
}
</style>
