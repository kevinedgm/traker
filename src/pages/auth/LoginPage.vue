<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@stores/auth'
import {
  signInWithPassword,
  signUp,
  signInWithMagicLink,
  signOut,
} from '@services/supabase/auth.service'
import { isSupabaseEnabled } from '@services/supabase/client'
import { removePushSubscription } from '@services/push.service'
import { ArrowLeft, CircleCheck, Unplug } from 'lucide-vue-next'
import {
  AuroraButton,
  AuroraSurface,
  AuroraSegmentedControl,
  AuroraTabs,
  AuroraInput,
  AuroraBadge,
} from '@/components/aurora'
import { authReturnRouteName } from '@/router/authReturn.js'

const router    = useRouter()
const route     = useRoute()
const authStore = useAuthStore()
const logoUrl = `${import.meta.env.BASE_URL}brand/koto-logo.svg`

// ── Mode ──────────────────────────────────────────────────────────
// 'password' → email + password form
// 'magic'    → email only, sends a magic link
const mode = ref('password')

// ── Tab (only in password mode) ───────────────────────────────────
// 'signin' | 'signup'
const tab = ref('signin')

// ── Form ──────────────────────────────────────────────────────────
const email  = ref('')
const pass   = ref('')
const status = ref('idle')   // 'idle' | 'loading' | 'success' | 'error'
const errMsg = ref('')

// ── Computed ──────────────────────────────────────────────────────
const isLoading     = computed(() => status.value === 'loading')
const isSuccess     = computed(() => status.value === 'success')
const isError       = computed(() => status.value === 'error')
const canSubmit     = computed(() =>
  !isLoading.value &&
  email.value.trim().length > 0 &&
  (mode.value === 'magic' || pass.value.length >= 6)
)
const returnRouteName = computed(() => authReturnRouteName(route.query.returnTo))

const btnLabel = computed(() => {
  if (isLoading.value) return 'Procesando…'
  if (mode.value === 'magic') return 'Enviar link'
  return tab.value === 'signup' ? 'Crear cuenta' : 'Entrar'
})

const successMsg = computed(() => {
  if (mode.value === 'magic') return 'Link enviado. Revisa tu correo.'
  if (tab.value === 'signup') return 'Cuenta creada. Revisa tu correo para confirmar.'
  return 'Sesión iniciada.'
})

// ── Submit ─────────────────────────────────────────────────────────
async function submit() {
  if (!canSubmit.value || !isSupabaseEnabled) return

  status.value = 'loading'
  errMsg.value = ''

  let result

  if (mode.value === 'magic') {
    result = await signInWithMagicLink(email.value)
  } else if (tab.value === 'signup') {
    result = await signUp(email.value, pass.value)
  } else {
    result = await signInWithPassword(email.value, pass.value)
  }

  if (result?.error) {
    status.value = 'error'
    errMsg.value = translateError(result.error.message)
    return
  }

  status.value = 'success'

  // For sign-in (password), onAuthChange in App.vue fires automatically
  // and redirects once the session is established.
  // For magic link / signup: user stays on this page with the success message.
  if (mode.value === 'password' && tab.value === 'signin') {
    setTimeout(() => router.replace({ name: returnRouteName.value }), 800)
  }
}

// ── Sign out ──────────────────────────────────────────────────────
async function handleSignOut() {
  status.value = 'loading'
  errMsg.value = ''
  const pushRemoval = await removePushSubscription()
  if (!pushRemoval?.ok) {
    status.value = 'error'
    errMsg.value = 'No pudimos desconectar los avisos de este dispositivo. Revisa tu conexión e inténtalo otra vez.'
    return
  }
  const { error } = await signOut()
  if (error) {
    status.value = 'error'
    errMsg.value = translateError(error.message)
    return
  }
  authStore.setCloudUser(null)
  status.value = 'idle'
}

// ── Helpers ───────────────────────────────────────────────────────
function reset() {
  status.value = 'idle'
  errMsg.value = ''
}

function setMode(v) { mode.value = v; reset() }
function setTab(v) { tab.value = v; reset() }
function goBack() { router.push({ name: returnRouteName.value }) }

function translateError(msg) {
  if (!msg) return 'Error desconocido'
  if (msg.includes('Invalid login')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de entrar.'
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese correo.'
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('rate limit')) return 'Demasiados intentos. Espera un momento.'
  return msg
}
</script>

