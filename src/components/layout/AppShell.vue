<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore }  from '@stores/app'
import { useAuthStore } from '@stores/auth'

const route     = useRoute()
const router    = useRouter()
const appStore  = useAppStore()
const authStore = useAuthStore()

// La sidebar de escritorio se oculta SOLO en páginas especiales (lock, onboarding)
const hideSidebar = computed(() => route.meta?.hideSidebar === true)

// El pill nav móvil se oculta cuando la página tiene su propio header nav (habit detail en móvil)
const hidePillNav = computed(() => route.meta?.hideNav === true)

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function go(path) { router.push(path) }
</script>

<template>
  <div class="shell" :class="{ 'shell--no-sidebar': hideSidebar }">

    <!-- ══════════════════════════════════════════════════════
         SIDEBAR — visible en tablet (íconos) y desktop (íconos + texto)
         Oculto en mobile (usa pill nav en su lugar)
         ══════════════════════════════════════════════════════ -->
    <aside
      v-if="!hideSidebar"
      class="shell__sidebar"
      aria-label="Navegación principal"
    >
      <!-- Logo -->
      <div class="shell__logo">
        <span class="shell__logo-mark" aria-hidden="true">◆</span>
        <span class="shell__logo-text">TRAKER</span>
      </div>

      <!-- Nav items -->
      <nav class="shell__nav" aria-label="Menú principal">

        <button
          class="shell__nav-btn"
          type="button"
          :class="{ 'shell__nav-btn--active': isActive('/') }"
          aria-label="Hoy"
          :aria-current="isActive('/') ? 'page' : undefined"
          @click="go('/')"
        >
          <span class="shell__nav-icon-wrap" aria-hidden="true">
            <svg class="shell__nav-icon" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.8"/>
              <path d="M3 9h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <circle cx="8.5" cy="14" r="1.25" fill="currentColor"/>
              <circle cx="12"  cy="14" r="1.25" fill="currentColor"/>
              <circle cx="15.5" cy="14" r="1.25" fill="currentColor"/>
            </svg>
          </span>
          <span class="shell__nav-label">Hoy</span>
        </button>

        <button
          class="shell__nav-btn"
          type="button"
          :class="{ 'shell__nav-btn--active': isActive('/progress') }"
          aria-label="Progreso"
          :aria-current="isActive('/progress') ? 'page' : undefined"
          @click="go('/progress')"
        >
          <span class="shell__nav-icon-wrap" aria-hidden="true">
            <svg class="shell__nav-icon" viewBox="0 0 24 24" fill="none">
              <path d="M4 19V13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M9 19V9"  stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M14 19V14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M19 19V5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M3 19h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="shell__nav-label">Progreso</span>
        </button>

        <button
          class="shell__nav-btn"
          type="button"
          :class="{ 'shell__nav-btn--active': isActive('/settings') }"
          aria-label="Ajustes"
          :aria-current="isActive('/settings') ? 'page' : undefined"
          @click="go('/settings')"
        >
          <span class="shell__nav-icon-wrap" aria-hidden="true">
            <svg class="shell__nav-icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
              <path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33
                   1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33
                   l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4
                   h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06
                   A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51
                   1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9
                   a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                stroke="currentColor" stroke-width="1.8"
              />
            </svg>
          </span>
          <span class="shell__nav-label">Ajustes</span>
        </button>

      </nav>

      <!-- Sidebar footer -->
      <div class="shell__sidebar-footer">

        <!-- Account / cloud sync button -->
        <button
          class="shell__account-btn"
          :class="{ 'shell__account-btn--on': authStore.isCloudAuthenticated }"
          type="button"
          :aria-label="authStore.isCloudAuthenticated
            ? 'Cuenta: ' + (authStore.cloudUser?.email ?? 'conectada')
            : 'Conectar cuenta'"
          @click="go('/auth/login')"
        >
          <span class="shell__nav-icon-wrap" aria-hidden="true">
            <!-- User icon (signed in) -->
            <svg v-if="authStore.isCloudAuthenticated" class="shell__nav-icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/>
              <path d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <!-- Cloud icon (not signed in) -->
            <svg v-else class="shell__nav-icon" viewBox="0 0 24 24" fill="none">
              <path d="M5.5 17A4.5 4.5 0 017 8.5h.5A5.5 5.5 0 0118 10.5a3.5 3.5 0 01-.5 7H5.5z"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 13v5M9.5 16l2.5 2.5 2.5-2.5"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="shell__account-label">
            {{ authStore.isCloudAuthenticated
              ? (authStore.cloudUser?.email ?? 'Cuenta')
              : 'Conectar' }}
          </span>
        </button>

        <button
          class="shell__theme-btn"
          type="button"
          :title="appStore.isDark ? 'Modo claro' : 'Modo oscuro'"
          :aria-label="appStore.isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          @click="appStore.toggleTheme"
        >
          <svg v-if="appStore.isDark" class="shell__theme-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707
                 m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
          </svg>
          <svg v-else class="shell__theme-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
          </svg>
          <span class="shell__theme-label">{{ appStore.isDark ? 'Modo claro' : 'Modo oscuro' }}</span>
        </button>
        <p class="shell__version">Traker · v1.0</p>
      </div>
    </aside>

    <!-- ══════════════════════════════════════════════════════
         MAIN CONTENT AREA
         ══════════════════════════════════════════════════════ -->
    <div class="shell__content">
      <slot />
    </div>

    <!-- ══════════════════════════════════════════════════════
         BOTTOM PILL NAV — solo mobile (<768px)
         Se oculta en habit detail (la página tiene su propio nav)
         ══════════════════════════════════════════════════════ -->
    <nav
      v-if="!hidePillNav"
      class="shell__pill"
      aria-label="Navegación principal"
    >
      <button
        class="sp-tab"
        type="button"
        :class="{ 'sp-tab--active': isActive('/') }"
        aria-label="Hoy"
        :aria-current="isActive('/') ? 'page' : undefined"
        @click="go('/')"
      >
        <svg class="sp-tab__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.8"/>
          <path d="M3 9h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="8.5" cy="14" r="1.25" fill="currentColor"/>
          <circle cx="12"  cy="14" r="1.25" fill="currentColor"/>
          <circle cx="15.5" cy="14" r="1.25" fill="currentColor"/>
        </svg>
        <span class="sp-tab__label">HOY</span>
      </button>

      <button
        class="sp-tab"
        type="button"
        :class="{ 'sp-tab--active': isActive('/progress') }"
        aria-label="Progreso"
        :aria-current="isActive('/progress') ? 'page' : undefined"
        @click="go('/progress')"
      >
        <svg class="sp-tab__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 19V13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M9 19V9"  stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M14 19V14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M19 19V5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M3 19h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <span class="sp-tab__label">PROGRESO</span>
      </button>

      <button
        class="sp-tab"
        type="button"
        :class="{ 'sp-tab--active': isActive('/settings') }"
        aria-label="Ajustes"
        :aria-current="isActive('/settings') ? 'page' : undefined"
        @click="go('/settings')"
      >
        <svg class="sp-tab__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
          <path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33
               1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33
               l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4
               h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06
               A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51
               1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9
               a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
            stroke="currentColor" stroke-width="1.8"
          />
        </svg>
        <span class="sp-tab__label">AJUSTES</span>
      </button>
    </nav>

  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════
   SHELL — root layout container
   ══════════════════════════════════════════════════════════ */
