import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import '@/components/ui/transitions.css'

// Vuetify
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light'
  }
})

async function bootstrap() {
  // Demo build: stand up the in-browser backend (sql.js + real routes) before
  // the app mounts, so the first API calls are already served locally. The
  // dynamic import keeps the entire demo subtree out of the normal bundle.
  if (__DEMO__) {
    const { initDemoBackend } = await import('./demo')
    await initDemoBackend()
  }

  const app = createApp(App)
  app.use(router)
  app.use(vuetify)
  app.mount('#app')
}

bootstrap()