<script setup>
import { computed, ref, useId, watch } from 'vue'
import AuroraButton from '@components/aurora/core/AuroraButton.vue'
import AuroraModal from '@components/aurora/surfaces/AuroraModal.vue'

const props = defineProps({
  open: Boolean,
  busy: Boolean,
  email: { type: String, default: '' },
  error: { type: String, default: '' },
})
const emit = defineEmits(['cancel', 'confirm', 'export'])
const confirmation = ref('')
const password = ref('')
const confirmationId = useId()
const passwordId = useId()
const passwordHintId = useId()
const errorId = useId()
const canDelete = computed(() => confirmation.value === 'BORRAR' && !props.busy)

watch(() => props.open, open => {
  if (!open) return
  confirmation.value = ''
  password.value = ''
})

function submit() {
  if (!canDelete.value) return
  emit('confirm', { confirmation: confirmation.value, password: password.value })
}
</script>

<template>
  <AuroraModal :open="open" title="Borrar cuenta y nube" :width="500" alert @close="!busy && emit('cancel')">
    <form class="delete-account" @submit.prevent="submit">
      <p>Esta acción elimina permanentemente la cuenta{{ email ? ` ${email}` : '' }} y sus datos sincronizados.</p>
      <ul>
        <li>Cuenta, sesiones y tokens de acceso.</li>
        <li>Hábitos, metas, registros, recompensas, consentimientos y sincronización.</li>
        <li>Suscripciones, entregas de notificaciones y datos de este dispositivo.</li>
      </ul>

      <AuroraButton type="button" variant="secondary" :disabled="busy" @click="emit('export')">
        Descargar respaldo primero
      </AuroraButton>

      <label :for="passwordId">Contraseña actual <span>(si usas contraseña)</span></label>
      <input
        :id="passwordId"
        v-model="password"
        type="password"
        autocomplete="current-password"
        :aria-describedby="passwordHintId"
        :disabled="busy"
        placeholder="Déjala vacía si acabas de iniciar sesión"
      />
      <small :id="passwordHintId">Una sesión iniciada hace más de 10 minutos debe validarse de nuevo. Si usas enlace mágico, sal y vuelve a entrar.</small>

      <label :for="confirmationId">Escribe <strong>BORRAR</strong> para confirmar</label>
      <input
        :id="confirmationId"
        v-model="confirmation"
        data-modal-initial-focus
        type="text"
        autocomplete="off"
        autocapitalize="characters"
        maxlength="6"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? errorId : undefined"
        :disabled="busy"
        placeholder="BORRAR"
      />
      <p v-if="error" :id="errorId" class="delete-account__error" role="alert">{{ error }}</p>
    </form>

    <template #footer>
      <AuroraButton variant="ghost" :disabled="busy" @click="emit('cancel')">Cancelar</AuroraButton>
      <AuroraButton variant="danger" :disabled="!canDelete" :aria-busy="busy" @click="submit">
        {{ busy ? 'Borrando cuenta…' : 'Borrar para siempre' }}
      </AuroraButton>
    </template>
  </AuroraModal>
</template>

<style scoped>
.delete-account{display:grid;min-width:0;gap:12px;color:var(--text-secondary);font:400 14px/1.5 var(--font-core)}
.delete-account p,.delete-account ul{margin:0}.delete-account ul{padding-left:20px}
.delete-account p,.delete-account li,.delete-account small{overflow-wrap:anywhere}
.delete-account label{color:var(--text-primary);font-weight:600}.delete-account label span,.delete-account small{color:var(--text-muted);font-weight:400}
.delete-account input{box-sizing:border-box;width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:var(--surface-primary);color:var(--text-primary);font:400 16px/1.4 var(--font-core)}
.delete-account input:focus-visible{outline:2px solid var(--action-primary);outline-offset:2px}
.delete-account__error{color:var(--status-danger);font-weight:600}
</style>
