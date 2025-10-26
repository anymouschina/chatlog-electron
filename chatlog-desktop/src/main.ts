import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import './style.css'
import App from './App.vue'

import Dashboard from './pages/Dashboard.vue'
import Sessions from './pages/Sessions.vue'
import Contacts from './pages/Contacts.vue'
import Groups from './pages/Groups.vue'
import Decrypt from './pages/Decrypt.vue'
import Server from './pages/Server.vue'
import Logs from './pages/Logs.vue'
import Integrations from './pages/Integrations.vue'
import Preferences from './pages/Preferences.vue'
import Accounts from './pages/Accounts.vue'
import Chat from './pages/Chat.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/contacts' },
    { path: '/dashboard', component: Dashboard },
    { path: '/sessions', component: Sessions },
    { path: '/contacts', component: Contacts },
    { path: '/groups', component: Groups },
    { path: '/decrypt', component: Decrypt },
    { path: '/server', component: Server },
    { path: '/logs', component: Logs },
    { path: '/integrations', component: Integrations },
    { path: '/preferences', component: Preferences },
    { path: '/accounts', component: Accounts },
    { path: '/chat', component: Chat },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app').$nextTick(() => {
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
})
