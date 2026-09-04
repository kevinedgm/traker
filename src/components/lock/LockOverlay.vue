<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@stores/auth'
import { useModalFocus } from '@/composables/useModalFocus'
import { Delete } from 'lucide-vue-next'

const auth = useAuthStore()
const overlay = ref(null)
useModalFocus(overlay, { initialFocus: '[data-pin-key]' })

// ── Clock ────────────────────────────────────────────────────────────────
const hh      = ref('00')
const mm      = ref('00')
const dateStr = ref('')

function tick() {
  const now = new Date()
  hh.value = String(now.getHours()).padStart(2, '0')
  mm.value = String(now.getMinutes()).padStart(2, '0')
  dateStr.value = now.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

let timer
let previousHtmlOverflow = ''

onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)

  // The lock screen is modal. Keep the app underneath from scrolling while
  // the fixed overlay is present, then restore the caller's original styles.
  previousHtmlOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
})

onUnmounted(() => {
  clearInterval(timer)
  document.documentElement.style.overflow = previousHtmlOverflow
})

// ── PIN state ────────────────────────────────────────────────────────────
const entered      = ref('')
const confirming   = ref(false)
const firstPin     = ref('')
const shaking      = ref(false)
const errorState   = ref(false)
const successState = ref(false)
const hint         = ref('')
const blocked      = ref(false)   // ignore taps during animation

const subtitle = computed(() => {
  if (hint.value) return hint.value
  if (!auth.hasPin) return confirming.value ? 'Confirma tu PIN' : 'Crea un PIN seguro'
  return 'Ingresa tu PIN'
})

// Dot visual state: -1=hidden, 0=empty, 1=filled, 2=error, 3=success
const dots = computed(() =>
  Array.from({ length: 4 }, (_, i) => {
    if (errorState.value)   return 2
    if (successState.value) return 3
    return i < entered.value.length ? 1 : 0
  })
)

// ── Keypad ───────────────────────────────────────────────────────────────
function pressKey(k) {
  if (blocked.value || entered.value.length >= 4) return
  entered.value += k
}

function erase() {
  if (blocked.value) return
  entered.value = entered.value.slice(0, -1)
  if (errorState.value) {
    errorState.value = false
    hint.value = ''
  }
}

watch(entered, (val) => {
  if (val.length === 4) handleComplete(val)
})

async function handleComplete(val) {
  blocked.value = true

  if (!auth.hasPin) {
    if (!confirming.value) {
      firstPin.value = val
      confirming.value = true
      await sleep(120)
      entered.value = ''
      blocked.value = false
    } else {
      if (val === firstPin.value) {
        auth.setPin(val)
        await onSuccess()
      } else {
        confirming.value = false
        firstPin.value = ''
        await onError('Los PINs no coinciden')
      }
    }
  } else {
    if (auth.checkPin(val)) {
      await onSuccess()
    } else {
      await onError('PIN incorrecto')
    }
  }
}

async function onSuccess() {
  successState.value = true
  // Dots pulse in accent color — brief pause before overlay slides away
  await sleep(400)
  auth.open() // isLocked = false → Transition leave → slide up
}

