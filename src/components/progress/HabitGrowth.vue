<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { resolveHabitIcon } from '@utils/icons'

// ─── Props ──────────────────────────────────────────────
const props = defineProps({
  currentDay: { type: Number, required: true },
  duration: { type: Number, required: true },
  color: { type: String, required: true }, // color base en hex
  icon: { type: String, required: true },
  seed: { type: String, default: 'habit' },
  logs: { type: Object, default: () => ({}) },
})

// ─── Constantes ─────────────────────────────────────────
const COLS = 28
const ROWS = 20
const UNLOGGED_COLOR = 'color-mix(in srgb, var(--color-text-faint) 48%, var(--color-surface))'
const FUTURE_COLOR = 'color-mix(in srgb, var(--color-info) 22%, var(--color-surface))'

// ─── Funciones puras ────────────────────────────────────
function clampProgress(day) {
  return Math.min(1, Math.max(0, day / Math.max(1, props.duration)))
}

function hash(x, y, salt = 0) {
  let value = 2166136261
  const input = `${props.seed}:${x}:${y}:${salt}`
  for (let i = 0; i < input.length; i++) {
    value ^= input.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0) / 4294967295
}

function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

// ─── Estado reactivo ────────────────────────────────────
const phase = ref(0)
const cellColors = shallowRef([])
const root = ref(null)

const progress = computed(() => clampProgress(props.currentDay))
const percentage = computed(() => Math.round(progress.value * 100))
const habitIcon = computed(() => resolveHabitIcon(props.icon))

// ─── Niveles y distribución ────────────────────────────
const LEVEL_META = {
  0: { label: 'No', color: 'var(--color-text-faint)' },
  1: { label: 'A medias · mínima', color: 'color-mix(in srgb, var(--growth-color) 42%, var(--color-surface))' },
  2: { label: 'A medias', color: 'color-mix(in srgb, var(--growth-color) 72%, var(--color-text))' },
  3: { label: 'Sí', color: 'var(--growth-color)' },
  4: { label: 'Descanso consciente', color: 'var(--progress-skipped)' },
}

const levelDistribution = computed(() => {
  const counts = new Map(Object.keys(LEVEL_META).map(level => [Number(level), 0]))
  for (const [day, log] of Object.entries(props.logs ?? {})) {
    if (Number(day) > props.currentDay) continue
    const level = Number(log?.level)
    if (counts.has(level)) counts.set(level, counts.get(level) + 1)
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  if (!total) return []
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([level, count]) => ({
      level,
      count,
      ratio: count / total,
      ...LEVEL_META[level],
    }))
})

const dominantLevel = computed(() => {
  if (!levelDistribution.value.length) return null
  return levelDistribution.value.reduce((dominant, item) => item.count > dominant.count ? item : dominant)
})

const distributionLabel = computed(() => {
  if (!dominantLevel.value) return 'Aún sin registros'
  return `Predomina ${dominantLevel.value.label.toLowerCase()} · ${Math.round(dominantLevel.value.ratio * 100)}%`
})

// ─── Construcción de colores por celda ────────────────
function buildCellColors() {
  const total = ROWS * COLS
  const positions = Array.from({ length: total }, (_, index) => index)
    .sort((a, b) => hash(a % COLS, Math.floor(a / COLS), 917)
      - hash(b % COLS, Math.floor(b / COLS), 917))

  const colors = Array(total).fill(FUTURE_COLOR)
  const registeredDays = levelDistribution.value.reduce((sum, item) => sum + item.count, 0)
  const safeDuration = Math.max(1, props.duration)
  const paintedTotal = Math.round(Math.min(1, registeredDays / safeDuration) * total)
  const elapsedWithoutLog = Math.max(0, Math.min(props.currentDay, safeDuration) - registeredDays)
  const unloggedTotal = Math.round((elapsedWithoutLog / safeDuration) * total)

  let assigned = 0
  levelDistribution.value.forEach((item, itemIndex) => {
    const remaining = paintedTotal - assigned
    const amount = itemIndex === levelDistribution.value.length - 1
      ? remaining
      : Math.floor(item.ratio * paintedTotal)
    for (let offset = 0; offset < Math.min(amount, remaining); offset++) {
      colors[positions[assigned + offset]] = item.color
    }
    assigned += Math.min(amount, remaining)
  })

  const unloggedEnd = Math.min(total, assigned + unloggedTotal)
  for (let index = assigned; index < unloggedEnd; index++) {
    colors[positions[index]] = UNLOGGED_COLOR
  }

  return colors
}

