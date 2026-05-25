<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@stores/auth'

const auth = useAuthStore()

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
onMounted(() => { tick(); timer = setInterval(tick, 1000) })
onUnmounted(() => clearInterval(timer))

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
  // Dots pulse green — brief pause before overlay slides away
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
    class="fixed inset-0 z-[999] flex flex-col items-center overflow-hidden select-none"
    style="background: linear-gradient(155deg, #0d1117 0%, #060508 48%, #0c0912 100%)"
  >

    <!-- ── Subtle noise overlay ───────────────────────────────────────── -->
    <div class="absolute inset-0 opacity-[0.025] pointer-events-none"
         style="background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22/></filter><rect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22 opacity=%221%22/></svg>')" />

    <!-- ── Top: Clock ─────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col items-center justify-end pb-10 pt-16 w-full">

      <!-- Time -->
      <div class="flex items-baseline leading-none tabular-nums" style="gap: 2px">
        <span
          class="font-[200] text-white"
          style="font-size: clamp(76px, 21vw, 104px); letter-spacing: -3px"
        >{{ hh }}</span>
        <span
          class="font-[200] text-white/40"
          style="font-size: clamp(76px, 21vw, 104px); letter-spacing: -1px; margin: 0 1px"
        >:</span>
        <span
          class="font-[200] text-white"
          style="font-size: clamp(76px, 21vw, 104px); letter-spacing: -3px"
        >{{ mm }}</span>
      </div>

      <!-- Date -->
      <p class="text-[14px] font-light text-white/35 mt-3 capitalize tracking-[0.01em]">
        {{ dateStr }}
      </p>

      <!-- App name -->
      <p class="mt-8 text-[10px] font-light text-white/15 tracking-[0.32em] uppercase">
        Traker
      </p>
    </div>

    <!-- ── Middle: PIN dots ───────────────────────────────────────────── -->
    <div class="flex flex-col items-center gap-5 py-8">
      <div
        class="flex"
        style="gap: 20px"
        :class="{ 'animate-shake': shaking }"
      >
        <div
          v-for="(dot, i) in dots"
          :key="i"
          class="rounded-full transition-all duration-200 ease-out"
          :class="{
            // empty
            'w-[13px] h-[13px] border-[1.5px] border-white/25 bg-transparent': dot === 0,
            // filled
            'w-[13px] h-[13px] bg-white border-white scale-[1.18]': dot === 1,
            // error
            'w-[13px] h-[13px] bg-red-400 border-transparent scale-[1.18]': dot === 2,
            // success
            'w-[13px] h-[13px] border-transparent scale-[1.18]': dot === 3,
          }"
          :style="dot === 3 ? { backgroundColor: '#CCFF00', boxShadow: '0 0 12px rgba(204,255,0,0.55)' } : {}"
        />
      </div>

      <!-- Subtitle / error -->
      <p
        class="text-[13px] font-light tracking-wide transition-all duration-300 h-5"
        :class="errorState ? 'text-red-400/70' : 'text-white/28'"
      >
        {{ subtitle }}
      </p>
    </div>

    <!-- ── Bottom: Numpad ─────────────────────────────────────────────── -->
    <div class="flex-1 flex items-start justify-center pt-5 pb-14">
      <div>
        <!-- Row 1–9 -->
        <div class="grid grid-cols-3" style="gap: 13px; grid-template-columns: repeat(3, 76px)">
          <button
            v-for="k in KEYS"
            :key="k"
            class="np-btn"
            @click="pressKey(k)"
          >{{ k }}</button>
        </div>

        <!-- Row 0 -->
        <div class="grid grid-cols-3 mt-[13px]" style="gap: 13px; grid-template-columns: repeat(3, 76px)">
          <!-- Empty slot -->
          <div />

          <button class="np-btn" @click="pressKey('0')">0</button>

          <!-- Backspace -->
          <button class="np-btn np-ghost" aria-label="Borrar" @click="erase">
            <svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M10 1H24C24.5523 1 25 1.44772 25 2V18C25 18.5523 24.5523 19 24 19H10L1 10L10 1Z"
                stroke="white" stroke-opacity="0.65" stroke-width="1.4" stroke-linejoin="round"
              />
              <path
                d="M10.5 7L16.5 13M16.5 7L10.5 13"
                stroke="white" stroke-opacity="0.65" stroke-width="1.4" stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Numpad button — iOS frosted glass style ──────────────────────────── */
.np-btn {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.092);
  border: 1px solid rgba(255, 255, 255, 0.11);
  color: rgba(255, 255, 255, 0.95);
  font-size: 28px;
  font-weight: 300;
  font-family: inherit;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  /* Asymmetric: slow release, fast press via :active override */
  transition: background var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-standard);
}

.np-btn:active {
  background: rgba(255, 255, 255, 0.22);
  transform: scale(0.98);
}

/* Ghost button: delete key */
.np-ghost {
  background: transparent;
  border-color: transparent;
  font-size: 20px;
}

.np-ghost:active {
  background: rgba(255, 255, 255, 0.10);
  transform: scale(0.98);
}
</style>
