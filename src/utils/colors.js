export function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return { r, g, b }
}

export function colorAtOpacity(hex, opacity) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${opacity})`
}

// level: 0=empty, 1=minimal, 2=medium, 3=full
export function levelColor(hex, level) {
  const opacities = [0, 0.22, 0.58, 1]
  return colorAtOpacity(hex, opacities[level] ?? 0)
}

export const PALETTE = [
  { name: 'Azul aurora', value: '#6C8CFF' },
  { name: 'Cian',        value: '#56D6F0' },
  { name: 'Violeta',     value: '#A66CFF' },
  { name: 'Coral',       value: '#F58C6E' },
  { name: 'Ámbar',       value: '#E8B96A' },
  { name: 'Azul suave',  value: '#93AAFF' },
  { name: 'Cian suave',  value: '#9BE7F7' },
  { name: 'Violeta suave', value: '#C9A8FF' },
  { name: 'Coral suave', value: '#FFB79F' },
  { name: 'Niebla',      value: '#A8B0C6' },
]

export const DEFAULT_HABIT_COLOR = PALETTE[7].value

/** Preserve each habit's identity while rejecting malformed color data. */
export function normalizeHabitColor(value) {
  const candidate = String(value ?? '').trim()
  if (!/^#[0-9a-f]{6}$/i.test(candidate)) return DEFAULT_HABIT_COLOR
  return candidate.toUpperCase()
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(normalizeHabitColor(hex))
  const linear = [r, g, b].map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** Choose the higher-contrast foreground for a habit-colored surface. */
export function habitColorForeground(value) {
  const luminance = relativeLuminance(value)
  const dark = '#0A0E1A'
  const light = '#FCFCFF'
  const darkContrast = (luminance + 0.05) / 0.05
  const lightContrast = 1.05 / (luminance + 0.05)
  return darkContrast >= lightContrast ? dark : light
}

// Habit icon keys are now in src/utils/icons.js (Lucide components).
