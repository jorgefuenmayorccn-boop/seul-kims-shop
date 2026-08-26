import type { Context, Next } from 'hono'
import { validateSession } from '../lib/auth'
import type { Bindings } from '../index'
import type { SessionUser } from '../lib/auth'

type Variables = { user: SessionUser }

export function requireAuth(roles?: SessionUser['role'][]) {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    const cookie = c.req.header('Cookie') ?? ''
    const match  = cookie.match(/(?:^|;\s*)__Host-seul_session=([a-f0-9]{64})/)
    const token  = match?.[1]

    if (!token) return c.json({ error: 'No autenticado' }, 401)

    const user = await validateSession(c.env, token)
    if (!user) return c.json({ error: 'Sesión inválida o expirada' }, 401)

    if (roles && !roles.includes(user.role)) {
      return c.json({ error: 'Sin permisos' }, 403)
    }

    c.set('user', user)
    await next()
  }
}
