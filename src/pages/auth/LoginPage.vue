<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@stores/auth'
import {
  signInWithPassword,
  signUp,
  signInWithMagicLink,
  signOut,
} from '@services/supabase/auth.service'
import { isSupabaseEnabled } from '@services/supabase/client'

const router    = useRouter()
const authStore = useAuthStore()

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

const btnLabel = computed(() => {
  if (isLoading.value) return 'Procesando…'
  if (mode.value === 'magic') return 'Enviar link'
  return tab.value === 'signup' ? 'Crear cuenta' : 'Entrar'
})

const successMsg = computed(() => {
  if (mode.value === 'magic') return 'Link enviado — revisa tu correo.'
  if (tab.value === 'signup') return 'Cuenta creada — revisa tu correo para confirmar.'
  return '¡Bienvenido de vuelta!'
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
    setTimeout(() => router.replace({ name: 'dashboard' }), 800)
  }
}

// ── Sign out ──────────────────────────────────────────────────────
async function handleSignOut() {
  await signOut()
  authStore.setCloudUser(null)
}

// ── Helpers ───────────────────────────────────────────────────────
function reset() {
  status.value = 'idle'
  errMsg.value = ''
}

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
    <button class="lp__back" @click="router.push({ name: 'dashboard' })">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
      </svg>
      Volver
    </button>

    <div class="lp__card">

      <!-- Brand -->
      <div class="lp__brand">
        <div class="lp__brand-icon">T</div>
        <h1 class="lp__brand-name">Traker</h1>
        <p class="lp__brand-sub">Sincroniza tus hábitos en todos tus dispositivos</p>
      </div>

      <!-- Already signed in -->
      <template v-if="authStore.isCloudAuthenticated">
        <div class="lp__signed-in">
          <div class="lp__signed-in-badge">✓ Conectado</div>
          <p class="lp__signed-in-email">{{ authStore.cloudUser?.email }}</p>
          <p class="lp__signed-in-sub">Tu progreso se sincroniza automáticamente.</p>
          <button class="lp__signout-btn" @click="handleSignOut">
            Cerrar sesión
          </button>
        </div>
      </template>

      <!-- Supabase not configured -->
      <template v-else-if="!isSupabaseEnabled">
        <div class="lp__offline-notice">
          <p class="lp__offline-icon">🔌</p>
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
        <div class="lp__mode-toggle" role="tablist">
          <button
            class="lp__mode-btn"
            :class="{ 'lp__mode-btn--active': mode === 'password' }"
            role="tab"
            :aria-selected="mode === 'password'"
            @click="mode = 'password'; reset()"
          >
            Contraseña
          </button>
          <button
            class="lp__mode-btn"
            :class="{ 'lp__mode-btn--active': mode === 'magic' }"
            role="tab"
            :aria-selected="mode === 'magic'"
            @click="mode = 'magic'; reset()"
          >
            Magic link
          </button>
        </div>

        <!-- Sign in / Sign up tabs (password mode only) -->
        <div v-if="mode === 'password'" class="lp__tabs">
          <button
            class="lp__tab"
            :class="{ 'lp__tab--active': tab === 'signin' }"
            @click="tab = 'signin'; reset()"
          >Entrar</button>
          <button
            class="lp__tab"
            :class="{ 'lp__tab--active': tab === 'signup' }"
            @click="tab = 'signup'; reset()"
          >Crear cuenta</button>
        </div>

        <!-- Success state -->
        <Transition name="lp-fade">
          <div v-if="isSuccess" class="lp__success">
            <span class="lp__success-icon">✓</span>
            <p class="lp__success-msg">{{ successMsg }}</p>
          </div>
        </Transition>

        <!-- Form -->
        <form v-if="!isSuccess" class="lp__form" @submit.prevent="submit">

          <div class="lp__field">
            <label class="lp__label" for="lp-email">Correo electrónico</label>
            <input
              id="lp-email"
              v-model="email"
              class="lp__input"
              :class="{ 'lp__input--error': isError }"
              type="email"
              autocomplete="email"
              placeholder="tu@email.com"
              :disabled="isLoading"
              @input="reset"
            />
          </div>

          <div v-if="mode === 'password'" class="lp__field">
            <label class="lp__label" for="lp-pass">Contraseña</label>
            <input
              id="lp-pass"
              v-model="pass"
              class="lp__input"
              :class="{ 'lp__input--error': isError }"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              :disabled="isLoading"
              @input="reset"
            />
          </div>

          <p v-if="isError" class="lp__error" role="alert">
            {{ errMsg }}
          </p>

          <p v-if="mode === 'magic'" class="lp__hint">
            Te enviaremos un link — haz clic y entrarás automáticamente.
          </p>

          <button
            class="lp__submit"
            type="submit"
            :disabled="!canSubmit"
          >
            <span v-if="isLoading" class="lp__spinner" aria-hidden="true" />
            {{ btnLabel }}
          </button>

        </form>

      </template>

    </div>

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
  padding: var(--space-6) var(--space-4);
  gap: var(--space-5);
}

/* ── Back button ──────────────────────────────────────────────────── */
.lp__back {
  position: fixed;
  top: max(var(--space-5), env(safe-area-inset-top));
  left: var(--space-5);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-faint);
  font-size: var(--text-sm);
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  transition: color var(--duration-base) var(--ease-standard), background var(--duration-base) var(--ease-standard);
}

