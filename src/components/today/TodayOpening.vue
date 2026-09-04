<script setup>
defineProps({
  opening: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <section
    class="today-opening"
    aria-label="Mensaje de apertura"
    :data-source-type="opening.sourceType"
    :data-catalog-version="opening.catalogVersion"
  >
    <div class="today-opening__message">
      <div>
        <h2>{{ opening.title }}</h2>
        <blockquote v-if="opening.sourceType === 'quote'">{{ opening.body }}</blockquote>
        <p v-else>{{ opening.body }}</p>
      </div>

      <footer>
        <a
          v-if="opening.sourceType === 'quote' && opening.attribution"
          :href="opening.attribution.source"
          target="_blank"
          rel="noreferrer"
        >
          {{ opening.attribution.author }} · <cite>{{ opening.attribution.work }}</cite>
        </a>
        <span v-else>{{ opening.sourceLabel }}</span>
      </footer>
    </div>

    <div v-if="opening.personalContext" class="today-opening__personal">
      <span>{{ opening.personalContext.sourceLabel }}</span>
      <p>{{ opening.personalContext.text }}</p>
    </div>
  </section>
</template>

<style scoped>
.today-opening{display:grid;max-width:720px;padding:18px 0;gap:16px;border-block:1px solid var(--border-subtle)}
.today-opening__message{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:16px}
.today-opening h2{margin:0;color:var(--text-primary);font:500 19px/1.25 var(--font-editorial);letter-spacing:-.01em}
.today-opening blockquote,.today-opening__message p{display:-webkit-box;margin:4px 0 0;overflow:hidden;color:var(--text-secondary);font:400 14px/1.45 var(--font-core);text-wrap:pretty;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.today-opening footer{align-self:end;color:var(--text-muted);font:500 11px/1.3 var(--font-core);white-space:nowrap}
.today-opening footer a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}
.today-opening__personal{display:grid;padding-top:14px;grid-template-columns:84px minmax(0,1fr);gap:12px;border-top:1px solid var(--border-subtle)}
.today-opening__personal span{color:var(--action-primary);font:600 11px/1.4 var(--font-core);letter-spacing:.04em;text-transform:uppercase}
.today-opening__personal p{margin:0;color:var(--text-secondary);font:400 13px/1.5 var(--font-core);overflow-wrap:anywhere}
@media(max-width:520px){.today-opening__message{grid-template-columns:1fr}.today-opening footer{justify-self:start}.today-opening__personal{grid-template-columns:1fr;gap:4px}}
</style>
