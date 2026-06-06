/// <reference types="vite/client" />

// Injected by Vite `define` from package.json version (see vite.config.ts).
declare const __APP_VERSION__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}