.lp__back:hover {
  color: var(--color-text);
  background: var(--color-surface-raised);
}

/* ── Card ─────────────────────────────────────────────────────────── */
.lp__card {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-3xl);
  padding: var(--space-8) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Brand ────────────────────────────────────────────────────────── */
.lp__brand {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.lp__brand-icon {
  width: 3.5rem;
  height: 3.5rem;
  display: grid;
  place-items: center;
  background: var(--color-brand);
  color: var(--color-brand-contrast);
  font-size: 1.75rem;
  font-weight: 900;
  border-radius: var(--radius-2xl);
  margin-bottom: var(--space-1);
  box-shadow: 0 0 24px color-mix(in srgb, var(--color-brand) 30%, transparent);
}

.lp__brand-name {
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.lp__brand-sub {
  font-size: var(--text-xs);
  color: var(--color-text-faint);
  font-weight: 500;
  max-width: 24ch;
  text-align: center;
  line-height: 1.5;
}

/* ── Mode toggle ──────────────────────────────────────────────────── */
.lp__mode-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--color-surface-raised);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.lp__mode-btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-base) var(--ease-standard);
  touch-action: manipulation;
}

.lp__mode-btn--active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-hairline);
}

/* ── Sign in / up tabs ────────────────────────────────────────────── */
.lp__tabs {
  display: flex;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
}

.lp__tab {
  background: none;
  border: none;
  padding: 0 0 var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-faint);
  cursor: pointer;
  position: relative;
  transition: color var(--duration-base) var(--ease-standard);
}

.lp__tab--active {
  color: var(--color-text);
}

.lp__tab--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 1px;
  background: var(--color-brand);
}

/* ── Form ─────────────────────────────────────────────────────────── */
.lp__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.lp__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.lp__label {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text-faint);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lp__input {
  width: 100%;
  min-height: 2.875rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-raised);
  color: var(--color-text);
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
  font-family: inherit;
  outline: none;
  transition: border-color var(--duration-base) var(--ease-standard),
              box-shadow var(--duration-base) var(--ease-standard);
}

.lp__input::placeholder { color: var(--color-text-faint); }

.lp__input:focus {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand) 14%, transparent);
}

.lp__input--error {
  border-color: color-mix(in srgb, var(--color-danger) 60%, var(--color-border));
}

.lp__error {
  color: var(--color-danger);
  font-size: var(--text-xs);
  font-weight: 600;
  padding: var(--space-2) var(--space-3);
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface));
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-danger) 18%, transparent);
}

.lp__hint {
  font-size: var(--text-xs);
  color: var(--color-text-faint);
  font-weight: 500;
  line-height: 1.5;
}

.lp__submit {
  width: 100%;
  min-height: 2.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: none;
  border-radius: var(--radius-xl);
  background: var(--color-brand);
  color: var(--color-brand-contrast);
  font-size: var(--text-sm);
  font-weight: 800;
  cursor: pointer;
  transition: opacity var(--duration-base) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-base) var(--ease-standard);
  touch-action: manipulation;
}

.lp__submit:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 0 20px color-mix(in srgb, var(--color-brand) 25%, transparent);
}

.lp__submit:active:not(:disabled) {
  transform: scale(0.98);
}

.lp__submit:disabled {
  opacity: 0.35;
  pointer-events: none;
}

/* ── Spinner ──────────────────────────────────────────────────────── */
.lp__spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: #000;
  border-radius: 50%;
  animation: lp-spin 0.7s linear infinite;
}

@keyframes lp-spin {
  to { transform: rotate(360deg); }
}

/* ── Success ──────────────────────────────────────────────────────── */
.lp__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  background: color-mix(in srgb, var(--color-brand) 8%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-brand) 20%, transparent);
  border-radius: var(--radius-2xl);
  text-align: center;
}

.lp__success-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  background: var(--color-brand);
  color: var(--color-brand-contrast);
  border-radius: var(--radius-full);
  font-weight: 800;
  font-size: 1rem;
}

.lp__success-msg {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1.5;
}

/* ── Already signed in ────────────────────────────────────────────── */
.lp__signed-in {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
}

.lp__signed-in-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: color-mix(in srgb, var(--color-brand) 12%, var(--color-surface));
  color: var(--color-brand);
  border: 1px solid color-mix(in srgb, var(--color-brand) 25%, transparent);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: 0.04em;
}

.lp__signed-in-email {
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 600;
}

.lp__signed-in-sub {
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: 500;
}

.lp__signout-btn {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--duration-base) var(--ease-standard);
}

.lp__signout-btn:hover {
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 6%, var(--color-surface-raised));
}

/* ── Offline notice ───────────────────────────────────────────────── */
.lp__offline-notice {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) 0;
}

.lp__offline-icon { font-size: 2.5rem; }

.lp__offline-title {
  color: var(--color-text);
  font-size: var(--text-md);
  font-weight: 700;
}

.lp__offline-desc {
  color: var(--color-text-faint);
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1.6;
  max-width: 26ch;
}

/* ── Footer ───────────────────────────────────────────────────────── */
.lp__footer {
  color: var(--color-text-faint);
  font-size: 0.6875rem;
  font-weight: 500;
  text-align: center;
  max-width: 30ch;
  line-height: 1.5;
}

/* ── Transition ───────────────────────────────────────────────────── */
.lp-fade-enter-active, .lp-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}
.lp-fade-enter-from, .lp-fade-leave-to { opacity: 0; }
</style>
