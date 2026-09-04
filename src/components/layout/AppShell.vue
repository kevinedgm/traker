<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Gift, History, House, ListChecks, Settings, Target } from 'lucide-vue-next'
import { features } from '@/config/features.js'
import CreateHabitModal from '@components/habits/CreateHabitModal.vue'
import HelpMascotButton from '@components/help/HelpMascotButton.vue'
import { AuroraBottomNav, AuroraIconButton, AuroraOfflineState } from '@components/aurora/index.js'

const route = useRoute()
const router = useRouter()
const showCreate = ref(false)
const online = ref(typeof navigator === 'undefined' || navigator.onLine !== false)
const logoUrl = `${import.meta.env.BASE_URL}brand/koto-logo.svg`

function updateOnlineState() {
  online.value = navigator.onLine !== false
}

onMounted(() => {
  window.addEventListener('online', updateOnlineState)
  window.addEventListener('offline', updateOnlineState)
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineState)
  window.removeEventListener('offline', updateOnlineState)
})

const hideSidebar = computed(() => route.meta?.hideSidebar === true)
const hideBottomNav = computed(() => route.meta?.hideNav === true)
const activeValue = computed(() => {
  if (route.path.startsWith('/goals')) return 'direction'
  if (route.path.startsWith('/habit')) return 'habits'
  if (route.path.startsWith('/rewards')) return 'rewards'
  if (route.path.startsWith('/progress')) return 'history'
  if (route.path.startsWith('/settings')) return 'settings'
  return route.path === '/' ? 'home' : ''
})
const showHelp = computed(() => ['home', 'history', 'settings'].includes(activeValue.value))
const navItems = computed(() => [
  { value: 'home', label: 'Hoy', icon: House, path: '/' },
  ...(features.goals ? [{ value: 'direction', label: 'Rumbo', icon: Target, path: '/goals' }] : []),
  { value: 'habits', label: 'Hábitos', icon: ListChecks, path: '/habits' },
  { value: 'rewards', label: 'Recompensas', shortLabel: 'Premios', icon: Gift, path: '/rewards' },
  { value: 'history', label: 'Historial', icon: History, path: '/progress' },
])

function selectNav(value) {
  const item = navItems.value.find(entry => entry.value === value)
  if (!item) return
  if (item.path && route.path !== item.path) router.push(item.path)
}
function handleHelp(question) {
  if (question.includes('agrego')) showCreate.value = true
  else if (question.includes('registro')) router.push('/')
  else if (question.includes('pauso')) router.push('/habits')
  else if (question.includes('recordatorios')) router.push('/settings/notifications')
}
</script>

<template>
  <div class="shell aurora-ambient" :class="{ 'shell--no-sidebar': hideSidebar }">
    <aside v-if="!hideSidebar" class="shell__rail" aria-label="Navegación principal">
      <button class="shell__logo" type="button" aria-label="Ir a Inicio" @click="selectNav('home')"><span class="shell__logo-mark" :style="{ '--shell-logo': `url(${logoUrl})` }" aria-hidden="true" /></button>
      <nav class="shell__rail-nav" aria-label="Menú principal">
        <AuroraIconButton
          v-for="item in navItems"
          :key="item.value"
          :label="item.label"
          :active="activeValue === item.value"
          variant="quiet"
          @click="selectNav(item.value)"
        >
          <component :is="item.icon" :size="20" :stroke-width="1.75" aria-hidden="true" />
        </AuroraIconButton>
      </nav>
      <div class="shell__rail-utility">
        <AuroraIconButton
          label="Ajustes"
          :active="activeValue === 'settings'"
          variant="quiet"
          @click="router.push('/settings')"
        >
          <Settings :size="20" :stroke-width="1.75" aria-hidden="true" />
        </AuroraIconButton>
      </div>
    </aside>

    <div v-if="!online" class="shell__offline">
      <AuroraOfflineState @retry="updateOnlineState" />
    </div>

    <div class="shell__content"><slot /></div>

    <div v-if="!hideBottomNav" class="shell__bottom-wrap">
      <AuroraBottomNav :model-value="activeValue" :items="navItems" @update:model-value="selectNav" />
    </div>

    <HelpMascotButton v-if="showHelp" @select="handleHelp" />

    <CreateHabitModal v-if="showCreate" @close="showCreate = false" />
  </div>
</template>

<style scoped>
.shell { position:relative; display:flex; min-height:100svh; color:var(--text-primary); }
.shell__rail { position:fixed; z-index:50; inset:0 auto 0 0; display:none; width:76px; padding:20px 0; flex-direction:column; align-items:center; border-right:1px solid var(--border-subtle); background:transparent; }
.shell__logo { display:grid; width:36px; height:36px; margin:0 0 16px; padding:0; place-items:center; border:0; border-radius:var(--radius-pill); background:var(--text-primary); cursor:pointer; }
.shell__logo-mark { width:25px; height:21px; background:var(--background-base); mask:var(--shell-logo) center/contain no-repeat; -webkit-mask:var(--shell-logo) center/contain no-repeat; }
.shell__logo:active { transform:scale(var(--press-scale)); }
.shell__rail-nav { display:flex; width:100%; flex-direction:column; align-items:center; gap:6px; }
.shell__rail-utility { display:flex; width:100%; margin-top:auto; justify-content:center; }
.shell__content { width:100%; min-width:0; min-height:100svh; }
.shell__offline { position:fixed; z-index:70; top:max(12px,var(--safe-top)); right:16px; left:16px; width:min(calc(100% - 32px),620px); margin-inline:auto; }
.shell__bottom-wrap { position:fixed; z-index:60; right:16px; bottom:max(16px,var(--safe-bottom)); left:16px; width:min(calc(100% - 32px),420px); margin-inline:auto; }
.shell__bottom-wrap :deep(.nav) { width:100%; }
.shell--no-sidebar .shell__content { margin-left:0 !important; }
@media (min-width:768px) {
  .shell__rail { display:flex; }
  .shell__content { margin-left:76px; }
  .shell__offline { left:92px; }
  .shell__bottom-wrap { display:none; }
}
</style>
