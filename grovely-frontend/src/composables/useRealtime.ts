import { ref } from 'vue'
import { API_BASE, getToken } from '../api'
import { usePreferences } from './usePreferences'

// Live activity — SSE client. Receives broadcasts from other household accounts
// and drives two things:
//   1. A coalescing bubble queue (one AppToast shown at a time, sequentially).
//   2. A `grovely:activity` window event that mounted views listen to for the
//      surgical merge + page-conditional animation.
// Pure live: events that arrive while disconnected are never replayed. On
// reconnect we fire `grovely:resync` so mounted views reload from scratch.

interface Bubble {
  key: string
  count: number
  icon: string
  render: (count: number) => string
  text: string
}

const COALESCE_MS = 1500       // same actor + same key within this window merge into one bubble
const DISPLAY_MS = 3500        // how long each bubble shows

const currentBubble = ref<Bubble | null>(null)
const pending: Bubble[] = []
const lastByKey = new Map<string, { bubble: Bubble; ts: number }>()

let es: EventSource | null = null
let wasOpen = false
let advancing = false

function receiveOn(): boolean {
  const { preferences } = usePreferences()
  return (preferences.value.live_activity_receive ?? '1') === '1'
}

// Map a raw event to a bubble template. `render(count)` produces the text so
// coalesced bubbles can switch to a counted form (e.g. "moved 3 items").
function describe(ev: any): { key: string; icon: string; render: (c: number) => string } {
  const name = ev.actorName || 'Someone'
  switch (ev.type) {
    case 'period.change':
      return { key: 'period', icon: 'mdi-calendar-heart', render: () => `${name} made changes on the period tracker` }
    case 'pantry.list.add':
      return {
        key: 'list.add', icon: 'mdi-cart-plus',
        render: (c) => c > 1 ? `${name} added ${c} items to the shopping list` : `${name} added ${ev.item} to the shopping list`
      }
    case 'pantry.list.modify':
      return { key: 'list.modify', icon: 'mdi-cart', render: () => `${name} modified the shopping list` }
    case 'pantry.inv.add':
      return {
        key: 'inv.add', icon: 'mdi-fridge-outline',
        render: (c) => c > 1 ? `${name} moved ${c} items to the pantry inventory` : `${name} moved ${ev.item} to the pantry inventory`
      }
    case 'pantry.inv.modify':
      return { key: 'inv.modify', icon: 'mdi-fridge-outline', render: () => `${name} updated the pantry inventory` }
    case 'system.update':
      return { key: 'system.update', icon: 'mdi-package-up', render: () => `${name} started a Grovely update` }
    default:
      return { key: 'other', icon: 'mdi-bell-outline', render: () => `${name} made a change` }
  }
}

function enqueueBubble(ev: any): void {
  const { key, icon, render } = describe(ev)
  const now = Date.now()
  const recent = lastByKey.get(key)

  if (recent && now - recent.ts < COALESCE_MS) {
    recent.bubble.count += 1
    recent.bubble.text = recent.bubble.render(recent.bubble.count)
    recent.ts = now
    // If it's the bubble currently on screen, reassign the ref so AppToast
    // re-renders and resets its dismiss timer (extending the display).
    if (currentBubble.value === recent.bubble) {
      currentBubble.value = { ...recent.bubble }
      lastByKey.set(key, { bubble: currentBubble.value, ts: now })
    }
    return
  }

  const bubble: Bubble = { key, count: 1, icon, render, text: render(1) }
  lastByKey.set(key, { bubble, ts: now })
  pending.push(bubble)
  processQueue()
}

function processQueue(): void {
  if (advancing || currentBubble.value) return
  const next = pending.shift()
  if (next) currentBubble.value = next
}

function onBubbleDismiss(): void {
  currentBubble.value = null
  advancing = true
  // Small gap so the leave transition completes before the next bubble enters.
  setTimeout(() => { advancing = false; processQueue() }, 220)
}

function handleMessage(e: MessageEvent): void {
  let ev: any
  try { ev = JSON.parse(e.data) } catch { return }
  if (!receiveOn()) return
  // Mounted views handle surgical merge + animation (page-conditional: a view
  // only listens while it is mounted).
  window.dispatchEvent(new CustomEvent('grovely:activity', { detail: ev }))
  // Keep hub cards / summary strip fresh even when not on the changed page.
  window.dispatchEvent(new CustomEvent('appstats:invalidate'))
  // `silent` events sync data + animate but raise no bubble (e.g. the list
  // delete that is a side-effect of a move-to-pantry).
  if (!ev.silent) enqueueBubble(ev)
}

function connect(): void {
  // DEMO GATE: the live-activity stream is a real SSE connection to the server.
  // The demo is single-user and runs entirely in the tab, so it never opens one
  // (keeps the "nothing leaves your browser" guarantee literally true). Compiled
  // out of the normal build.
  if (__DEMO__) return
  if (es) return
  const token = getToken()
  if (!token) return
  es = new EventSource(`${API_BASE}/api/events?token=${encodeURIComponent(token)}`)
  es.onopen = () => {
    if (wasOpen) window.dispatchEvent(new CustomEvent('grovely:resync'))
    wasOpen = true
  }
  es.onmessage = handleMessage
  // EventSource auto-reconnects on error using the server's `retry:` hint.
  es.onerror = () => {}
}

function disconnect(): void {
  if (es) { es.close(); es = null }
  wasOpen = false
}

export function useRealtime() {
  return { currentBubble, onBubbleDismiss, connect, disconnect, DISPLAY_MS }
}