.shell {
  display: flex;
  min-height: 100svh;
  position: relative;
}

/* ══════════════════════════════════════════════════════════
   SIDEBAR
   Mobile:  oculta (usa pill nav)
   Tablet:  visible, estrecha — solo íconos (64px)
   Desktop: visible, ancha — íconos + texto (220px)
   ══════════════════════════════════════════════════════════ */
.shell__sidebar {
  /* Oculto en mobile */
  display: none;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 50;
  flex-direction: column;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
  scrollbar-width: none;
  transition: width var(--duration-base) var(--ease-standard);
}
.shell__sidebar::-webkit-scrollbar { display: none; }

/* Tablet: sidebar estrecha solo con íconos */
@media (min-width: 768px) {
  .shell__sidebar {
    display: flex;
    width: 64px;
    padding: 1.25rem 0;
    align-items: center;
  }
}

/* Desktop: sidebar completa con texto */
@media (min-width: 1024px) {
  .shell__sidebar {
    width: 220px;
    padding: 1.5rem 1.25rem;
    align-items: stretch;
  }
}

/* ── Logo ────────────────────────────────────────────────── */
.shell__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0 2rem;
  overflow: hidden;
}

@media (min-width: 1024px) {
  .shell__logo {
    justify-content: flex-start;
    padding: 0.5rem 0.25rem 2rem;
  }
}

.shell__logo-mark {
  color: var(--color-brand);
  font-size: 1.1rem;
  flex-shrink: 0;
}

.shell__logo-text {
  color: var(--color-text);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  line-height: 1;
  white-space: nowrap;
  /* Oculto en tablet, visible en desktop */
  display: none;
}

@media (min-width: 1024px) {
  .shell__logo-text { display: block; }
}

/* ── Nav items ──────────────────────────────────────────── */
.shell__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  width: 100%;
}

.shell__nav-btn {
  display: flex;
  align-items: center;
  justify-content: center; /* centrado en tablet */
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-input);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  -webkit-tap-highlight-color: transparent;
  transition:
    background var(--duration-base) var(--ease-standard),
    color var(--duration-base) var(--ease-standard),
    box-shadow var(--duration-base) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

@media (min-width: 1024px) {
  .shell__nav-btn {
    justify-content: flex-start; /* alineado a la izquierda en desktop */
    padding: 0.75rem 0.875rem;
  }
}

