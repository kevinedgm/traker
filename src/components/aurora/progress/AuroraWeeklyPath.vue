<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  days: { default: () => [] },
  height: { default: 96 },
  showLabels: { default: true },
  animate: { default: true },
})
const root = ref(null)
const width = ref(320)
let observer

const colors = {
  complete: 'var(--progress-complete)',
  partial: 'var(--progress-complete)',
  adapted: 'var(--progress-adapted)',
  resumed: 'var(--progress-resumed)',
  paused: 'var(--progress-paused)',
  postponed: 'var(--progress-postponed)',
  skipped: 'var(--progress-skipped)',
  none: 'var(--progress-skipped)',
  pending: 'var(--border-strong)',
  started: 'var(--action-primary)',
}
const labels = {
  complete: 'completado',
  partial: 'completado en parte',
  adapted: 'adaptado',
  resumed: 'retomado',
  paused: 'pausado',
  postponed: 'pospuesto',
  skipped: 'omitido a propósito',
  none: 'sin registro',
  pending: 'pendiente',
  started: 'iniciado',
}
const levels = {
  complete: .86,
  partial: .6,
  adapted: .68,
  resumed: .78,
  paused: .34,
  postponed: .42,
  skipped: .28,
  none: .28,
  pending: .5,
  started: .56,
}
const points = computed(() => {
  const count = Math.max(props.days.length, 2)
  const padding = 14
  const step = (width.value - padding * 2) / (count - 1)
  return props.days.map((day, index) => ({
    x: padding + index * step,
    y: props.height - 14 - (levels[day.state] ?? .5) * (props.height - 34),
    ...day,
  }))
})
const segments = computed(() => points.value.slice(0, -1).map((start, index) => {
  const end = points.value[index + 1]
  const middle = (start.x + end.x) / 2
  const broken = ['none', 'skipped', 'postponed', 'paused'].includes(end.state)
    || ['none', 'skipped'].includes(start.state)
  return {
    d: `M${start.x} ${start.y} C${middle} ${start.y} ${middle} ${end.y} ${end.x} ${end.y}`,
    color: colors[end.state] || 'var(--border-strong)',
    dashed: broken,
  }
}))
const aria = computed(() => `Trayectoria: ${props.days.map(day => `${day.label || ''} ${labels[day.state] || ''}`).join(', ')}`)

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(entries => {
    const nextWidth = entries[0].contentRect.width
    if (nextWidth > 0) width.value = nextWidth
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <figure ref="root">
    <svg :viewBox="`0 0 ${width} ${height}`" width="100%" :height="height" role="img" :aria-label="aria">
      <path
        v-for="(segment,index) in segments"
        :key="index"
        :d="segment.d"
        fill="none"
        :stroke="segment.color"
        stroke-width="2.6"
        stroke-linecap="round"
        :stroke-dasharray="segment.dashed?'1 7':undefined"
        :class="{draw:animate&&!segment.dashed}"
      />
      <circle
        v-for="(point,index) in points"
        :key="index"
        :cx="point.x"
        :cy="point.y"
        :r="point.today?6:4.5"
        :fill="point.today?'none':colors[point.state]||'var(--border-strong)'"
        :stroke="point.today?'var(--action-primary)':'none'"
        :stroke-width="point.today?2:0"
      />
    </svg>
    <figcaption v-if="showLabels">
      <span v-for="(day,index) in days" :key="index" :class="{today:day.today}">{{day.label}}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
figure{margin:0}
svg{display:block;overflow:visible}
.draw{stroke-dasharray:400;animation:aurora-draw var(--dur-progress) var(--ease-calm)}
figcaption{display:flex;margin-top:6px}
figcaption span{flex:1;color:var(--text-muted);font:600 11px/normal var(--font-core);letter-spacing:.04em;text-align:center;text-transform:uppercase}
figcaption span.today{color:var(--action-primary)}
</style>
