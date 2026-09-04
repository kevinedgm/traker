import { createRouter, createWebHistory } from 'vue-router'
import { features } from '@/config/features.js'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@pages/DashboardPage.vue'),
    meta: { title: 'Hoy' },
  },
  {
    path: '/habits',
    name: 'habits-settings',
    component: () => import('@pages/HabitsSettingsPage.vue'),
    meta: { title: 'Administrar hábitos' },
  },
  {
    path: '/habit/:id',
    name: 'habit',
    component: () => import('@pages/HabitDetailPage.vue'),
    meta: { title: 'Hábito', hideNav: true, hideSidebar: true },
  },
  {
    path: '/progress',
    name: 'progress',
    component: () => import('@pages/ProgressPage.vue'),
    meta: { title: 'Progreso' },
  },
  {
    path: '/rewards',
    name: 'rewards',
    component: () => import('@pages/RewardsPage.vue'),
    meta: { title: 'Recompensas' },
  },
  ...(features.goals ? [
    {
      path: '/goals',
      name: 'goals',
      component: () => import('@pages/goals/GoalsPage.vue'),
      meta: { title: 'Metas' },
    },
    {
      path: '/goals/new',
      name: 'goal-create',
      component: () => import('@pages/goals/CreateGoalPage.vue'),
      meta: { title: 'Nueva meta', hideNav: true },
    },
    {
      path: '/goals/:id/session',
      name: 'goal-session',
      component: () => import('@pages/goals/GoalSessionPage.vue'),
      meta: { title: 'Sesión', hideNav: true },
    },
    {
      path: '/settings/goals',
      name: 'goals-settings',
      component: () => import('@pages/goals/GoalsSettingsPage.vue'),
      meta: { title: 'Foco de Metas', hideNav: true },
    },
    {
      path: '/goals/:id',
      name: 'goal-detail',
      component: () => import('@pages/goals/GoalDetailPage.vue'),
      meta: { title: 'Meta', hideNav: true },
    },
  ] : []),
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@pages/SettingsPage.vue'),
    meta: { title: 'Ajustes' },
  },
  {
    path: '/settings/notifications',
    name: 'notifications-diagnostic',
    component: () => import('@pages/NotificationsDiagnosticPage.vue'),
    meta: { title: 'Notificaciones', hideNav: true, hideSidebar: true },
  },
  ...(features.syncV2Pilot ? [{
    path: '/settings/sync-v2-pilot',
    name: 'sync-v2-pilot',
    component: () => import('@pages/SyncV2PilotPage.vue'),
    meta: { title: 'Piloto de sincronización', hideSidebar: true },
  }] : []),
  {
    path: '/auth/login',
    name: 'login',
    component: () => import('@pages/auth/LoginPage.vue'),
    meta: { title: 'Cuenta', hideNav: true, hideSidebar: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@pages/NotFoundPage.vue'),
    meta: { title: '404' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.beforeEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} — Traker` : 'Traker'
})

export default router
