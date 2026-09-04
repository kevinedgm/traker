<script setup>
const props=defineProps({days:{default:()=>[]},weekStart:{default:0},selected:Number})
defineEmits(['select'])
const week=['L','M','M','J','V','S','D']
const fills={
  complete:{bg:'var(--progress-complete)',fg:'var(--action-primary-fg)'},
  partial:{bg:'color-mix(in srgb,var(--progress-complete) 42%,transparent)',fg:'var(--text-primary)'},
  adapted:{bg:'color-mix(in srgb,var(--progress-adapted) 55%,transparent)',fg:'var(--text-primary)'},
  resumed:{bg:'color-mix(in srgb,var(--progress-resumed) 55%,transparent)',fg:'var(--text-primary)'},
  paused:{bg:'color-mix(in srgb,var(--progress-paused) 22%,transparent)',fg:'var(--text-secondary)'},
  postponed:{bg:'color-mix(in srgb,var(--accent-focus) 20%,transparent)',fg:'var(--text-secondary)'},
  skipped:{bg:'transparent',fg:'var(--text-muted)',dashed:true},
  none:{bg:'var(--progress-none)',fg:'var(--text-muted)'},
  pending:{bg:'var(--progress-none)',fg:'var(--text-secondary)'},
  started:{bg:'var(--progress-none)',fg:'var(--text-primary)',ring:true},
}
const names={complete:'completado',partial:'completado en parte',adapted:'adaptado',resumed:'retomado',paused:'pausado',postponed:'pospuesto',skipped:'omitido a propósito',none:'sin registro',pending:'pendiente',started:'iniciado'}
function skin(day){return fills[day.state]||fills.none}
function label(day){return `Día ${day.day}${day.today?', hoy':''}, ${names[day.state]||'sin registro'}`}
</script>
<template>
  <div class="calendar">
    <div class="calendar__week"><span v-for="(day,index) in week" :key="index">{{day}}</span></div>
    <div class="calendar__grid" role="grid">
      <span v-for="index in props.weekStart" :key="`blank-${index}`"/>
      <button
        v-for="day in days"
        :key="day.day"
        type="button"
        :disabled="day.future"
        :aria-label="label(day)"
        :aria-pressed="selected===day.day"
        :class="{today:day.today,selected:selected===day.day,dashed:skin(day).dashed,ring:skin(day).ring}"
        :style="{'--bg':skin(day).bg,'--fg':skin(day).fg}"
        @click="$emit('select',day.day)"
      >{{day.day}}</button>
    </div>
  </div>
</template>
<style scoped>
.calendar{display:flex;flex-direction:column;gap:10px}
.calendar__week,.calendar__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.calendar__week span{color:var(--text-muted);font:600 11px/1 var(--font-core);letter-spacing:.04em;text-align:center}
button{min-height:40px;padding:0;aspect-ratio:1;border:1px solid var(--border-subtle);border-radius:var(--radius-md);outline:none;background:var(--bg);color:var(--fg);font:500 14px/1 var(--font-numeric);font-variant-numeric:tabular-nums;cursor:pointer;transition:background var(--dur-base) var(--ease-calm),border-color var(--dur-base) var(--ease-calm)}
button.today{border:2px solid var(--action-primary)}
button.ring:not(.today){border:1.5px solid var(--border-accent)}
button.dashed:not(.today){border:1.5px dashed var(--border-strong)}
button.selected{outline:2px solid var(--focus-ring);outline-offset:2px}
button:disabled{opacity:.32;cursor:default}
</style>
