<script setup>
import { computed, ref } from 'vue'
import { Cloud, LockKeyhole, SlidersHorizontal } from 'lucide-vue-next'
import {
  AuroraBottomSheet,
  AuroraButton,
  AuroraChip,
  AuroraEffortSelector,
  AuroraInput,
  AuroraSwitch,
} from '@components/aurora/index.js'
import { hasDailyCheckinContent } from '@/features/checkins/domain.js'

const props = defineProps({ checkin: { type: Object, default: null } })
const emit = defineEmits(['close', 'save', 'skip-always'])

const loadFeeling = ref(props.checkin?.loadFeeling ?? '')
const energy = ref(props.checkin?.energy ?? null)
const mood = ref(props.checkin?.mood ?? null)
const pressure = ref(props.checkin?.pressure ?? null)
const contextCodes = ref([...(props.checkin?.contextCodes ?? [])])
const note = ref(props.checkin?.note ?? '')
const syncScope = ref(props.checkin?.syncScope ?? 'local_only')
const showContext = ref(Boolean(
  mood.value
  || pressure.value
  || contextCodes.value.length
  || note.value
  || syncScope.value === 'cloud'
))

const loadLevels = [
  { value: 'light', label: 'Ligera', help: 'Hay espacio para respirar', color: 'var(--action-primary)' },
  { value: 'okay', label: 'Manejable', help: 'Se siente dentro de lo posible', color: 'var(--accent-focus)' },
  { value: 'heavy', label: 'Pesada', help: 'Conviene reducir expectativas', color: 'var(--status-warning)' },
]
const ratingLabels = ['Muy baja', 'Baja', 'Media', 'Buena', 'Alta']
const contextOptions = [
  { value: 'trabajo', label: 'Trabajo' },
  { value: 'familia', label: 'Familia' },
  { value: 'salud', label: 'Salud' },
  { value: 'sueño', label: 'Sueño' },
  { value: 'cambio', label: 'Cambio de rutina' },
]

const draft = computed(() => ({
  loadFeeling: loadFeeling.value || null,
  energy: energy.value,
  mood: mood.value,
  pressure: pressure.value,
  contextCodes: contextCodes.value,
  note: note.value,
  syncScope: syncScope.value,
}))
const canSave = computed(() => hasDailyCheckinContent(draft.value))
const privacyDescription = computed(() => {
  if (syncScope.value === 'local_only') return 'Se queda sólo en este dispositivo.'
  if (props.checkin?.syncStatus === 'synced') return 'La copia remota está sincronizada.'
  if (props.checkin?.syncStatus === 'error') return 'No se pudo sincronizar; el registro local sigue intacto.'
  return 'Se intentará sincronizar cuando haya conexión y sesión.'
})

function toggleRating(field, value) {
  const target = { energy, mood, pressure }[field]
  target.value = target.value === value ? null : value
}

function toggleContext(value) {
  contextCodes.value = contextCodes.value.includes(value)
    ? contextCodes.value.filter(code => code !== value)
    : [...contextCodes.value, value]
}

function save() {
  if (!canSave.value) return
  emit('save', draft.value)
}
</script>

