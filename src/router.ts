import { createRouter, createWebHashHistory } from 'vue-router'
import App from '@/App.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: App },
    { path: '/assessment', component: App },
    { path: '/results/:sessionId?', component: App },
    { path: '/admin', component: App },
  ],
})
