<script setup>
import { ChevronRight, Target } from 'lucide-vue-next'
import { resolveHabitIcon } from '@utils/icons'
import {
  AuroraSurface,
  AuroraBadge,
  AuroraStatusTag,
  AuroraHabitIcon,
} from '@components/aurora/index.js'

defineProps({
  // [{ id, title, personalWhy, horizon, action:{title,minimumVersion,status}, habits:[{id,name,icon,tone,doneToday}] }]
  goals: { type: Array, default: () => [] },
})

const HORIZONS = [
  { value: 'long', label: 'Largo plazo', tone: 'return' },
  { value: 'medium', label: 'Mediano plazo', tone: 'reflect' },
  { value: 'short', label: 'Corto plazo', tone: 'focus' },
]
</script>

<template>
  <section v-if="goals.length" class="gh" aria-labelledby="gh-title">
    <div class="gh__heading">
      <h2 id="gh-title">Tus metas</h2>
      <RouterLink to="/goals">Administrar metas</RouterLink>
    </div>
    <p class="gh__intro">La razón por la que lo haces, y el paso de hoy hacia ella.</p>

    <template v-for="h in HORIZONS" :key="h.value">
      <div v-if="goals.some(g => g.horizon === h.value)" class="gh__group">
        <span class="gh__group-label">{{ h.label }}</span>
        <AuroraSurface
          v-for="goal in goals.filter(g => g.horizon === h.value)"
          :key="goal.id"
          level="2"
          padding="20px"
          class="gh__card"
        >
          <div class="gh__card-top">
            <AuroraBadge :tone="h.tone">{{ h.label }}</AuroraBadge>
            <RouterLink :to="`/goals/${goal.id}`" class="gh__card-link" aria-label="Ver meta">
              <ChevronRight :size="18" :stroke-width="1.75" />
            </RouterLink>
          </div>

          <h3 class="gh__card-title">{{ goal.title }}</h3>
          <p v-if="goal.personalWhy" class="gh__card-why">{{ goal.personalWhy }}</p>

          <div v-if="goal.action" class="gh__step">
            <span class="gh__step-label">Siguiente paso</span>
            <span class="gh__step-title">{{ goal.action.title }}</span>
            <span v-if="goal.action.minimumVersion" class="gh__step-min">Versión mínima: {{ goal.action.minimumVersion }}</span>
          </div>

          <div v-if="goal.habits?.length" class="gh__habits">
            <span class="gh__habits-label">Hábitos que suman</span>
            <div class="gh__habits-list">
              <div v-for="habit in goal.habits" :key="habit.id" class="gh__habit">
                <AuroraHabitIcon :tone="habit.tone" :size="28">
                  <component :is="resolveHabitIcon(habit.icon)" :size="14" :stroke-width="1.75" />
                </AuroraHabitIcon>
                <span>{{ habit.name }}</span>
                <AuroraStatusTag :status="habit.doneToday ? 'complete' : 'pending'" :show-label="false" />
              </div>
            </div>
          </div>
        </AuroraSurface>
      </div>
    </template>
  </section>

  <section v-else class="gh gh--empty">
    <Target :size="26" :stroke-width="1.5" />
    <h2>Aún no tienes una dirección</h2>
    <p>Una meta te recuerda por qué haces lo que haces hoy, aunque el paso sea pequeño.</p>
    <RouterLink to="/goals/new" class="gh__empty-cta">Definir una meta</RouterLink>
  </section>
</template>

<style scoped>
.gh { display: flex; flex-direction: column; gap: 20px; }
.gh__heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.gh__heading h2 { margin: 0; font: 600 12px/1 var(--font-core); color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; }
.gh__heading a { font: 600 13px/1 var(--font-core); color: var(--text-secondary); text-decoration: none; }
.gh__intro { margin: -10px 0 0; font: 400 14px/1.5 var(--font-core); color: var(--text-muted); }

.gh__group { display: flex; flex-direction: column; gap: 10px; }
.gh__group-label { font: 600 11px/1 var(--font-core); color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; }

.gh__card { display: flex; flex-direction: column; gap: 14px; }
.gh__card-top { display: flex; align-items: center; justify-content: space-between; }
.gh__card-link { display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-pill); color: var(--text-muted); }
.gh__card-link:hover { background: var(--surface-secondary); color: var(--text-primary); }

.gh__card-title { margin: 0; font: 600 19px/1.25 var(--font-core); color: var(--text-primary); letter-spacing: -0.015em; overflow-wrap: anywhere; }
.gh__card-why { margin: 0; font: 400 18px/1.35 var(--font-editorial); color: var(--text-secondary); text-wrap: pretty; }

.gh__step { display: flex; flex-direction: column; gap: 2px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
.gh__step-label { font: 600 11px/1 var(--font-core); color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; }
.gh__step-title { margin-top: 4px; font: 600 14px/1.4 var(--font-core); color: var(--text-primary); }
.gh__step-min { font: 400 12px/1.4 var(--font-core); color: var(--text-muted); }

.gh__habits { display: flex; flex-direction: column; gap: 8px; }
.gh__habits-label { font: 600 11px/1 var(--font-core); color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; }
.gh__habits-list { display: flex; flex-direction: column; gap: 8px; }
.gh__habit { display: flex; align-items: center; gap: 10px; }
.gh__habit span { flex: 1; min-width: 0; font: 500 13px/1.3 var(--font-core); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.gh--empty { align-items: flex-start; padding: 32px 0; gap: 8px; }
.gh--empty svg { color: var(--action-primary); margin-bottom: 4px; }
.gh--empty h2 { margin: 0; font: 400 22px/1.3 var(--font-editorial); color: var(--text-primary); }
.gh--empty p { margin: 0 0 8px; max-width: 40ch; font: 400 14px/1.55 var(--font-core); color: var(--text-secondary); }
.gh__empty-cta { display: inline-flex; min-height: 44px; align-items: center; padding: 0 18px; border-radius: var(--radius-pill); background: var(--action-primary); color: var(--action-primary-fg); font: 600 14px/1 var(--font-core); text-decoration: none; }
</style>
