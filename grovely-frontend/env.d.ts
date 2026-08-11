/// <reference types="vite/client" />

// Injected by Vite `define` from package.json version (see vite.config.ts).
declare const __APP_VERSION__: string

// Injected by Vite `define`. True only for the demo build (`--mode demo`); in
// the normal build it is the constant `false`, so demo-only branches are
// dead-code eliminated.
declare const __DEMO__: boolean
declare const __DEMO_RELEASE_CURRENT__: boolean | null
declare const __DEMO_PUBLIC_LINKS__: unknown

// sql.js WASM, imported as a self-hosted asset URL in the demo build.
declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string
  export default url
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
