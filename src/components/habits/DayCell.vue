<script setup>
/**
 * DayCell — single day unit in the contribution grid.
 *
 * Visual levels (via CSS color-mix, no JS color calc needed):
 *   0  → neutral surface  (not done)
 *   1  → 22 % habit color (mínimo)
 *   2  → 60 % habit color (bien)
 *   3  → 100 % habit color (excelente)
 *   4  → calm neutral (día flexible, continuity only)
 *
 * The --dc CSS var receives the raw habit hex so every state
 * can be derived purely in CSS.
 */
const props = defineProps({
  day:        { type: Number,  required: true },
  level:      { type: Number,  default: 0 },
  color:      { type: String,  required: true },
  isToday:    { type: Boolean, default: false },
  isFuture:   { type: Boolean, default: false },
  emotion:    { type: String,  default: null },
  isSelected: { type: Boolean, default: false },
})

const emit = defineEmits(['tap'])

const LEVEL_LABELS = {
  0: 'no realizado',
  1: 'mínimo',
  2: 'bien',
  3: 'excelente',
  4: 'día flexible',
}
</script>

<template>
  <button
    class="dc"
    :class="[
      isFuture             ? 'dc--future'   : `dc--lv${level}`,
      isToday && !isFuture ? 'dc--today'    : '',
      isSelected           ? 'dc--selected' : '',
    ]"
    :style="{ '--dc': color }"
    :disabled="isFuture"
    :aria-label="`Día ${day}${isToday ? ', hoy' : ''}, ${LEVEL_LABELS[level] ?? 'sin registro'}`"
    @click="emit('tap')"
  >
    <!-- Day number -->
    <span class="dc__num" aria-hidden="true">{{ day }}</span>

  </button>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════
   BASE CELL
   ═══════════════════════════════════════════════════ */
.dc {
  /* Layout */
  position: relative;
  width: min(100%, 68px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;

  /* Shape */
  border-radius: var(--radius-cell);
  border: 1px solid rgba(255, 255, 255, 0.04);

  /* Interaction */
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;

  /* Smooth state transitions */
  transition:
    all var(--duration-base) var(--ease-standard);
  will-change: transform, background-color;
}

/* ─── Press spring ────────────────────────────────── */
.dc:active:not(:disabled) {
  transform: scale(0.98);
}

/* ═══════════════════════════════════════════════════
   LEVEL STATES
   (all colors derived from --dc via color-mix)
   ═══════════════════════════════════════════════════ */

/* Future: very faint, non-interactive */
.dc--future {
  background-color: var(--color-surface-raised);
  opacity: 0.30;
  pointer-events: none;
}

/* Level 0: empty / not logged */
.dc--lv0 {
  background-color: var(--color-surface-raised);
}

/* Subtle hover hint for empty past days */
.dc--lv0:not(.dc--today):hover {
  background-color: color-mix(in srgb, var(--dc) 8%, var(--color-surface-raised));
  border-color: color-mix(in srgb, var(--dc) 20%, var(--color-border));
}

/* Level 1: mínimo — light tint of the habit color */
.dc--lv1 {
  background-color: color-mix(in srgb, var(--dc) 22%, var(--color-surface-raised));
}

/* Level 2: bien — medium fill */
.dc--lv2 {
  background-color: color-mix(in srgb, var(--dc) 60%, var(--color-surface));
}

/* Level 3: excelente — full habit color + glow */
.dc--lv3 {
  background-color: var(--dc);
  box-shadow: 0 0 10px color-mix(in srgb, var(--dc) 45%, transparent);
}

/* Level 4: día flexible — continuity without progress */
.dc--lv4 {
  background: rgba(143, 144, 152, 0.14);
  border-color: rgba(143, 144, 152, 0.34);
}

/* ═══════════════════════════════════════════════════
   TODAY INDICATOR
   Uses the habit's own color for the ring
   ═══════════════════════════════════════════════════ */
.dc--today {
  z-index: 1;
  border: 2px solid var(--dc);
  box-shadow: var(--shadow-glow);
}

/* No log yet today */
.dc--today.dc--lv0 {
  background: var(--color-surface-raised);
}

/* Logged today: keep the ring on top of the fill */
.dc--today.dc--lv1,
.dc--today.dc--lv2,
.dc--today.dc--lv3,
.dc--today.dc--lv4 {
  border: 2px solid color-mix(in srgb, var(--dc) 80%, #fff);
}

/* ═══════════════════════════════════════════════════
   INNER CONTENT
   ═══════════════════════════════════════════════════ */

/* Day number */
.dc__num {
  font-size: clamp(13px, 4vw, 18px);
  font-weight: 500;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  pointer-events: none;
  user-select: none;
  transition: color 380ms ease;

  /* Default: faint for empty / future */
  color: rgba(255, 255, 255, 0.82);
}

/* Levels 1-3: dark number for contrast on filled backgrounds */
.dc--lv1 .dc__num {
  /* On 22% tint the bg is still dark, keep white-ish */
  color: color-mix(in srgb, var(--dc) 90%, rgba(255,255,255,0.7));
}

.dc--lv2 .dc__num,
.dc--lv3 .dc__num {
  /* On 60-100% fill use very dark text for contrast */
  color: color-mix(in srgb, var(--dc) 20%, #0B0D10);
}

.dc--lv4 .dc__num {
  color: rgba(255, 255, 255, 0.72);
}

/* Larger font on desktop for roomier cells */
@media (min-width: 1024px) {
  .dc__num {
    font-size: 18px;
  }
}

.dc--selected {
  border: 2px solid var(--dc) !important;
  box-shadow: var(--shadow-hover-glow) !important;
}
</style>
