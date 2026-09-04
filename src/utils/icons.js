/**
 * @file icons.js
 * Central registry for habit icons (Lucide components).
 *
 * All habit-icon rendering should go through `resolveHabitIcon(key)`
 * so legacy emoji strings stored in old habits fall back gracefully.
 */

import {
  Activity,
  Footprints,
  GlassWater,
  BookOpen,
  Bed,
  PersonStanding,
  Dumbbell,
  Palette,
  PenLine,
  Music,
  Apple,
  Brain,
  BicepsFlexed,
  Bike,
  Leaf,
  Coffee,
  Target,
  Pill,
  HandHeart,
  FileText,
  Moon,
  Zap,
  Flame,
  Sunrise,
  Puzzle,
  Lightbulb,
  Waves,
  Heart,
  Trophy,
  Timer,
} from 'lucide-vue-next'

/**
 * Ordered list used by the CreateHabitModal icon picker.
 * Each entry: { key: String, component: LucideComponent }
 */
export const HABIT_ICONS = [
  { key: 'Activity', label: 'Actividad', component: Activity },
  { key: 'Footprints', label: 'Pasos', component: Footprints },
  { key: 'GlassWater', label: 'Vaso de agua', component: GlassWater },
  { key: 'BookOpen', label: 'Libro abierto', component: BookOpen },
  { key: 'Bed', label: 'Descanso', component: Bed },
  { key: 'PersonStanding', label: 'Persona de pie', component: PersonStanding },
  { key: 'Dumbbell', label: 'Pesa', component: Dumbbell },
  { key: 'Palette', label: 'Paleta', component: Palette },
  { key: 'PenLine', label: 'Escritura', component: PenLine },
  { key: 'Music', label: 'Música', component: Music },
  { key: 'Apple', label: 'Manzana', component: Apple },
  { key: 'Brain', label: 'Mente', component: Brain },
  { key: 'BicepsFlexed', label: 'Fuerza', component: BicepsFlexed },
  { key: 'Bike', label: 'Bicicleta', component: Bike },
  { key: 'Leaf', label: 'Hoja', component: Leaf },
  { key: 'Coffee', label: 'Café', component: Coffee },
  { key: 'Target', label: 'Objetivo', component: Target },
  { key: 'Pill', label: 'Medicamento', component: Pill },
  { key: 'HandHeart', label: 'Cuidado', component: HandHeart },
  { key: 'FileText', label: 'Documento', component: FileText },
  { key: 'Moon', label: 'Luna', component: Moon },
  { key: 'Zap', label: 'Energía', component: Zap },
  { key: 'Flame', label: 'Llama', component: Flame },
  { key: 'Sunrise', label: 'Amanecer', component: Sunrise },
  { key: 'Puzzle', label: 'Rompecabezas', component: Puzzle },
  { key: 'Lightbulb', label: 'Idea', component: Lightbulb },
  { key: 'Waves', label: 'Olas', component: Waves },
  { key: 'Heart', label: 'Corazón', component: Heart },
  { key: 'Trophy', label: 'Logro', component: Trophy },
  { key: 'Timer', label: 'Temporizador', component: Timer },
]

/** Fast key → component lookup */
export const HABIT_ICON_MAP = Object.fromEntries(
  HABIT_ICONS.map(({ key, component }) => [key, component])
)

/** Default key when creating a new habit */
export const DEFAULT_ICON = 'Activity'

/**
 * Resolve a stored icon key to a Lucide component.
 * Falls back to Activity for unknown/legacy emoji strings.
 */
export function resolveHabitIcon(key) {
  return HABIT_ICON_MAP[key] ?? Activity
}
