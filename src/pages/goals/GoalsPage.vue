<script setup>
import { computed, onMounted } from 'vue'
import { ArrowRight, Plus, Target } from 'lucide-vue-next'
import { useGoalsStore } from '@/stores/goals.js'

const store = useGoalsStore()
const visibleGoals = computed(() => [
  ...store.focusedGoals,
  ...store.activeGoals.filter(goal => goal.focusRank === null),
  ...store.pausedGoals,
  ...store.closedGoals,
])

onMounted(() => {
  if (!store.loaded) store.load().catch(() => {})
})

function statusLabel(status) {
  return ({ active: 'En curso', paused: 'En pausa', completed: 'Completada', reformulated: 'Reformulada', abandoned: 'Cerrada', archived: 'Archivada' })[status] ?? status
}
</script>

<template>
  <main class="goals-page">
    <header class="goals-page__header">
      <div>
        <p class="goals-page__eyebrow">Dirección, no presión</p>
        <h1>Metas</h1>
        <p>Convierte algo importante en un siguiente paso que sí cabe hoy.</p>
      </div>
      <RouterLink class="goals-page__create" to="/goals/new"><Plus :size="18" /> Nueva meta</RouterLink>
    </header>

    <p v-if="store.loading" class="goals-page__state" role="status">Cargando tus metas…</p>
    <section v-else-if="store.error" class="goals-page__state" role="alert">
      <strong>No pudimos abrir tus metas.</strong>
      <span>{{ store.error.message }}</span>
      <button type="button" @click="store.load().catch(() => {})">Intentar de nuevo</button>
    </section>
    <section v-else-if="visibleGoals.length === 0" class="goals-page__empty">
      <Target :size="28" aria-hidden="true" />
      <h2>Empieza con una sola dirección</h2>
      <p>No necesitas tener todo el plan. Define qué significa terminar y el primer movimiento.</p>
      <RouterLink class="goals-page__create" to="/goals/new"><Plus :size="18" /> Crear mi primera meta</RouterLink>
    </section>
    <section v-else class="goals-page__list" aria-label="Tus metas">
      <RouterLink v-for="goal in visibleGoals" :key="goal.id" class="goal-row" :to="`/goals/${goal.id}`">
        <span class="goal-row__status">{{ goal.focusRank !== null ? `Foco ${goal.focusRank + 1}` : statusLabel(goal.status) }}</span>
        <h2>{{ goal.title }}</h2>
        <p v-if="store.actionForGoal(goal.id)">{{ store.actionForGoal(goal.id).title }}</p>
        <p v-else>{{ goal.doneDefinition }}</p>
        <ArrowRight class="goal-row__arrow" :size="20" aria-hidden="true" />
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.goals-page { min-height: 100svh; padding: 48px clamp(20px, 5vw, 64px) 120px; color: var(--color-text); background: transparent; }
.goals-page__header { display: flex; max-width: 1120px; margin: 0 auto 42px; align-items: end; justify-content: space-between; gap: 24px; }
.goals-page__eyebrow { margin: 0 0 8px !important; color: var(--color-brand) !important; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(32px, 5vw, 48px); line-height: .95; letter-spacing: -.03em; }
.goals-page__header p { max-width: 52ch; margin: 16px 0 0; color: var(--color-text-muted); line-height: 1.55; }
.goals-page__create { display: inline-flex; min-height: 46px; flex: none; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; border-radius: var(--radius-full); color: var(--color-brand-contrast); background: var(--color-brand); font-weight: 800; text-decoration: none; }
.goals-page__list { display: grid; grid-template-columns: 1fr; max-width: 900px; margin: auto; border-top: 1px solid var(--color-border); }
.goal-row { position: relative; display: grid; min-width: 0; padding: 24px 52px 24px 0; border-bottom: 1px solid var(--color-border); color: inherit; text-decoration: none; transition: background var(--duration-base); }
.goal-row:hover { background: color-mix(in srgb, var(--action-primary) 7%, transparent); }
.goal-row__status { color: var(--color-brand); font-size: 11px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
.goal-row h2 { margin: 7px 0; font-size: clamp(19px, 2.4vw, 22px); letter-spacing: -.02em; overflow-wrap: anywhere; }
.goal-row p { margin: 0; color: var(--color-text-muted); overflow-wrap: anywhere; }
.goal-row__arrow { position: absolute; right: 8px; top: 50%; color: var(--color-text-faint); transform: translateY(-50%); }
.goals-page__empty, .goals-page__state { display: grid; max-width: 560px; margin: 11vh auto 0; justify-items: start; gap: 12px; }
.goals-page__empty > svg { color: var(--color-brand); }
.goals-page__empty h2 { margin: 0; font-size: 26px; }
.goals-page__empty p, .goals-page__state span { margin: 0 0 10px; color: var(--color-text-muted); line-height: 1.55; }
.goals-page__state button { min-height: 44px; padding: 0 16px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-full); color: var(--color-text); background: var(--color-surface); }
@media (max-width: 620px) { .goals-page { padding-top: 32px; } .goals-page__header { align-items: start; flex-direction: column; margin-bottom: 32px; } }

/* ══ TABLET+ (700px+): goal rows become cards in a multi-column grid
   instead of one full-width row list stretched down a narrow centered
   column — the space scales with content, not with viewport width. ══ */
@media (min-width: 700px) {
  .goals-page__list {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    max-width: 1120px;
    gap: var(--space-4);
    border-top: 0;
  }
  .goal-row {
    padding: var(--pad-card-lg);
    border: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .goal-row:hover { background: var(--color-surface); border-color: var(--border-accent); }
  .goal-row__arrow { top: var(--pad-card-lg); right: var(--pad-card-lg); transform: none; }
}
</style>
