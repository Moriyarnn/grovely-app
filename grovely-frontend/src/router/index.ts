import { createRouter, createWebHistory } from 'vue-router'
import HubView from '../views/HubView.vue'
import MainScreen from '../components/MainScreen.vue'
import { getToken } from '../api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/',
      name: 'hub',
      component: HubView
    },
    {
      path: '/info',
      name: 'info',
      component: MainScreen,
      props: { showBack: true }
    },
    {
      path: '/period',
      name: 'period',
      component: () => import('../views/period/PeriodHome.vue')
    },
    {
      path: '/period/cycle/:id',
      name: 'period-cycle',
      component: () => import('../views/period/CycleDetail.vue')
    },
    {
      path: '/pantry',
      name: 'pantry',
      component: () => import('../views/pantry/PantryHome.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('../views/LogsDashboard.vue')
    }
  ]
})

router.beforeEach((to, _from, next) => {
  if (to.name !== 'login' && !getToken()) {
    next({ name: 'login' })
  } else {
    next()
  }
})

export default router