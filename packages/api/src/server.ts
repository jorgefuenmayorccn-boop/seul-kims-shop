import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '@seul/db/schema'
import { Resend } from 'resend'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import { sign, verify } from 'jsonwebtoken'

const app = new Hono()
const resend = new Resend(process.env.RESEND_API_KEY)
const JWT_SECRET = process.env.JWT_SECRET || 'seul-king-os-secret-dev-only'

app.use('*', logger())
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
    'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl'],
  credentials: true,
}))

const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost/seul_dev',
  { ssl: 'require', max: 20, idle_timeout: 30, max_lifetime: 3600 })
const db = drizzle(sql, { schema })

const generateToken = () => crypto.randomBytes(32).toString('hex')
const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 12)
const verifyPassword = (pwd: string, hash: string) => bcrypt.compareSync(pwd, hash)
const createJWT = (userId: string, role: string) => sign({ userId, role }, JWT_SECRET, { expiresIn: '24h' })
const verifyJWT = (token: string) => {
  try {
    return verify(token, JWT_SECRET) as any
  } catch { return null }
}

// Auth middleware
const authMiddleware = async (c: any, next: any) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = auth.slice(7)
  const payload = await verifyJWT(token)
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  c.set('user', payload)
  await next()
}

// Health
app.get('/', (c) => c.json({ service: 'SEUL KING OS API', version: '1.0.0', env: process.env.NODE_ENV || 'production' }))
app.get('/health', async (c) => {
  try {
    await sql`SELECT 1`
    return c.json({ ok: true, status: 'healthy', db: 'connected' })
  } catch (error: any) {
    return c.json({ ok: false, status: 'degraded', error: error.message }, 503)
  }
})

// ==================== AUTH ====================

// LOGIN
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password, role } = await c.req.json()
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

    if (role === 'admin' || role === 'owner') {
      const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) })
      if (!user || !verifyPassword(password, user.passwordHash)) return c.json({ error: 'Invalid credentials' }, 401)
      if (!user.isActive) return c.json({ error: 'Account disabled' }, 403)

      const token = createJWT(user.id, user.role)
      await db.insert(schema.sessions).values({
        id: generateToken(),
        userId: user.id,
        expiresAt: new Date(Date.now() + 604800000),
        userAgent: c.req.header('user-agent'),
        ip: c.req.header('x-forwarded-for') || 'unknown',
      })

      return c.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
    } else {
      const customer = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) })
      if (!customer || !verifyPassword(password, customer.passwordHash)) return c.json({ error: 'Invalid credentials' }, 401)

      const token = createJWT(customer.id, 'customer')
      await db.insert(schema.customerSessions).values({
        id: generateToken(),
        customerId: customer.id,
        expiresAt: new Date(Date.now() + 604800000),
        userAgent: c.req.header('user-agent'),
        ip: c.req.header('x-forwarded-for') || 'unknown',
      })

      return c.json({ ok: true, token, customer: { id: customer.id, email: customer.email, firstName: customer.firstName } })
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// REGISTER (B2C)
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, firstName, lastName } = await c.req.json()
    if (!email || !password || !firstName) return c.json({ error: 'Missing required fields' }, 400)

    const existing = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) })
    if (existing) return c.json({ error: 'Email already registered' }, 409)

    const customer = await db.insert(schema.customers).values({
      email,
      passwordHash: hashPassword(password),
      firstName,
      lastName: lastName || '',
      emailVerified: false,
    }).returning()

    const verificationToken = generateToken()
    await db.insert(schema.emailVerificationTokens).values({
      token: verificationToken,
      customerId: customer[0].id,
      expiresAt: new Date(Date.now() + 86400000),
    })

    await resend.emails.send({
      from: 'noreply@seoulshop.cl',
      to: email,
      subject: '¡Bienvenido a Seoul Kims! Verifica tu correo',
      html: `<h2>¡Hola ${firstName}!</h2><p>Verifica tu correo haciendo click <a href="${process.env.APP_URL}/verify?token=${verificationToken}">aquí</a></p><p>El link expira en 24h.</p>`,
    })

    const token = createJWT(customer[0].id, 'customer')
    return c.json({ ok: true, token, customer: { id: customer[0].id, email: customer[0].email, firstName: customer[0].firstName } })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// GET ME