<template>
  <AuroraBottomSheet open title="Check-in de hoy" @close="emit('close')">
    <form class="checkin" @submit.prevent="save">
      <p class="checkin__intro">Contesta sólo lo que te ayude. Nada de esto cambia si tu día “cuenta”.</p>

      <div class="checkin__field">
        <AuroraEffortSelector
          v-model="loadFeeling"
          label="¿Cómo se siente la carga?"
          :levels="loadLevels"
        />
        <button v-if="loadFeeling" class="checkin__clear" type="button" @click="loadFeeling = ''">Dejar sin indicar</button>
      </div>

      <fieldset class="checkin__rating">
        <legend>Energía <span>opcional</span></legend>
        <div class="checkin__rating-buttons">
          <button
            v-for="value in 5"
            :key="value"
            type="button"
            :class="{ 'is-selected': energy === value }"
            :aria-pressed="energy === value"
            :aria-label="`${value} de 5, energía ${ratingLabels[value - 1]}`"
            @click="toggleRating('energy', value)"
          >{{ value }}</button>
        </div>
        <p>{{ energy ? ratingLabels[energy - 1] : 'Sin indicar' }}</p>
      </fieldset>

      <button class="checkin__details-toggle" type="button" :aria-expanded="showContext" @click="showContext = !showContext">
        <SlidersHorizontal :size="17" aria-hidden="true" />
        {{ showContext ? 'Ocultar contexto adicional' : 'Añadir contexto o privacidad' }}
      </button>

      <div v-if="showContext" class="checkin__details">
        <fieldset class="checkin__rating">
          <legend>Ánimo <span>opcional</span></legend>
          <div class="checkin__rating-buttons">
            <button
              v-for="value in 5"
              :key="value"
              type="button"
              :class="{ 'is-selected': mood === value }"
              :aria-pressed="mood === value"
              :aria-label="`${value} de 5 para ánimo`"
              @click="toggleRating('mood', value)"
            >{{ value }}</button>
          </div>
        </fieldset>

        <fieldset class="checkin__rating">
          <legend>Presión <span>opcional</span></legend>
          <div class="checkin__rating-buttons">
            <button
              v-for="value in 5"
              :key="value"
              type="button"
              :class="{ 'is-selected': pressure === value }"
              :aria-pressed="pressure === value"
              :aria-label="`${value} de 5 para presión`"
              @click="toggleRating('pressure', value)"
            >{{ value }}</button>
          </div>
        </fieldset>

        <fieldset class="checkin__contexts">
          <legend>¿Algo influyó hoy?</legend>
          <div>
            <AuroraChip
              v-for="option in contextOptions"
              :key="option.value"
              :selected="contextCodes.includes(option.value)"
              @click="toggleContext(option.value)"
            >{{ option.label }}</AuroraChip>
          </div>
        </fieldset>

        <AuroraInput
          v-model="note"
          id="daily-checkin-note"
          label="Nota opcional"
          multiline
          :rows="3"
          hint="Máximo 500 caracteres."
          placeholder="Algo que quieras recordar, sin justificarte."
        />

        <div class="checkin__privacy">
          <component :is="syncScope === 'cloud' ? Cloud : LockKeyhole" :size="19" aria-hidden="true" />
          <AuroraSwitch
            :model-value="syncScope === 'cloud'"
            label="Sincronizar este check-in"
            :description="privacyDescription"
            @update:model-value="syncScope = $event ? 'cloud' : 'local_only'"
          />
        </div>
      </div>

      <p v-else class="checkin__privacy-note">
        <LockKeyhole :size="16" aria-hidden="true" />
        Se guardará sólo en este dispositivo.
      </p>

      <div class="checkin__actions">
        <AuroraButton variant="ghost" @click="emit('skip-always')">Omitir siempre</AuroraButton>
        <AuroraButton variant="ghost" @click="emit('close')">Ahora no</AuroraButton>
        <AuroraButton type="submit" variant="primary" :disabled="!canSave">Guardar check-in</AuroraButton>
      </div>
    </form>
  </AuroraBottomSheet>
</template>

<style scoped>
.checkin{display:flex;flex-direction:column;gap:22px}
.checkin__intro{max-width:62ch;margin:0;color:var(--text-secondary);font:400 14px/1.55 var(--font-core);text-wrap:pretty}
.checkin__field{display:grid;gap:4px}
.checkin__clear{justify-self:start;min-height:36px;padding:0;border:0;background:transparent;color:var(--text-muted);font:600 12px var(--font-core);cursor:pointer}
.checkin__rating{display:grid;gap:9px;margin:0;padding:0;border:0}
.checkin__rating legend,.checkin__contexts legend{color:var(--text-primary);font:600 15px/1.35 var(--font-core)}
.checkin__rating legend span{color:var(--text-muted);font-size:var(--text-xs);font-weight:400}
.checkin__rating-buttons{display:grid;grid-template-columns:repeat(5,minmax(42px,1fr));gap:7px}
.checkin__rating-buttons button{min-height:44px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:var(--surface-primary);color:var(--text-secondary);font:600 14px var(--font-numeric);cursor:pointer}
.checkin__rating-buttons button.is-selected{border-color:var(--border-accent);background:color-mix(in srgb,var(--action-primary) 14%,var(--surface-primary));color:var(--action-primary)}
.checkin__rating p{margin:0;color:var(--text-muted);font:400 12px/1.4 var(--font-core)}
.checkin__details-toggle{display:flex;min-height:44px;padding:0;align-items:center;gap:8px;border:0;border-block:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);font:600 13px var(--font-core);cursor:pointer}
.checkin__details{display:flex;flex-direction:column;gap:22px}
.checkin__contexts{display:grid;gap:10px;margin:0;padding:0;border:0}
.checkin__contexts>div{display:flex;flex-wrap:wrap;gap:8px}
.checkin__privacy{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:12px;padding:14px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);color:var(--text-muted)}
.checkin__privacy-note{display:flex;align-items:center;gap:8px;margin:0;color:var(--text-muted);font:400 12px/1.4 var(--font-core)}
.checkin__actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;padding-top:4px}
@media(max-width:420px){.checkin__actions{align-items:stretch;flex-direction:column-reverse}.checkin__actions :deep(.a-button){width:100%}}
</style>
