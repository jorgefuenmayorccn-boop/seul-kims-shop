import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, ne } from 'drizzle-orm'
import { loginUser, revokeSession, validateSession, createUser } from '../lib/auth'
import { requireAuth } from '../middleware/require-auth'
import { getDb } from '../lib/db'
import { users } from '@seul/db/schema'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

const COOKIE_NAME = '__Host-seul_session'
const COOKIE_OPTS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800'

// POST /api/auth/login
router.post('/login', zValidator('json', z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})), async (c) => {
  const { email, password } = c.req.valid('json')
  const ip        = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')
  const userAgent = c.req.header('User-Agent')

  const result = await loginUser(c.env, email, password, { ip, userAgent })

  if ('error' in result) {
    return c.json({ error: result.error }, result.status as 401 | 429)
  }

  c.header('Set-Cookie', `${COOKIE_NAME}=${result.token}; ${COOKIE_OPTS}`)
  return c.json({ ok: true, user: result.user })
})

// POST /api/auth/logout
router.post('/logout', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const match  = cookie.match(/(?:^|;\s*)__Host-seul_session=([a-f0-9]{64})/)
  const token  = match?.[1]

  if (token) await revokeSession(c.env, token)

  c.header('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`)
  return c.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const match  = cookie.match(/(?:^|;\s*)__Host-seul_session=([a-f0-9]{64})/)
  const token  = match?.[1]

  if (!token) return c.json({ user: null }, 401)

  const user = await validateSession(c.env, token)
  if (!user) return c.json({ user: null }, 401)

  return c.json({ user })
})

// POST /api/auth/register — solo owner puede crear usuarios (habilitado en Fase 6)
// Por ahora solo disponible si no hay ningún usuario (bootstrap)
router.post('/register', zValidator('json', z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().min(1),
  role:     z.enum(['owner', 'admin', 'staff', 'delivery', 'viewer']).optional(),
})), async (c) => {
  // Validar que quien llama es owner (o que no hay usuarios aún — bootstrap)
  const cookie = c.req.header('Cookie') ?? ''
  const match  = cookie.match(/(?:^|;\s*)__Host-seul_session=([a-f0-9]{64})/)
  const token  = match?.[1]
  const caller = token ? await validateSession(c.env, token) : null

  if (caller && caller.role !== 'owner') {
    return c.json({ error: 'Solo el owner puede crear usuarios' }, 403)
  }

  const body = c.req.valid('json')
  try {
    const user = await createUser(c.env, {
      email:    body.email,
      password: body.password,
      name:     body.name,
      role:     caller ? (body.role ?? 'staff') : 'owner', // sin caller = primer usuario = owner
    })
    return c.json({ ok: true, user }, 201)
  } catch {
    return c.json({ error: 'Email ya registrado' }, 409)
  }
})

// GET /api/auth/users — lista de usuarios del sistema (owner/admin)
router.get('/users', requireAuth(['owner', 'admin']), async (c) => {
  const db   = getDb(c.env)
  const rows = await db.select({
    id:               users.id,
    email:            users.email,
    name:             users.name,
    role:             users.role,
    isActive:         users.isActive,
    cargo:            users.cargo,
    departamento:     users.departamento,
    telefonoPersonal: users.telefonoPersonal,
    avatarUrl:        users.avatarUrl,
    lastLoginAt:      users.lastLoginAt,
    createdAt:        users.createdAt,
  }).from(users).orderBy(users.createdAt)
  return c.json({ users: rows })
})

// PUT /api/auth/users/:id — actualizar nombre, rol, estado activo y metadata corporativa (owner only)
router.put('/users/:id', requireAuth(['owner']), zValidator('json', z.object({
  name:             z.string().min(1).optional(),
  role:             z.enum(['owner', 'admin', 'staff', 'delivery', 'viewer']).optional(),
  isActive:         z.boolean().optional(),
  cargo:            z.string().optional(),
  departamento:     z.string().optional(),
  telefonoPersonal: z.string().optional(),
  avatarUrl:        z.string().url().optional(),
})), async (c) => {
  const db      = getDb(c.env)
  const { id }  = c.req.param()
  const caller  = c.get('user')
  const patch   = c.req.valid('json')

  if (id === caller.id && patch.isActive === false) {
    return c.json({ error: 'No puedes desactivar tu propia cuenta' }, 400)
  }

  const [updated] = await db.update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({
      id: users.id, email: users.email, name: users.name,
      role: users.role, isActive: users.isActive,
      cargo: users.cargo, departamento: users.departamento,
    })

  if (!updated) return c.json({ error: 'Usuario no encontrado' }, 404)
  return c.json({ user: updated })
})

// DELETE /api/auth/users/:id — soft-delete (desactivar) usuario (owner only)
router.delete('/users/:id', requireAuth(['owner']), async (c) => {
  const db     = getDb(c.env)
  const { id } = c.req.param()
  const caller = c.get('user')

  if (id === caller.id) return c.json({ error: 'No puedes eliminar tu propia cuenta' }, 400)

  const [updated] = await db.update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id })

  if (!updated) return c.json({ error: 'Usuario no encontrado' }, 404)
  return c.json({ ok: true })
})

export { router as authRouter }
