<script setup>
import { useId } from 'vue'
import { ArrowRight, CircleDot, Play } from 'lucide-vue-next'

defineProps({
  goal: { type: Object, required: true },
  action: { type: Object, required: true },
  running: { type: Boolean, default: false },
})
const titleId = useId()
</script>

<template>
  <section class="today-goal" :aria-labelledby="titleId">
    <div class="today-goal__context">
      <span><CircleDot :size="14" aria-hidden="true" /> Meta de hoy</span>
      <RouterLink :to="`/goals/${goal.id}`">{{ goal.title }}</RouterLink>
    </div>
    <h2 :id="titleId">{{ action.title }}</h2>
    <p v-if="running">Tu sesión sigue activa. El tiempo se conservó.</p>
    <p v-else-if="action.status === 'blocked'">Este paso necesita una versión más viable.</p>
    <p v-else>{{ action.minimumVersion || 'Un bloque pequeño es suficiente para moverla.' }}</p>
    <RouterLink class="today-goal__action" :to="action.status === 'blocked' ? `/goals/${goal.id}` : `/goals/${goal.id}/session`">
      <Play v-if="action.status !== 'blocked'" :size="18" aria-hidden="true" />
      {{ running ? 'Continuar sesión' : action.status === 'blocked' ? 'Adaptar el paso' : 'Empezar ahora' }}
      <ArrowRight :size="17" aria-hidden="true" />
    </RouterLink>
  </section>
</template>

<style scoped>
.today-goal { position: relative; padding-block: var(--space-6); border-block: 1px solid var(--border-strong); overflow: hidden; container-type: inline-size; }
.today-goal::after { position: absolute; right: -70px; bottom: -110px; width: 210px; height: 210px; border-radius: 50%; content: ''; pointer-events: none; background: color-mix(in srgb, var(--accent-focus) 8%, transparent); filter: blur(2px); }
.today-goal__context { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.today-goal__context span { display: inline-flex; align-items: center; gap: 6px; color: var(--action-primary); font: var(--caption-weight) var(--caption-size)/var(--caption-line) var(--font-core); letter-spacing: var(--caption-track); text-transform: uppercase; }
.today-goal__context a { max-width: 48%; overflow: hidden; color: var(--text-muted); font: var(--label-weight) var(--label-size)/var(--label-line) var(--font-core); text-align: end; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.today-goal h2 { position: relative; z-index: 1; max-width: 17ch; margin: var(--space-5) 0 var(--space-2); color: var(--text-primary); font: var(--h1-weight) var(--h1-size)/var(--h1-line) var(--font-core); letter-spacing: var(--h1-track); text-wrap: balance; overflow-wrap: break-word; hyphens: auto; }
.today-goal > p { position: relative; z-index: 1; max-width: 48ch; margin: 0; color: var(--text-secondary); font: var(--body-weight) var(--body-size)/var(--body-line) var(--font-core); text-wrap: pretty; }
.today-goal__action { position: relative; z-index: 1; display: inline-flex; min-height: 48px; margin-top: var(--space-5); align-items: center; justify-content: center; gap: var(--space-2); padding-inline: var(--space-5); border-radius: var(--radius-pill); color: var(--action-primary-fg); background: var(--action-primary); font: var(--label-weight) var(--label-size)/1 var(--font-core); text-decoration: none; }
.today-goal__action svg:last-child { transition: transform var(--duration-base) var(--ease-standard); }
.today-goal__action:hover svg:last-child { transform: translateX(3px); }
@container (max-width: 420px) { .today-goal__context { align-items: flex-start; flex-direction: column; gap: var(--space-2); } .today-goal__context a { max-width: 100%; text-align: start; } .today-goal__action { width: 100%; box-sizing: border-box; } }
</style>