.shell__nav-btn:hover {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.shell__nav-btn:active { transform: scale(0.98); }

.shell__nav-btn--active {
  background: var(--primary-soft);
  color: var(--color-brand);
  box-shadow: inset 0 0 0 1px var(--primary-border), var(--shadow-glow);
}

.shell__nav-btn--active:hover {
  background: var(--primary-soft);
}

/* ── Icon wrapper — tooltip en tablet ──────────────────── */
.shell__nav-icon-wrap {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

/* En tablet, mostrar tooltip con label al hover */
@media (min-width: 768px) and (max-width: 1023px) {
  .shell__nav-icon-wrap::after {
    content: attr(data-label);
    position: absolute;
    left: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: var(--radius-input);
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-base) var(--ease-standard);
    z-index: 100;
  }
  .shell__nav-btn:hover .shell__nav-icon-wrap::after { opacity: 1; }
}

.shell__nav-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

/* Nav label — oculta en tablet, visible en desktop */
.shell__nav-label {
  line-height: 1;
  white-space: nowrap;
  display: none;
}

@media (min-width: 1024px) {
  .shell__nav-label { display: block; }
}

/* ── Sidebar footer ─────────────────────────────────────── */
.shell__sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
  margin-top: 1rem;
  width: 100%;
}

/* ── Account button ─────────────────────────────────────── */
.shell__account-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: var(--radius-input);
  border: none;
  background: transparent;
  color: var(--color-text-faint);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard);
}

@media (min-width: 1024px) {
  .shell__account-btn {
    justify-content: flex-start;
    padding: 0.5rem 0.75rem;
  }
}

.shell__account-btn:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
}

.shell__account-btn--on {
  color: color-mix(in srgb, var(--color-brand) 80%, var(--color-text-muted));
}

.shell__account-btn--on:hover {
  background: color-mix(in srgb, var(--color-brand) 8%, var(--color-surface-raised));
  color: var(--color-brand);
}

.shell__account-label {
  display: none;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

@media (min-width: 1024px) {
  .shell__account-label { display: block; }
}

.shell__theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: var(--radius-input);
  border: none;
  background: transparent;
  color: var(--color-text-faint);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard);
}

@media (min-width: 1024px) {
  .shell__theme-btn {
    justify-content: flex-start;
    padding: 0.5rem 0.75rem;
  }
}

.shell__theme-btn:hover {
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
}

.shell__theme-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
}

.shell__theme-label {
  display: none;
  line-height: 1;
}

@media (min-width: 1024px) {
  .shell__theme-label { display: block; }
}

.shell__version {
  display: none;
  color: var(--color-text-faint);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: center;
}

@media (min-width: 1024px) {
  .shell__version {
    display: block;
    text-align: left;
    padding-left: 0.25rem;
  }
}

/* ══════════════════════════════════════════════════════════
   MAIN CONTENT
   Se desplaza según si hay sidebar
   ══════════════════════════════════════════════════════════ */
.shell__content {
  flex: 1;
  min-height: 100svh;
  min-width: 0;
  width: 100%;
  /* Mobile: sin margen */
}

/* Tablet: deja espacio para la sidebar estrecha */
@media (min-width: 768px) {
  .shell__content { margin-left: 64px; }
}

/* Desktop: deja espacio para la sidebar completa */
@media (min-width: 1024px) {
  .shell__content { margin-left: 220px; }
}

/* Páginas full-screen (lock, onboarding) */
.shell--no-sidebar .shell__content {
  margin-left: 0 !important;
}

/* ══════════════════════════════════════════════════════════
   BOTTOM PILL NAV — solo en mobile (<768px)
   ══════════════════════════════════════════════════════════ */
.shell__pill {
  position: fixed;
  left: 1.25rem;
  right: 1.25rem;
  bottom: max(1.25rem, env(safe-area-inset-bottom, 1.25rem));
  z-index: 40;
  display: flex;
  align-items: stretch;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-float);
  max-width: 26rem;
  margin-inline: auto;

  /* Oculto en tablet y desktop (usa sidebar) */
}

@media (min-width: 768px) {
  .shell__pill { display: none; }
}

/* ── Tabs ────────────────────────────────────────────────── */
.sp-tab {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0.75rem 1rem;
  color: var(--color-text-faint);
  cursor: pointer;
  border: none;
  background: transparent;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  border-radius: inherit;
  transition:
    color var(--duration-base) var(--ease-standard),
    background var(--duration-base) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.sp-tab:active {
  transform: scale(0.98);
}

.sp-tab--active {
  color: var(--color-brand);
  background: var(--primary-soft);
  box-shadow: inset 0 0 0 1px rgba(204,255,0,0.08);
}

/* Neon indicator dot */
.sp-tab--active::before {
  content: '';
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--color-brand);
}

.sp-tab__icon { width: 1.375rem; height: 1.375rem; }

.sp-tab__label {
  font-size: 0.5rem;
  font-weight: 800;
  letter-spacing: 0.10em;
  line-height: 1;
}
</style>