async function onError(msg) {
  errorState.value = true
  shaking.value = true
  hint.value = msg
  await sleep(90)
  entered.value = ''
  await sleep(360)
  shaking.value = false
  // Keep error color + message briefly, then fade out
  await sleep(1400)
  errorState.value = false
  hint.value = ''
  blocked.value = false
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const KEYS = ['1','2','3','4','5','6','7','8','9']
</script>

<template>
  <!--
    Root: position:fixed z-[999] — always on top.
    This element is the one <Transition name="lock"> animates on removal.
  -->
  <div
    ref="overlay"
    class="lock-overlay overflow-hidden select-none"
    role="dialog"
    aria-modal="true"
    aria-label="Pantalla de bloqueo de Traker"
    aria-describedby="lock-subtitle"
    tabindex="-1"
  >
    <div class="lock-aurora aurora-ambient flex h-full w-full flex-col items-center overflow-hidden">

    <!-- ── Grain, consistent with the rest of Aurora ─────────────────── -->
    <div class="absolute inset-0 pointer-events-none" style="opacity: var(--grain-opacity); background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22/></filter><rect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22 opacity=%221%22/></svg>')" />

    <!-- ── Top: Clock ─────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col items-center justify-end pb-10 pt-16 w-full">

      <!-- Time -->
      <div class="lock-time flex items-baseline leading-none tabular-nums" style="gap: 2px">
        <span class="lock-time__num">{{ hh }}</span>
        <span class="lock-time__colon">:</span>
        <span class="lock-time__num">{{ mm }}</span>
      </div>

      <!-- Date -->
      <p class="lock-date capitalize">{{ dateStr }}</p>

      <!-- App name -->
      <p class="lock-wordmark">Traker</p>
    </div>

    <!-- ── Middle: PIN dots ───────────────────────────────────────────── -->
    <div class="flex flex-col items-center gap-5 py-8">
      <div class="flex" style="gap: 20px" :class="{ 'animate-shake': shaking }">
        <div
          v-for="(dot, i) in dots"
          :key="i"
          class="lock-dot"
          :class="{
            'lock-dot--empty': dot === 0,
            'lock-dot--filled': dot === 1,
            'lock-dot--error': dot === 2,
            'lock-dot--success': dot === 3,
          }"
        />
      </div>

      <!-- Subtitle / error -->
      <p id="lock-subtitle" class="lock-subtitle h-5" :class="{ 'lock-subtitle--error': errorState }" aria-live="polite">
        {{ subtitle }}
      </p>
    </div>

    <!-- ── Bottom: Numpad ─────────────────────────────────────────────── -->
    <div class="flex-1 flex items-start justify-center pt-5 pb-12">
      <div>
        <!-- Row 1–9 -->
        <div class="grid grid-cols-3" style="gap: 13px; grid-template-columns: repeat(3, 72px)">
          <button v-for="k in KEYS" :key="k" type="button" class="np-btn" data-pin-key @click="pressKey(k)">{{ k }}</button>
        </div>

        <!-- Row 0 -->
        <div class="grid grid-cols-3 mt-[13px]" style="gap: 13px; grid-template-columns: repeat(3, 72px)">
          <div />
          <button type="button" class="np-btn" data-pin-key @click="pressKey('0')">0</button>
          <button type="button" class="np-btn np-ghost" aria-label="Borrar" @click="erase">
            <Delete :size="21" :stroke-width="1.75" />
          </button>
        </div>
      </div>
    </div>

    </div>
  </div>
</template>

<style scoped>
.lock-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  width: 100%;
  height: 100dvh;
  min-height: 100svh;
  overscroll-behavior: none;
}

.lock-aurora {
  min-height: 0;
  color: var(--text-primary);
  background: var(--background-base);
  font-family: var(--font-core);
}

/* ── Clock ─────────────────────────────────────────────────────────── */
.lock-time__num {
  font: 600 88px/1 var(--font-core);
  letter-spacing: -0.03em;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.lock-time__colon {
  font: 600 88px/1 var(--font-core);
  color: var(--text-muted);
  margin: 0 1px;
}
.lock-date {
  font: 400 14px/1.4 var(--font-core);
  color: var(--text-muted);
  margin-top: 10px;
  letter-spacing: 0.01em;
}
.lock-wordmark {
  margin-top: 30px;
  font: 600 11px/1 var(--font-core);
  color: var(--text-muted);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  opacity: 0.7;
}

/* ── PIN dots ──────────────────────────────────────────────────────── */
.lock-dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  transition: background var(--dur-fast) var(--ease-calm), border-color var(--dur-fast) var(--ease-calm), transform var(--dur-fast) var(--ease-calm);
}
.lock-dot--empty { background: transparent; border: 1.5px solid var(--border-strong); }
.lock-dot--filled { background: var(--text-primary); border: 1.5px solid var(--text-primary); transform: scale(1.18); }
.lock-dot--error { background: var(--status-destructive); border: 1.5px solid var(--status-destructive); transform: scale(1.18); }
.lock-dot--success { background: var(--action-primary); border: 1.5px solid var(--action-primary); transform: scale(1.18); }

.lock-subtitle {
  font: 400 13px/1.4 var(--font-core);
  letter-spacing: 0.01em;
  color: var(--text-muted);
  transition: color var(--dur-base) var(--ease-calm);
}
.lock-subtitle--error { color: var(--status-destructive); }

/* ── Numpad — Aurora glass ─────────────────────────────────────────── */
.np-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--surface-translucent-fallback);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font: 500 25px/1 var(--font-core);
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--dur-base) var(--ease-calm), border-color var(--dur-fast) var(--ease-calm), transform var(--dur-instant) var(--ease-calm);
}
@supports (backdrop-filter: blur(1px)) {
  .np-btn { background: var(--surface-translucent); backdrop-filter: blur(var(--blur-glass)) saturate(140%); }
}

.np-btn:active {
  border-color: var(--border-strong);
  transform: scale(var(--press-scale));
}

.np-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-secondary);
}
.np-ghost:active {
  background: var(--surface-translucent-fallback);
  border-color: transparent;
}
</style>
