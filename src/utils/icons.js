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
  { key: 'Activity',      component: Activity      },
  { key: 'Footprints',    component: Footprints    },
  { key: 'GlassWater',    component: GlassWater    },
  { key: 'BookOpen',      component: BookOpen      },
  { key: 'Bed',           component: Bed           },
  { key: 'PersonStanding',component: PersonStanding},
  { key: 'Dumbbell',      component: Dumbbell      },
  { key: 'Palette',       component: Palette       },
  { key: 'PenLine',       component: PenLine       },
  { key: 'Music',         component: Music         },
  { key: 'Apple',         component: Apple         },
  { key: 'Brain',         component: Brain         },
  { key: 'BicepsFlexed',  component: BicepsFlexed  },
  { key: 'Bike',          component: Bike          },
  { key: 'Leaf',          component: Leaf          },
  { key: 'Coffee',        component: Coffee        },
  { key: 'Target',        component: Target        },
  { key: 'Pill',          component: Pill          },
  { key: 'HandHeart',     component: HandHeart     },
  { key: 'FileText',      component: FileText      },
  { key: 'Moon',          component: Moon          },
  { key: 'Zap',           component: Zap           },
  { key: 'Flame',         component: Flame         },
  { key: 'Sunrise',       component: Sunrise       },
  { key: 'Puzzle',        component: Puzzle        },
  { key: 'Lightbulb',     component: Lightbulb     },
  { key: 'Waves',         component: Waves         },
  { key: 'Heart',         component: Heart         },
  { key: 'Trophy',        component: Trophy        },
  { key: 'Timer',         component: Timer         },
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
