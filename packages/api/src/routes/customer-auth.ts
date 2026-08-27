import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { eq, and, gt, desc } from 'drizzle-orm'
import { getDb } from '../lib/db'
import {
  customers, emailVerificationTokens, passwordResetTokens, consents, emailQueue, orders, orderItems,
} from '@seul/db/schema'
import {
  CUSTOMER_COOKIE, createCustomerSession, validateCustomerSession,
  revokeCustomerSession, revokeAllCustomerSessions, hashPassword, verifyPassword, generateToken,
} from '../lib/customer-auth'
import {
  sendEmail, templateWelcome, templatePasswordReset,
} from '../lib/send-email'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   true,
  sameSite: 'Strict' as const,
  path:     '/',
  maxAge:   7 * 24 * 60 * 60,
}

function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

const WEB_URL = 'http://localhost:3000' // será env var en producción

// POST /api/customer/register
router.post('/register', async (c) => {
  const body = await c.req.json<{ name?: string; email?: string; marketingOptIn?: boolean }>()
  const { name, email, marketingOptIn = false } = body

  if (!name?.trim() || !email?.trim()) {
    return c.json({ ok: false, error: 'Nombre y correo son requeridos' }, 400)
  }

  const db = getDb(c.env)

  // Verificar si ya existe
  const [existing] = await db.select({ id: customers.id }).from(customers)
    .where(eq(customers.email, email.toLowerCase().trim()))
  if (existing) {
    return c.json({ ok: false, error: 'Ya existe una cuenta con ese correo' }, 409)
  }

  // Generar password temporal
  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)

  // Crear customer
  const [customer] = await db.insert(customers).values({
    email:             email.toLowerCase().trim(),
    name:              name.trim(),
    passwordHash,
    mustChangePassword: true,
    emailVerified:     false,
    marketingOptIn,
    marketingOptInAt:  marketingOptIn ? new Date() : null,
  }).returning({ id: customers.id, name: customers.name, email: customers.email })

  // Crear token de verificación (24h)
  const verifyToken = generateToken()
  await db.insert(emailVerificationTokens).values({
    token:      verifyToken,
    customerId: customer.id,
    expiresAt:  new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  // Guardar consentimientos explícitos (Ley 21.719)
  const ip        = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')
  const userAgent = c.req.header('User-Agent')
  const now       = new Date()
  const toS = [
    { type: 'tos',     versionAccepted: '2026-08-01' },
    { type: 'privacy', versionAccepted: '2026-08-01' },
    ...(marketingOptIn ? [{ type: 'marketing', versionAccepted: '2026-08-01' }] : []),
  ]
  await db.insert(consents).values(toS.map(c2 => ({
    customerId:      customer.id,
    type:            c2.type,
    versionAccepted: c2.versionAccepted,
    acceptedAt:      now,
    ip,
    userAgent,
  })))

  // Enviar email de bienvenida + verificación
  const verifyUrl = `${WEB_URL}/cuenta/verificar/${verifyToken}`
  const emailResult = await sendEmail(c.env, {
    to:      customer.email!,
    subject: 'Bienvenido/a a SEUL SHOP — Confirma tu cuenta',
    html:    templateWelcome(customer.name, verifyUrl, tempPassword),
  })

  await db.insert(emailQueue).values({
    customerId: customer.id,
    email:      customer.email!,
    type:       'welcome',
    subject:    'Bienvenido/a a SEUL SHOP — Confirma tu cuenta',
    status:     emailResult.ok ? 'sent' : 'failed',
    templateId: 'welcome',
    templateData: { verifyUrl, tempPassword },
  })

  return c.json({ ok: true, message: 'Revisa tu correo para confirmar tu cuenta' })
})

// POST /api/customer/verify-email
router.post('/verify-email', async (c) => {
  const { token } = await c.req.json<{ token?: string }>()
  if (!token) return c.json({ ok: false, error: 'Token requerido' }, 400)

  const db = getDb(c.env)
  const [row] = await db.select().from(emailVerificationTokens)
    .where(and(eq(emailVerificationTokens.token, token), gt(emailVerificationTokens.expiresAt, new Date())))

  if (!row) return c.json({ ok: false, error: 'Token inválido o expirado' }, 400)
  if (row.usedAt) return c.json({ ok: false, error: 'Token ya utilizado' }, 400)

  await db.update(customers)
    .set({ emailVerified: true, emailVerifiedAt: new Date() })
    .where(eq(customers.id, row.customerId))

  await db.update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.token, token))

  return c.json({ ok: true, message: 'Correo verificado correctamente' })
})

