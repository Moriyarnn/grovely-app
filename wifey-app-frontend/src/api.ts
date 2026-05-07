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
  return res
}
