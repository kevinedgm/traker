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
  { name: 'Neón',      value: '#CCFF00' },
  { name: 'Menta',     value: '#44F7B6' },
  { name: 'Cian',      value: '#62D5FF' },
  { name: 'Azul',      value: '#5B8CFF' },
  { name: 'Violeta',   value: '#8B5CF6' },
  { name: 'Rosa',      value: '#FF4D9D' },
  { name: 'Coral',     value: '#FF5C5C' },
  { name: 'Naranja',   value: '#FF9F1C' },
  { name: 'Ámbar',     value: '#FFD166' },
  { name: 'Blanco',    value: '#F7F7F2' },
]

// Habit icon keys are now in src/utils/icons.js (Lucide components).
