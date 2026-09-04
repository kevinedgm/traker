<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'

defineProps({
  questions:{default:()=>['¿Cómo agrego un hábito nuevo?','¿Cómo registro lo que hice hoy?','¿Cómo pauso o retomo un hábito?','¿Por qué no llegan mis recordatorios?']},
  label:{default:'Haz clic si necesitas ayuda'},
})
const emit=defineEmits(['select'])
const open=ref(false)
const root=ref(null)
const trigger=ref(null)
const panelId=`${useId()}-help-options`
const mascotUrl=`${import.meta.env.BASE_URL}brand/help-mascot.webp`
function closeOutside(event){if(open.value&&root.value&&!root.value.contains(event.target))open.value=false}
function closeKey(event){if(event.key==='Escape'&&open.value){open.value=false;nextTick(()=>trigger.value?.focus())}}
function toggle(){open.value=!open.value}
function select(question){open.value=false;emit('select',question)}
onMounted(()=>{document.addEventListener('pointerdown',closeOutside);document.addEventListener('keydown',closeKey)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeKey)})
</script>
<template>
  <div ref="root" class="help-mascot-wrap">
    <button ref="trigger" type="button" class="help-mascot-btn" aria-label="Ayuda" :aria-controls="panelId" :aria-expanded="open" @click="toggle">
      <span class="help-mascot-glow" aria-hidden="true"/><span class="help-mascot-ring" aria-hidden="true"/><span class="help-mascot-ping" aria-hidden="true"/>
      <span class="help-mascot-tooltip aurora-glass">{{label}}</span>
      <span class="help-mascot-float"><img class="help-mascot-img" :src="mascotUrl" alt=""><span class="help-mascot-blink" aria-hidden="true"/><span class="help-mascot-hand" aria-hidden="true"><img :src="mascotUrl" alt=""></span></span>
    </button>
    <Transition name="help-menu"><div v-if="open" :id="panelId" class="help-mascot-menu aurora-glass" role="region" aria-label="Opciones de ayuda"><span class="help-mascot-menu-title">¿En qué te ayudamos?</span><button v-for="question in questions" :key="question" type="button" class="help-mascot-menu-item" @click="select(question)">{{question}}</button></div></Transition>
  </div>
</template>
<style scoped>
/* impeccable-disable design-system-color -- colores internos de la ilustración y su máscara, tomados del Help Button.html aprobado */
.help-mascot-wrap{position:fixed;z-index:66;right:14px;bottom:88px}
.help-mascot-btn{position:relative;display:grid;width:76px;height:76px;padding:0;place-items:center;border:0;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent}
.help-mascot-glow{position:absolute;inset:10px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent-focus) 32%,transparent) 0%,transparent 70%);filter:blur(7px);opacity:.62}
.help-mascot-ring{position:absolute;inset:2px;border:1.5px solid color-mix(in srgb,var(--accent-focus) 45%,transparent);border-radius:50%}
.help-mascot-ping{position:absolute;top:8px;right:14px;width:8px;height:8px;border-radius:50%;background:var(--accent-focus)}
.help-mascot-ping::after{position:absolute;inset:0;border-radius:50%;background:var(--accent-focus);content:'';opacity:.42;transform:scale(1.65)}
.help-mascot-float{position:relative;display:inline-block}
.help-mascot-img{display:block;width:80px;height:auto;filter:drop-shadow(0 10px 16px rgba(6,10,9,.5));transition:transform 140ms var(--ease-calm)}
.help-mascot-blink{position:absolute;top:31.7%;left:35.2%;width:15%;height:22%;border-radius:50%;background:rgba(146,214,150,.95);filter:blur(1.2px);transform:scaleY(.05);transform-origin:50% 0}
.help-mascot-hand{position:absolute;inset:0;width:100%;height:100%;mask-image:radial-gradient(ellipse 12% 13.5% at 72.5% 56%,#000 55%,transparent 100%);transform-origin:65.8% 66.4%}
.help-mascot-hand img{display:block;width:100%;height:auto}
.help-mascot-tooltip{position:absolute;top:50%;right:86px;padding:7px 14px;border-radius:var(--radius-pill);color:var(--text-primary);font:600 13px/1 var(--font-core);pointer-events:none;transform:translateY(-50%);transition:opacity 140ms var(--ease-calm),transform 140ms var(--ease-calm);white-space:nowrap;opacity:0}
.help-mascot-btn:hover .help-mascot-tooltip,.help-mascot-btn:focus-visible .help-mascot-tooltip{opacity:1;transform:translateY(-50%) translateX(-3px)}
.help-mascot-btn:hover .help-mascot-img{transform:scale(1.06)}.help-mascot-btn:active .help-mascot-img{transform:scale(.95)}
.help-mascot-menu{position:absolute;z-index:67;right:0;bottom:calc(100% + 14px);display:flex;width:250px;padding:8px;flex-direction:column;gap:2px;border-radius:var(--radius-lg);box-shadow:var(--elev-3)}
.help-mascot-menu-title{padding:8px 10px 4px;color:var(--text-muted);font:600 11px/1 var(--font-core);letter-spacing:.06em;text-transform:uppercase}
.help-mascot-menu-item{display:flex;min-height:44px;padding:0 10px;align-items:center;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--text-primary);font:500 14px/1.35 var(--font-core);text-align:left;cursor:pointer;transition:background 140ms var(--ease-calm)}
.help-mascot-menu-item:hover{background:color-mix(in srgb,var(--action-primary) 10%,transparent)}
.help-menu-enter-active,.help-menu-leave-active{transition:opacity 220ms var(--ease-enter),transform 220ms var(--ease-enter)}.help-menu-enter-from,.help-menu-leave-to{opacity:0;transform:translateY(6px) scale(.98)}
@media(max-height:480px){.help-mascot-wrap{display:none}}
@media(min-width:768px){.help-mascot-wrap{right:24px;bottom:24px}}
@media(prefers-reduced-motion:reduce){.help-menu-enter-active,.help-menu-leave-active{transition-duration:1ms}.help-menu-enter-from,.help-menu-leave-to{transform:none}}
</style>