<template>
  <div class="lp">

    <!-- Back to dashboard -->
    <button class="lp__back" type="button" @click="goBack">
      <ArrowLeft :size="16" :stroke-width="1.75" />
      Volver
    </button>

    <AuroraSurface level="2" radius="var(--radius-2xl)" padding="32px 24px" class="lp__card">

      <!-- Brand -->
      <div class="lp__brand">
        <div class="lp__brand-icon"><img :src="logoUrl" alt="" /></div>
        <h1 class="lp__brand-name">Traker</h1>
        <p class="lp__brand-editorial">Regresar también es avanzar.</p>
        <p class="lp__brand-sub">Sincroniza tus hábitos en todos tus dispositivos.</p>
      </div>

      <!-- Already signed in -->
      <template v-if="authStore.isCloudAuthenticated">
        <div class="lp__signed-in">
          <AuroraBadge tone="action" dot>Conectado</AuroraBadge>
          <p class="lp__signed-in-email">{{ authStore.cloudUser?.email }}</p>
          <p class="lp__signed-in-sub">Tu progreso se sincroniza automáticamente.</p>
          <AuroraButton variant="secondary" size="sm" @click="handleSignOut">Cerrar sesión</AuroraButton>
        </div>
      </template>

      <!-- Supabase not configured -->
      <template v-else-if="!isSupabaseEnabled">
        <div class="lp__offline-notice">
          <Unplug :size="28" :stroke-width="1.5" style="color:var(--text-muted)" />
          <p class="lp__offline-title">Modo sin conexión</p>
          <p class="lp__offline-desc">
            La sincronización en la nube no está configurada.
            La app funciona completamente en tu dispositivo.
          </p>
        </div>
      </template>

      <!-- Auth form -->
      <template v-else>

        <!-- Mode selector -->
        <AuroraSegmentedControl
          full-width
          :model-value="mode"
          :items="[{ value: 'password', label: 'Contraseña' }, { value: 'magic', label: 'Magic link' }]"
          @update:model-value="setMode"
        />

        <!-- Sign in / Sign up tabs (password mode only) -->
        <AuroraTabs
          v-if="mode === 'password'"
          :model-value="tab"
          :items="[{ value: 'signin', label: 'Entrar' }, { value: 'signup', label: 'Crear cuenta' }]"
          @update:model-value="setTab"
        />

        <!-- Success state -->
        <Transition name="lp-fade">
          <AuroraSurface v-if="isSuccess" accent padding="24px 16px" class="lp__success">
            <CircleCheck :size="28" :stroke-width="1.75" style="color:var(--action-primary)" />
            <p class="lp__success-msg">{{ successMsg }}</p>
          </AuroraSurface>
        </Transition>

        <!-- Form -->
        <form v-if="!isSuccess" class="lp__form" @submit.prevent="submit">

          <AuroraInput
            id="lp-email"
            v-model="email"
            label="Correo electrónico"
            type="email"
            autocomplete="email"
            placeholder="tu@email.com"
            :disabled="isLoading"
            @update:model-value="reset"
          />

          <AuroraInput
            v-if="mode === 'password'"
            id="lp-pass"
            v-model="pass"
            label="Contraseña"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :disabled="isLoading"
            @update:model-value="reset"
          />

          <p v-if="isError" class="lp__error" role="alert">
            {{ errMsg }}
          </p>

          <p v-if="mode === 'magic'" class="lp__hint">
            Te enviaremos un link. Haz clic y entrarás automáticamente.
          </p>

          <AuroraButton type="submit" variant="primary" size="lg" full-width :loading="isLoading" :disabled="!canSubmit">
            {{ btnLabel }}
          </AuroraButton>

        </form>

      </template>

    </AuroraSurface>

    <!-- Footer -->
    <p class="lp__footer">
      Los datos siempre se guardan en tu dispositivo. La cuenta es opcional.
    </p>

  </div>
</template>

<style scoped>
/* ── Page shell ───────────────────────────────────────────────────── */
.lp {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6, 24px) var(--space-4, 16px);
  gap: var(--space-5, 20px);
}

/* ── Back button ──────────────────────────────────────────────────── */
.lp__back {
  position: fixed;
  top: max(20px, env(safe-area-inset-top));
  left: 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font: 600 14px/1 var(--font-core);
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: var(--radius-pill);
  transition: color var(--dur-fast) var(--ease-calm), background var(--dur-fast) var(--ease-calm);
}

.lp__back:hover {
  color: var(--text-primary);
  background: var(--surface-secondary);
}

/* ── Card ─────────────────────────────────────────────────────────── */
.lp__card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Brand ────────────────────────────────────────────────────────── */
.lp__brand {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.lp__brand-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  background: var(--action-primary);
  border-radius: var(--radius-lg);
  margin-bottom: 6px;
}
.lp__brand-icon img { display:block; width:39px; height:auto; }

.lp__brand-name {
  font: 600 20px/1.2 var(--font-core);
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.lp__brand-editorial {
  font: 400 19px/1.3 var(--font-editorial);
  color: var(--text-primary);
  margin-top: 2px;
}

.lp__brand-sub {
  font: 400 13px/1.5 var(--font-core);
  color: var(--text-muted);
  max-width: 26ch;
  text-align: center;
}

/* ── Form ─────────────────────────────────────────────────────────── */
.lp__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lp__error {
  color: var(--status-destructive);
  font: 600 13px/1.4 var(--font-core);
  padding: 10px 12px;
  background: color-mix(in srgb, var(--status-destructive) 8%, var(--surface-primary));
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--status-destructive) 20%, transparent);
}

.lp__hint {
  font: 400 13px/1.5 var(--font-core);
  color: var(--text-muted);
}

/* ── Success ──────────────────────────────────────────────────────── */
.lp__success {
  display: flex !important;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.lp__success-msg {
  color: var(--text-primary);
  font: 600 14px/1.5 var(--font-core);
}

/* ── Already signed in ────────────────────────────────────────────── */
.lp__signed-in {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.lp__signed-in-email {
  color: var(--text-primary);
  font: 600 14px/1.4 var(--font-core);
}

.lp__signed-in-sub {
  color: var(--text-muted);
  font: 400 13px/1.5 var(--font-core);
}

/* ── Offline notice ───────────────────────────────────────────────── */
.lp__offline-notice {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 0;
}

.lp__offline-title {
  color: var(--text-primary);
  font: 600 16px/1.3 var(--font-core);
}

.lp__offline-desc {
  color: var(--text-muted);
  font: 400 14px/1.6 var(--font-core);
  max-width: 26ch;
}

/* ── Footer ───────────────────────────────────────────────────────── */
.lp__footer {
  color: var(--text-muted);
  font: 400 12px/1.5 var(--font-core);
  text-align: center;
  max-width: 30ch;
}

/* ── Transition ───────────────────────────────────────────────────── */
.lp-fade-enter-active, .lp-fade-leave-active {
  transition: opacity var(--dur-base) var(--ease-calm);
}
.lp-fade-enter-from, .lp-fade-leave-to { opacity: 0; }
</style>
