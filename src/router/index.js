import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@pages/DashboardPage.vue'),
    meta: { title: 'Hoy' },
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
    path: '/settings',
    name: 'settings',
    component: () => import('@pages/SettingsPage.vue'),
    meta: { title: 'Ajustes' },
  },
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
