import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { demoBackend } from './vite-plugin-demo-backend'

// Single source of truth for the app version: package.json. MainScreen reads
// __APP_VERSION__ so the displayed version can never drift from the package.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
)

const backendDir = fileURLToPath(new URL('../grovely-backend', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo'
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      // Build-time flag. In a normal build this is `false`, so the guarded
      // dynamic import of ./demo (and everything under it) is dead-code
      // eliminated - the demo backend never ships in the real app.
      __DEMO__: JSON.stringify(isDemo),
    },
    plugins: [
      vue(),
      ...(isDemo ? [demoBackend()] : []),
    ],
    server: {
      host: true,
      allowedHosts: true,
      // The demo imports migration .sql files and route handlers from the
      // backend directory, which sits outside the frontend root.
      fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), backendDir] },
      watch: {
        usePolling: true,
        interval: 1000
      }
    },
    preview: {
      host: true,
      allowedHosts: true,
    },
    build: {
      commonjsOptions: {
        // The backend route files are CommonJS; include them in the CJS->ESM
        // transform alongside node_modules, and allow files that mix require()
        // with ESM-style imports (the shims).
        include: [/node_modules/, new RegExp(path.basename(backendDir))],
        transformMixedEsModules: true,
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