// POST /api/customer/login
router.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>()
  const { email, password } = body

  if (!email || !password) return c.json({ ok: false, error: 'Correo y contraseña requeridos' }, 400)

  const db = getDb(c.env)
  const [customer] = await db.select().from(customers)
    .where(eq(customers.email, email.toLowerCase().trim()))

  if (!customer || !customer.passwordHash || customer.deletedAt) {
    return c.json({ ok: false, error: 'Correo o contraseña incorrectos' }, 401)
  }

  if (!customer.emailVerified) {
    return c.json({ ok: false, error: 'Debes confirmar tu correo antes de ingresar' }, 403)
  }

  // Lockout check
  if (customer.lockedUntil && new Date(customer.lockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(customer.lockedUntil).getTime() - Date.now()) / 60000)
    return c.json({ ok: false, error: `Cuenta bloqueada. Intenta en ${mins} minutos.` }, 429)
  }

  const valid = await verifyPassword(password, customer.passwordHash)
  if (!valid) {
    const attempts = (customer.failedAttempts ?? 0) + 1
    const patch: Record<string, unknown> = { failedAttempts: attempts }
    if (attempts >= 5) patch.lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
    await db.update(customers).set(patch).where(eq(customers.id, customer.id))
    return c.json({ ok: false, error: 'Correo o contraseña incorrectos' }, 401)
  }

  await db.update(customers)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(customers.id, customer.id))

  const ip        = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')
  const userAgent = c.req.header('User-Agent')
  const token     = await createCustomerSession(c.env, customer.id, { ip, userAgent })

  setCookie(c, CUSTOMER_COOKIE, token, COOKIE_OPTS)

  return c.json({
    ok:                true,
    mustChangePassword: customer.mustChangePassword,
    customer: { id: customer.id, name: customer.name, email: customer.email },
  })
})

// POST /api/customer/logout
router.post('/logout', async (c) => {
  const token = getCookie(c, CUSTOMER_COOKIE)
  if (token) await revokeCustomerSession(c.env, token)
  deleteCookie(c, CUSTOMER_COOKIE, { path: '/', secure: true })
  return c.json({ ok: true })
})

// GET /api/customer/me
router.get('/me', async (c) => {
  const token = getCookie(c, CUSTOMER_COOKIE)
  if (!token) return c.json({ ok: false, customer: null }, 200)
  const customer = await validateCustomerSession(c.env, token)
  if (!customer) return c.json({ ok: false, customer: null }, 200)
  return c.json({ ok: true, customer })
})

// POST /api/customer/password-forgot
router.post('/password-forgot', async (c) => {
  const { email } = await c.req.json<{ email?: string }>()
  // Siempre responder igual (prevención de user enumeration)
  const msg = { ok: true, message: 'Si el correo está registrado, recibirás un enlace en breve.' }

  if (!email) return c.json(msg)

  const db = getDb(c.env)
  const [customer] = await db.select({ id: customers.id, name: customers.name, email: customers.email })
    .from(customers)
    .where(and(eq(customers.email, email.toLowerCase().trim())))

  if (!customer || !customer.email) return c.json(msg)

  const resetToken = generateToken()
  await db.insert(passwordResetTokens).values({
    token:      resetToken,
    customerId: customer.id,
    expiresAt:  new Date(Date.now() + 60 * 60 * 1000), // 1h
  })

  const resetUrl = `${WEB_URL}/cuenta/recuperar/${resetToken}`
  await sendEmail(c.env, {
    to:      customer.email,
    subject: 'Recupera tu contraseña — SEUL SHOP',
    html:    templatePasswordReset(customer.name, resetUrl),
  })

  return c.json(msg)
})

