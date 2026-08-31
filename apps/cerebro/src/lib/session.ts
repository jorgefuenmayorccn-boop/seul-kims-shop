'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { SessionUser } from './types'

export type { SessionUser }

const API_URL     = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
const COOKIE_NAME = 'seul_session'

export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Cookie: `${COOKIE_NAME}=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json() as { user: SessionUser | null }
    return data.user
  } catch {
    return null
  }
}

export async function requireSession(roles?: SessionUser['role'][]): Promise<SessionUser> {
  const user = await getServerSession()
  if (!user) redirect('/login')
  if (roles && !roles.includes(user.role)) redirect('/login')
  return user
}
