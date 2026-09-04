<script setup>
import { computed, ref, watch } from 'vue'
import { Gift, HeartPulse } from 'lucide-vue-next'
import { AuroraBottomSheet, AuroraButton, AuroraInput } from '@components/aurora/index.js'
import { closureCopy } from '@/features/today/domain.js'

const props = defineProps({
  summary: { type: Object, required: true },
  closure: { type: Object, default: null },
  canUpdate: { type: Boolean, default: false },
  unlockedClaims: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'confirm', 'checkin'])
const tomorrowNote = ref(props.closure?.tomorrowNote ?? '')
const copy = computed(() => closureCopy(props.summary))

watch(() => props.closure?.tomorrowNote, value => {
  if (typeof value === 'string') tomorrowNote.value = value
})

function confirm() {
  emit('confirm', { tomorrowNote: tomorrowNote.value })
}
</script>

<template>
  <AuroraBottomSheet open :title="closure ? 'Cierre guardado' : 'Cerrar por hoy'" @close="emit('close')">
    <div class="day-close">
      <div class="day-close__message" role="status">
        <h2>{{ copy.title }}</h2>
        <p>{{ copy.body }}</p>
      </div>

      <dl class="day-close__summary" aria-label="Resumen del día">
        <div>
          <dt>Con movimiento</dt>
          <dd>{{ summary.built }}</dd>
        </div>
        <div>
          <dt>Versiones mínimas o adaptadas</dt>
          <dd>{{ summary.adapted }}</dd>
        </div>
        <div>
          <dt>Versiones completas</dt>
          <dd>{{ summary.complete }}</dd>
        </div>
      </dl>

      <section v-if="summary.flexibleGroups?.length" class="day-close__flexible" aria-labelledby="day-close-flexible-title">
        <h3 id="day-close-flexible-title">Opciones del periodo</h3>
        <ul>
          <li v-for="group in summary.flexibleGroups" :key="group.id">
            <span>{{ group.name }}</span>
            <strong>{{ group.built }} de {{ group.minimum }} · {{ group.isMinimumMet ? 'mínimo cubierto' : 'sin deuda diaria' }}</strong>
          </li>
        </ul>
      </section>

      <section v-if="unlockedClaims.length" class="day-close__rewards" aria-labelledby="day-close-rewards-title">
        <Gift :size="20" aria-hidden="true" />
        <div>
          <h3 id="day-close-rewards-title">Se desbloqueó {{ unlockedClaims.length === 1 ? 'una recompensa' : `${unlockedClaims.length} recompensas` }}</h3>
          <p>{{ unlockedClaims.map(claim => claim.rewardName).join(' · ') }}. Queda guardada y no vence.</p>
        </div>
      </section>

      <p v-if="closure && canUpdate" class="day-close__changed" role="status">Hay registros nuevos desde este cierre. Puedes actualizar el resumen sin convertir nada en deuda.</p>

      <AuroraInput
        v-if="!closure"
        v-model="tomorrowNote"
        id="day-close-tomorrow-note"
        label="Una nota para mañana"
        multiline
        :rows="2"
        hint="Opcional. No se convierte en pendiente."
        placeholder="Algo pequeño que quieras recordar."
      />

      <button v-if="!closure" class="day-close__checkin" type="button" @click="emit('checkin')">
        <HeartPulse :size="18" aria-hidden="true" />
        Añadir carga o energía opcional
      </button>

      <div class="day-close__actions">
        <AuroraButton v-if="!closure" variant="ghost" @click="emit('close')">Ahora no</AuroraButton>
        <AuroraButton v-if="!closure" variant="primary" @click="confirm">Cerrar por hoy</AuroraButton>
        <AuroraButton v-if="closure && canUpdate" variant="ghost" @click="emit('close')">Conservar cierre</AuroraButton>
        <AuroraButton v-if="closure && canUpdate" variant="primary" @click="confirm">Actualizar cierre</AuroraButton>
        <AuroraButton v-if="closure && !canUpdate" variant="primary" @click="emit('close')">Listo</AuroraButton>
      </div>
    </div>
  </AuroraBottomSheet>
</template>

<style scoped>
.day-close{display:flex;flex-direction:column;gap:22px}
.day-close__message{max-width:65ch}
.day-close__message h2{margin:0;color:var(--text-primary);font:500 24px/1.25 var(--font-editorial);letter-spacing:-.015em;text-wrap:balance}
.day-close__message p{margin:8px 0 0;color:var(--text-secondary);font:400 14px/1.55 var(--font-core);text-wrap:pretty}
.day-close__summary{display:grid;margin:0;border-block:1px solid var(--border-subtle)}
.day-close__summary div{display:flex;min-height:46px;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--border-subtle)}
.day-close__summary div:last-child{border-bottom:0}
.day-close__summary dt{color:var(--text-secondary);font:400 13px/1.4 var(--font-core)}
.day-close__summary dd{margin:0;color:var(--text-primary);font:600 15px/1 var(--font-numeric)}
.day-close__flexible h3{margin:0;color:var(--text-primary);font:600 14px/1.4 var(--font-core)}.day-close__flexible ul{margin:8px 0 0;padding:0;border-block:1px solid var(--border-subtle);list-style:none}.day-close__flexible li{display:flex;min-height:44px;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--border-subtle);color:var(--text-secondary);font:400 13px/1.4 var(--font-core)}.day-close__flexible li:last-child{border-bottom:0}.day-close__flexible strong{color:var(--text-muted);font:600 12px/1.3 var(--font-core);text-align:end}
.day-close__rewards{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;padding:14px 0;border-block:1px solid var(--border-accent);color:var(--accent-return)}
.day-close__rewards h3{margin:0;color:var(--text-primary);font:600 14px/1.4 var(--font-core)}
.day-close__rewards p{margin:3px 0 0;color:var(--text-secondary);font:400 13px/1.45 var(--font-core)}
.day-close__checkin{display:flex;min-height:44px;align-items:center;gap:9px;padding:0;border:0;border-block:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);font:600 13px/1.4 var(--font-core);cursor:pointer}
.day-close__checkin:hover{color:var(--text-primary)}
.day-close__changed{margin:0;padding-block:12px;border-block:1px solid var(--border-subtle);color:var(--text-secondary);font:400 13px/1.5 var(--font-core)}
.day-close__actions{display:flex;justify-content:flex-end;gap:8px}
@media(max-width:420px){.day-close__actions{align-items:stretch;flex-direction:column-reverse}.day-close__actions :deep(.a-button){width:100%}}
</style>