// ─── Generación de la forma ASCII (orgánica) ──────────
const asciiShape = computed(() => {
  const cx = (COLS - 1) / 2
  const cy = (ROWS - 1) / 2
  const time = phase.value
  const lines = []

  for (let y = 0; y < ROWS; y++) {
    let line = ''
    for (let x = 0; x < COLS; x++) {
      const dx = (x - cx) / cx
      const dy = (y - cy) / cy
      const angle = Math.atan2(dy, dx)
      const dist = Math.sqrt(dx * dx + dy * dy)

      const breathe = 0.72 + 0.22 * Math.sin(time * 0.7)
      const wave1 = 0.18 * Math.sin(angle * 2.5 + time * 1.1)
      const wave2 = 0.12 * Math.sin(angle * 4.2 - time * 0.85)
      const wave3 = 0.09 * Math.cos(dist * 6 - time * 1.3)
      const wave4 = 0.06 * Math.sin(angle * 7 + time * 0.5)

      const radius = breathe + wave1 + wave2 + wave3 + wave4
      const falloff = Math.max(0, 1 - dist / (radius * 1.05))
      const density = Math.pow(falloff, 1.4)

      const threshold = 0.12 + 0.08 * Math.sin(time * 0.5 + x * 0.07 + y * 0.06)
      const noise = hash(x, y, Math.floor(time * 2))

      if (density > threshold) {
        const p = 0.35 + density * 0.5
        line += noise < p ? '1' : '0'
      } else if (density > threshold * 0.4) {
        line += noise < 0.25 ? (noise < 0.5 ? '1' : '0') : ' '
      } else {
        line += ' '
      }
    }
    lines.push(line)
  }
  return lines.join('\n')
})

// Array de caracteres (se actualiza en cada frame)
const asciiCells = computed(() => asciiShape.value.replaceAll('\n', '').split(''))

// ─── Color dinámico (para el borde y textos) ──────────
const dynamicColor = computed(() => {
  const base = hexToHSL(props.color)
  const hueShift = 8 * Math.sin(phase.value * 0.4)
  const satShift = 6 * Math.sin(phase.value * 0.3)
  const lightShift = 4 * Math.sin(phase.value * 0.5)
  const h = (base.h + hueShift + 360) % 360
  const s = Math.min(100, Math.max(0, base.s + satShift))
  const l = Math.min(100, Math.max(0, base.l + lightShift))
  return `hsl(${h}, ${s}%, ${l}%)`
})

// ─── Bucle de animación (phase) ────────────────────────
let rafId = null
let lastTime = 0
const SPEED = 0.035
const FRAME_INTERVAL = 1000 / 15
let motionQuery = null
let observer = null
let isInView = true

function animatePhase(time) {
  if (lastTime === 0) lastTime = time
  if (time - lastTime < FRAME_INTERVAL) {
    rafId = requestAnimationFrame(animatePhase)
    return
  }
  const delta = (time - lastTime) / 16.67
  phase.value += SPEED * delta
  lastTime = time
  rafId = requestAnimationFrame(animatePhase)
}

function stopPhase() {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
  lastTime = 0
}

function syncPhaseAnimation() {
  const shouldAnimate = !motionQuery?.matches && isInView && document.visibilityState !== 'hidden'
  if (shouldAnimate && rafId === null) rafId = requestAnimationFrame(animatePhase)
  else if (!shouldAnimate) stopPhase()
  if (motionQuery?.matches) phase.value = 0
}

