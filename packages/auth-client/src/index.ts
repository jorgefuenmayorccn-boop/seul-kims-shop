/**
 * SEUL Auth Client — Unified authentication for all apps
 * Calls Node.js endpoint on Vercel (stable PostgreSQL connection)
 */

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  ok: boolean
  token?: string
  error?: string
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export interface DecodedToken {
  id: string
  email: string
  role: string
  iat: number
  exp: number
}

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://seoulshop.cl/api/auth'

/**
 * Login with email and password
 * Returns JWT token if successful
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    const response = await fetch(`${AUTH_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json() as LoginResponse

    if (!response.ok) {
      return { ok: false, error: data.error || 'Login failed' }
    }

    return data
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Decode and verify JWT token (client-side only — NEVER use for server validation)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    return payload
  } catch {
    return null
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token)
  if (!decoded) return true
  return Date.now() >= decoded.exp * 1000
}

/**
 * Get token from localStorage
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth-token')
}

/**
 * Save token to localStorage
 */
export function saveToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('auth-token', token)
}

/**
 * Clear token from localStorage
 */
export function clearToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('auth-token')
}

/**
 * Get current user from token
 */
export function getCurrentUser(): DecodedToken | null {
  const token = getToken()
  if (!token || isTokenExpired(token)) return null
  return decodeToken(token)
}
