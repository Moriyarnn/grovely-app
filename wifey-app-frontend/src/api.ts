const rawPort = import.meta.env.VITE_BACKEND_PORT
const port = rawPort !== undefined ? rawPort : '3000'
export const API_BASE = port
  ? `${window.location.protocol}//${window.location.hostname}:${port}`
  : window.location.origin
export const API = `${API_BASE}/api`

export function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('auth_token')
}

export interface AuthUser {
  username: string
  role: string
}

export function getUser(): AuthUser | null {
  const u = localStorage.getItem('auth_user')
  return u ? JSON.parse(u) : null
}

export function setUser(user: AuthUser): void {
  localStorage.setItem('auth_user', JSON.stringify(user))
}

export function clearUser(): void {
  localStorage.removeItem('auth_user')
}

const STATS_INVALIDATING_PATHS = ['/period', '/pantry']

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (res.status === 401) {
    clearToken()
    clearUser()
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }
  const method = (options.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && res.ok && STATS_INVALIDATING_PATHS.some(p => url.includes(p))) {
    window.dispatchEvent(new CustomEvent('appstats:invalidate'))
  }
  return res
}

export async function exportBackup(): Promise<void> {
  let res: Response
  try {
    res = await apiFetch(`${API}/backup/export`)
  } catch {
    throw new Error('Could not reach the server — check your connection.')
  }
  if (!res.ok) throw new Error(`Export failed (server returned ${res.status})`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `wifey-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function restoreBackup(backup: unknown): Promise<{ success: boolean; warnings?: string[] }> {
  const res = await apiFetch(`${API}/backup/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backup),
  })
  const text = await res.text()
  let json: { error?: string; success?: boolean; warnings?: string[] }
  try { json = JSON.parse(text) } catch { throw new Error(`Server error ${res.status} — backup may be too large or server unavailable`) }
  if (!res.ok) throw new Error(json.error ?? 'Restore failed')
  return json as { success: boolean; warnings?: string[] }
}