// ─── Actualización de colores de celdas ────────────────
watch(
  [() => props.logs, () => props.currentDay, () => props.duration],
  () => {
    cellColors.value = buildCellColors()
  },
  { immediate: true, deep: true }
)

// ─── Ciclo de vida ──────────────────────────────────────
onMounted(() => {
  motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
  motionQuery?.addEventListener?.('change', syncPhaseAnimation)
  document.addEventListener('visibilitychange', syncPhaseAnimation)
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      isInView = entry?.isIntersecting !== false
      syncPhaseAnimation()
    }, { rootMargin: '80px' })
    observer.observe(root.value)
  }
  syncPhaseAnimation()
})

onBeforeUnmount(() => {
  stopPhase()
  observer?.disconnect()
  motionQuery?.removeEventListener?.('change', syncPhaseAnimation)
  document.removeEventListener('visibilitychange', syncPhaseAnimation)
})
</script>

<template>
  <figure
    ref="root"
    class="habit-growth"
    :style="{ '--growth-color': dynamicColor }"
    role="img"
    :aria-label="`Forma de crecimiento del hábito: día ${currentDay} de ${duration}, ${percentage}% del recorrido. ${distributionLabel}`"
  >
    <div class="habit-growth__field" aria-hidden="true">
      <div class="habit-growth__shape">
        <span
          v-for="(char, index) in asciiCells"
          :key="index"
          class="habit-growth__cell"
          :style="{ color: char === ' ' ? 'transparent' : cellColors[index] }"
        >
          <component
            :is="habitIcon"
            v-if="char !== ' '"
            :size="8"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </span>
      </div>
    </div>
    <figcaption>
      <span>{{ distributionLabel }}</span>
      <span>Día {{ currentDay }} de {{ duration }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.habit-growth {
  display: grid;
  gap: var(--space-2, 0.5rem);
  margin: 0;
  padding-block: var(--space-3, 1rem);
  border-block: 1px solid var(--color-border, #e2e8f0);
  overflow: hidden;
}

.habit-growth__field {
  display: grid;
  min-height: clamp(8rem, 22vw, 10.5rem);
  place-items: center;
  overflow: hidden;
}

.habit-growth__shape {
  display: grid;
  grid-template-columns: repeat(28, 0.52rem);
  grid-template-rows: repeat(20, 0.52rem);
  margin: 0;
  color: var(--growth-color);
  user-select: none;
  opacity: 0.92;
  transform-origin: center;
}

@media (prefers-reduced-motion: no-preference) {
  .habit-growth__shape {
    animation: habit-growth-breathe 7s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate;
  }
}

.habit-growth__cell {
  display: grid;
  width: 0.52rem;
  height: 0.52rem;
  place-items: center;
}

.habit-growth__cell :deep(svg) {
  display: block;
  width: 0.5rem;
  height: 0.5rem;
}

.habit-growth figcaption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3, 0.75rem);
  color: var(--color-text-faint);
  font-size: var(--caption-size, 0.75rem);
  font-weight: var(--caption-weight, 400);
  line-height: var(--caption-line, 1.4);
}

.habit-growth figcaption span:first-child {
  color: color-mix(in srgb, var(--growth-color) 72%, var(--color-text, #0f172a));
  font-weight: var(--label-weight, 600);
}

@keyframes habit-growth-breathe {
  0% {
    opacity: 0.78;
    transform: translate3d(-1.5%, 1%, 0) rotate(-0.8deg) scale(0.97);
  }
  50% {
    opacity: 0.95;
    transform: translate3d(0.5%, -0.5%, 0) rotate(0.4deg) scale(1.02);
  }
  100% {
    opacity: 0.84;
    transform: translate3d(1.5%, 0.5%, 0) rotate(0.8deg) scale(0.99);
  }
}

</style>
