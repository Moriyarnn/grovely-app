import { fileURLToPath, URL } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { demoBackend } from './vite-plugin-demo-backend'
import { isCurrentOrNewerVersion } from './src/utils/version'

// Single source of truth for the app version: package.json. MainScreen reads
// __APP_VERSION__ so the displayed version can never drift from the package.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
)

const backendDir = fileURLToPath(new URL('../grovely-backend', import.meta.url))
const headersPath = fileURLToPath(new URL('./dist/_headers', import.meta.url))

function feedbackOrigin(endpoint: string | undefined): string | null {
  if (!endpoint) return null

  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

function feedbackCspPlugin(origin: string) {
  return {
    name: 'feedback-csp',
    closeBundle() {
      const headers = readFileSync(headersPath, 'utf-8')
      writeFileSync(headersPath, headers.replace("connect-src 'self';", `connect-src 'self' ${origin};`))
    },
  }
}

type DemoReleaseMetadata = {
  current: boolean | null
  links: unknown
}

async function demoReleaseMetadata(): Promise<DemoReleaseMetadata> {
  try {
    const response = await fetch('https://grovely.org/releases/stable.json')
    if (!response.ok) throw new Error(`Release feed returned ${response.status}`)
    const manifest = await response.json() as { version?: string, links?: unknown }
    return {
      current: isCurrentOrNewerVersion(`v${pkg.version}`, manifest.version),
      links: manifest.links ?? null,
    }
  } catch {
    return { current: null, links: null }
  }
}

function demoReleaseStatusPlugin(isDemo: boolean): Plugin {
  return {
    name: 'demo-release-status',
    async config() {
      const metadata = isDemo
        ? await demoReleaseMetadata()
        : { current: null, links: null }
      return {
        define: {
          __DEMO_RELEASE_CURRENT__: JSON.stringify(metadata.current),
          __DEMO_PUBLIC_LINKS__: JSON.stringify(metadata.links),
        },
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo'
  const feedbackEndpoint = process.env.VITE_FEEDBACK_ENDPOINT ?? loadEnv(mode, process.cwd()).VITE_FEEDBACK_ENDPOINT
  const configuredFeedbackOrigin = feedbackOrigin(feedbackEndpoint)
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      // Build-time flag. In a normal build this is `false`, so the guarded
      // dynamic import of ./demo (and everything under it) is dead-code
      // eliminated - the demo backend never ships in the real app.
      __DEMO__: JSON.stringify(isDemo),
    },
    plugins: [
      demoReleaseStatusPlugin(isDemo),
      vue(),
      ...(isDemo ? [demoBackend()] : []),
      ...(isDemo && configuredFeedbackOrigin ? [feedbackCspPlugin(configuredFeedbackOrigin)] : []),
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
    test: {
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/__tests__/**'],
        reporter: ['text', 'html', 'lcov'],
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
