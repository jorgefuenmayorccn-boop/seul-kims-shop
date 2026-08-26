import { eq, and, gt } from 'drizzle-orm'
import { getDb } from './db'
import { users, sessions } from '@seul/db/schema'
import { hashPassword, verifyPassword, generateToken } from './crypto'
import type { Bindings } from '../index'

const SESSION_TTL_MS  = 7 * 24 * 60 * 60 * 1000   // 7 días
const LOCKOUT_ATTEMPTS = 3
const LOCKOUT_MS       = 15 * 60 * 1000             // 15 min

export type SessionUser = {
  id:    string
  email: string
  name:  string
  role:  'owner' | 'admin' | 'staff' | 'delivery' | 'viewer'
}

export async function createUser(
  env: Bindings,
  data: { email: string; password: string; name: string; role?: SessionUser['role'] }
): Promise<SessionUser> {
  const db   = getDb(env)
  const hash = await hashPassword(data.password)
  const [user] = await db.insert(users).values({
    email:        data.email.toLowerCase().trim(),
    passwordHash: hash,
    name:         data.name,
    role:         data.role ?? 'staff',
  }).returning({ id: users.id, email: users.email, name: users.name, role: users.role })
  return user
}

export async function loginUser(
  env: Bindings,
  email: string,
  password: string,
  meta: { ip?: string; userAgent?: string }
): Promise<{ token: string; user: SessionUser } | { error: string; status: number }> {
  const db = getDb(env)
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()))

  if (!user || !user.isActive) {
    return { error: 'Credenciales inválidas', status: 401 }
  }

  // Lockout check
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000)
    return { error: `Cuenta bloqueada. Intenta en ${mins} min.`, status: 429 }
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    const attempts = (user.failedAttempts ?? 0) + 1
    const patch: Record<string, unknown> = { failedAttempts: attempts, updatedAt: new Date() }
    if (attempts >= LOCKOUT_ATTEMPTS) {
      patch.lockedUntil = new Date(Date.now() + LOCKOUT_MS)
    }
    await db.update(users).set(patch).where(eq(users.id, user.id))
    return { error: 'Credenciales inválidas', status: 401 }
  }

  // Reset failures + update lastLogin
  await db.update(users)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))

  // Create session
  const token     = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ id: token, userId: user.id, expiresAt, ip: meta.ip, userAgent: meta.userAgent })

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role as SessionUser['role'] },
  }
}

export async function validateSession(env: Bindings, token: string): Promise<SessionUser | null> {
  if (!token || token.length !== 64) return null
  const db = getDb(env)

  const [row] = await db
    .select({ user: { id: users.id, email: users.email, name: users.name, role: users.role, isActive: users.isActive } })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))

  if (!row || !row.user.isActive) return null

  // Rolling refresh: extend session if < 3 days remain
  const [sess] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.id, token))
  const remaining = new Date(sess.expiresAt).getTime() - Date.now()
  if (remaining < 3 * 24 * 60 * 60 * 1000) {
    await db.update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, token))
  }

  return { id: row.user.id, email: row.user.email, name: row.user.name, role: row.user.role as SessionUser['role'] }
}

export async function revokeSession(env: Bindings, token: string): Promise<void> {
  const db = getDb(env)
  await db.delete(sessions).where(eq(sessions.id, token))
}