// POST /api/customer/password-reset
router.post('/password-reset', async (c) => {
  const { token, newPassword } = await c.req.json<{ token?: string; newPassword?: string }>()
  if (!token || !newPassword) return c.json({ ok: false, error: 'Datos incompletos' }, 400)
  if (newPassword.length < 8) return c.json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' }, 400)

  const db = getDb(c.env)
  const [row] = await db.select().from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expiresAt, new Date())))

  if (!row || row.usedAt) return c.json({ ok: false, error: 'Enlace inválido o expirado' }, 400)

  const passwordHash = await hashPassword(newPassword)
  await db.update(customers)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(customers.id, row.customerId))

  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token))

  await revokeAllCustomerSessions(c.env, row.customerId)

  return c.json({ ok: true, message: 'Contraseña actualizada. Inicia sesión nuevamente.' })
})

// POST /api/customer/password-change (requiere sesión)
router.post('/password-change', async (c) => {
  const sessionToken = getCookie(c, CUSTOMER_COOKIE)
  if (!sessionToken) return c.json({ ok: false, error: 'No autenticado' }, 401)
  const sessionCustomer = await validateCustomerSession(c.env, sessionToken)
  if (!sessionCustomer) return c.json({ ok: false, error: 'Sesión inválida' }, 401)

  const { currentPassword, newPassword } = await c.req.json<{ currentPassword?: string; newPassword?: string }>()
  if (!currentPassword || !newPassword) return c.json({ ok: false, error: 'Datos incompletos' }, 400)
  if (newPassword.length < 8) return c.json({ ok: false, error: 'Mínimo 8 caracteres' }, 400)

  const db = getDb(c.env)
  const [customer] = await db.select({ passwordHash: customers.passwordHash })
    .from(customers).where(eq(customers.id, sessionCustomer.id))

  if (!customer?.passwordHash) return c.json({ ok: false, error: 'Error' }, 500)

  const valid = await verifyPassword(currentPassword, customer.passwordHash)
  if (!valid) return c.json({ ok: false, error: 'Contraseña actual incorrecta' }, 401)

  const newHash = await hashPassword(newPassword)
  await db.update(customers)
    .set({ passwordHash: newHash, mustChangePassword: false })
    .where(eq(customers.id, sessionCustomer.id))

  return c.json({ ok: true })
})

// GET /api/customer/orders (sesión requerida)
router.get('/orders', async (c) => {
  const sessionToken = getCookie(c, CUSTOMER_COOKIE)
  if (!sessionToken) return c.json({ ok: false, error: 'No autenticado' }, 401)
  const sessionCustomer = await validateCustomerSession(c.env, sessionToken)
  if (!sessionCustomer) return c.json({ ok: false, error: 'Sesión inválida' }, 401)

  const db = getDb(c.env)

  const customerOrders = await db.select({
    id:           orders.id,
    number:       orders.number,
    status:       orders.status,
    total:        orders.total,
    deliveryMode: orders.deliveryMode,
    metroStation: orders.metroStation,
    metroSlot:    orders.metroSlot,
    dteStatus:    orders.dteStatus,
    pdfToken:     orders.pdfToken,
    createdAt:    orders.createdAt,
  })
    .from(orders)
    .where(eq(orders.customerId, sessionCustomer.id))
    .orderBy(desc(orders.createdAt))
    .limit(50)

  return c.json({ ok: true, orders: customerOrders })
})

export { router as customerAuthRouter }