app.get('/api/auth/me', authMiddleware, async (c) => {
  const user = c.get('user')
  const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, user.userId) })
  if (customer) return c.json({ ok: true, customer })

  const u = await db.query.users.findFirst({ where: eq(schema.users.id, user.userId) })
  return c.json({ ok: true, user: u })
})

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json()
    if (!email) return c.json({ error: 'Email required' }, 400)

    const customer = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) })
    if (!customer) return c.json({ ok: true }) // No leak

    const resetToken = generateToken()
    await db.insert(schema.passwordResetTokens).values({
      token: resetToken,
      customerId: customer.id,
      expiresAt: new Date(Date.now() + 3600000),
    })

    await resend.emails.send({
      from: 'noreply@seoulshop.cl',
      to: email,
      subject: 'Recupera tu contraseña en Seoul Kims',
      html: `<h2>Recuperar contraseña</h2><p>Haz click <a href="${process.env.APP_URL}/reset?token=${resetToken}">aquí</a> para cambiar tu contraseña.</p><p>El link expira en 1 hora.</p>`,
    })

    return c.json({ ok: true })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// RESET PASSWORD
app.post('/api/auth/reset-password', async (c) => {
  try {
    const { token, password } = await c.req.json()
    if (!token || !password) return c.json({ error: 'Missing fields' }, 400)

    const resetToken = await db.query.passwordResetTokens.findFirst({ where: eq(schema.passwordResetTokens.token, token) })
    if (!resetToken || new Date() > resetToken.expiresAt || resetToken.usedAt) return c.json({ error: 'Invalid token' }, 401)

    await db.update(schema.customers).set({ passwordHash: hashPassword(password) }).where(eq(schema.customers.id, resetToken.customerId))
    await db.update(schema.passwordResetTokens).set({ usedAt: new Date() }).where(eq(schema.passwordResetTokens.token, token))

    return c.json({ ok: true })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// VERIFY EMAIL
app.post('/api/auth/verify-email', async (c) => {
  try {
    const { token } = await c.req.json()
    if (!token) return c.json({ error: 'Token required' }, 400)

    const verifyToken = await db.query.emailVerificationTokens.findFirst({ where: eq(schema.emailVerificationTokens.token, token) })
    if (!verifyToken || new Date() > verifyToken.expiresAt || verifyToken.usedAt) return c.json({ error: 'Invalid token' }, 401)

    await db.update(schema.customers).set({ emailVerified: true }).where(eq(schema.customers.id, verifyToken.customerId))
    await db.update(schema.emailVerificationTokens).set({ usedAt: new Date() }).where(eq(schema.emailVerificationTokens.token, token))

    return c.json({ ok: true })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// LOGOUT
app.post('/api/auth/logout', authMiddleware, async (c) => {
  const user = c.get('user')
  await db.delete(schema.customerSessions).where(eq(schema.customerSessions.customerId, user.userId))
  return c.json({ ok: true })
})

// ==================== PRODUCTS ====================
app.get('/api/products', async (c) => {
  try {
    const products = await db.query.products.findMany()
    return c.json({ ok: true, data: products })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ==================== ORDERS ====================
app.post('/api/orders', authMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    return c.json({ ok: true, orderId: 'pending' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

const port = parseInt(process.env.PORT || '3000')
console.log(`🚀 SEUL API port ${port}`)

serve({ fetch: app.fetch, port }, async () => {
  try {
    await sql`SELECT 1`
    console.log('✅ Database connected')
  } catch (e) {
    console.error('Database warning:', e)
  }
})
