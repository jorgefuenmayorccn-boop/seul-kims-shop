import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { serve } from '@hono/node-server'
import * as crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { sql, ADMIN_EMAIL, JWT_SECRET } from './db'
import { enqueueEmail, templates } from './email-queue'
import { apiKeysController } from './controllers/api-keys'
import { validateApiKeyMiddleware } from './services/api-key.service'
import { AuthService } from './services/auth.service'
import { PasswordService } from './services/password.service'
import { requireAuthMiddleware, requireScopeMiddleware } from './middleware/auth.middleware'

// ============================================================================
// SESSION COOKIE
// ============================================================================
// IMPORTANT: this cookie must be readable by the Next.js middleware running on
// EVERY frontend subdomain (cmr.seoulshop.cl, pos.seoulshop.cl, drive.seoulshop.cl,
// seoulshop.cl) even though it is only ever *set* by this API on api.seoulshop.cl.
// A "__Host-" prefixed cookie is strictly host-only per spec — it can never carry
// a Domain attribute, so it would only ever be visible to api.seoulshop.cl itself
// and never reach the other subdomains' own server-side session checks (this was
// the root cause of the "login succeeds but the app loops back to /login" bug).
// Using a plain name + an explicit parent-domain Domain attribute shares the
// cookie across every *.seoulshop.cl subdomain instead.
const SESSION_COOKIE_NAME = 'seul_session'
function sessionCookieDomain(c: any): string | undefined {
  const origin = c.req.header('Origin') || c.req.header('Referer') || ''
  // Only scope the cookie to the apex domain in production (seoulshop.cl and its
  // subdomains). Local dev (localhost) must NOT set Domain or browsers reject the cookie.
  return origin.includes('seoulshop.cl') ? '.seoulshop.cl' : undefined
}

// ============================================================================
// APP
// ============================================================================

const app = new Hono()

const corsOptions = cors({
  origin: [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
    'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl',
    'https://seul-kims-shop.vercel.app', // Vercel preview URLs
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Apply CORS to all API endpoints
app.use('/api/*', corsOptions)

// HEALTH
app.get('/', (c) => c.json({ service: 'SEUL KING OS API v1.0' }))
app.get('/health', async (c) => {
  try {
    await sql`SELECT 1`
    return c.json({ ok: true, status: 'healthy', db: 'connected' })
  } catch (e) {
    return c.json({ ok: false, status: 'degraded' }, 503)
  }
})

// DIAGNOSTIC - Simple test without DB dependency
app.get('/diagnostic', (c) => {
  return c.json({
    timestamp: new Date().toISOString(),
    service: 'SEUL KING OS API v1.0',
    status: 'online',
    cors: 'enabled',
    testUser: 'founder@seoulshop.cl',
    fallbackAuth: 'available',
    message: 'API is responding. If login fails, it\'s a database issue, not connectivity.'
  })
})

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

// Auto-run migrations on startup
async function runMigrationsIfNeeded() {
  try {
    // Check if must_change_password column exists
    const result = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'must_change_password'
    `

    if (result.length === 0) {
      console.log('🔄 Running migration 0014...')

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true
      `
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP
      `
      await sql`
        CREATE TABLE IF NOT EXISTS staff_password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS staff_pwd_reset_user_idx ON staff_password_reset_tokens(user_id)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS staff_pwd_reset_token_idx ON staff_password_reset_tokens(token)
      `
      console.log('✅ Migration 0014 applied')
    }

    // 0015: Rate limiting table
    const rateLimitTableExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'login_attempts' AND column_name = 'email'
    `

    if (rateLimitTableExists.length === 0) {
      console.log('🔄 Running migration 0015 (rate limiting)...')

      await sql`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          success BOOLEAN NOT NULL,
          attempted_at TIMESTAMP DEFAULT NOW(),
          ip_address VARCHAR(45),
          user_agent TEXT
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts(email, attempted_at DESC)
      `
      console.log('✅ Migration 0015 applied')
    }
  } catch (e) {
    console.warn('⚠️  Migration check failed (OK if already applied):', e)
  }
}

// Auto-seed real users - IDEMPOTENT: only create + email users that don't exist yet.
// IMPORTANT: Once a user exists, redeploys must NOT touch their password.
// Recreating on every startup invalidates credentials the user already received by email.
async function seedRealUsersIfNeeded() {
  try {
    // One-time cleanup: wrong email domain used in earlier seed (ceojorge@gmail.com
    // should have been ceojorge@verticeproductions.com). Remove the incorrect record
    // so the idempotent seed below creates the correct one fresh.
    await sql`DELETE FROM users WHERE email = 'ceojorge@gmail.com'`

    const REAL_USERS = [
      { email: 'ceojorge@verticeproductions.com', name: 'Jorge Fuenmayor', role: 'owner' },
      { email: 'marioulloa22@verticeproductions.com', name: 'Mario Ulloa', role: 'staff' },
      { email: 'jorgefuenmayor.ccn@gmail.com', name: 'Jorge (Delivery)', role: 'delivery' },
    ]

    const existing = await sql`SELECT email FROM users WHERE email IN ${sql(REAL_USERS.map(u => u.email))}`
    const existingEmails = new Set(existing.map((r: any) => r.email))
    const missingUsers = REAL_USERS.filter(u => !existingEmails.has(u.email))

    if (missingUsers.length === 0) {
      return // All users already exist - never touch their credentials on redeploy
    }

    console.log('🔄 Seeding missing users and sending initial credentials...')

    for (const user of missingUsers) {
      const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
      const passwordHash = PasswordService.hashPassword(tempPassword)

      await sql`
        INSERT INTO users (email, password_hash, name, role, is_active, must_change_password)
        VALUES (${user.email}, ${passwordHash}, ${user.name}, ${user.role}, true, true)
        ON CONFLICT (email) DO NOTHING
      `

      try {
        await enqueueEmail(
          user.email,
          '🎉 ¡Bienvenido a SEUL KING OS v1.0!',
          templates.initialCredentials({
            email: user.email,
            password: tempPassword,
            name: user.name,
            role: user.role,
          }),
          'welcome'
        )
        console.log(`  ✓ ${user.email}`)
      } catch (emailError) {
        console.error(`  ⚠️  ${user.email} — Email error:`, emailError)
      }
    }
    console.log('✅ Missing users seeded + emails enqueued\n')
  } catch (e) {
    console.error('❌ User seed failed:', e)
  }
}

// DEPRECATED: Hardcoded test users removed for security
// If DB fails, login fails - no fallback authentication (correct behavior)
// Use seedRealUsersIfNeeded() instead to create test users

// Rate limiting helper: check if user is blocked
async function checkRateLimit(email: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    // Get last 5 login attempts in last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    const attempts = await sql`
      SELECT success FROM login_attempts
      WHERE email = ${email} AND attempted_at > ${fifteenMinutesAgo}
      ORDER BY attempted_at DESC LIMIT 5
    `

    // Block if 5+ failed attempts
    const failedCount = attempts.filter((a: any) => !a.success).length
    if (failedCount >= 5) {
      return { allowed: false, retryAfter: 15 }
    }

    return { allowed: true }
  } catch (e) {
    // If rate limit table doesn't exist yet, allow login
    return { allowed: true }
  }
}

// Record login attempt
async function recordLoginAttempt(email: string, success: boolean, c: any) {
  try {
    await sql`
      INSERT INTO login_attempts (email, success, ip_address, user_agent)
      VALUES (${email}, ${success}, ${c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip')}, ${c.req.header('user-agent')})
    `
  } catch (e) {
    // Silently fail - don't break login if logging fails
  }
}

// AUTH LOGIN HANDLER (shared by both /auth/login and /api/auth/login)
async function handleLogin(c: any) {
  let body: any = {}
  let email: string = ''
  let password: string = ''

  try {
    const text = await c.req.text()
    body = JSON.parse(text)
    email = (body.email || '').toLowerCase()
    password = body.password || ''
  } catch (e) {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (!email || !password) {
    return c.json({ error: 'Missing email or password' }, 400)
  }

  // Check rate limiting
  const rateLimit = await checkRateLimit(email)
  if (!rateLimit.allowed) {
    await recordLoginAttempt(email, false, c)
    return c.json({ error: `Too many failed attempts. Try again in ${rateLimit.retryAfter} minutes.` }, 429)
  }

  // Authenticate against database only - no fallback
  const result = await AuthService.login(email, password, JWT_SECRET)

  // Record attempt (success or failure)
  await recordLoginAttempt(email, result.ok, c)

  if (!result.ok) {
    return c.json({ error: result.error || 'Invalid credentials' }, result.status || 401)
  }

  // Obtener must_change_password de la BD
  let mustChangePassword = false
  try {
    const userRows = await sql`
      SELECT must_change_password FROM users WHERE email = ${email}
    `
    if (userRows && userRows.length > 0) {
      mustChangePassword = userRows[0].must_change_password || false
    }
  } catch (e) {
    // Si falla, asumir false
    mustChangePassword = false
  }

  // Setear cookie de sesión (httpOnly, Secure, SameSite=Lax, compartida en *.seoulshop.cl)
  setCookie(c, SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 604800, // 7 days
    domain: sessionCookieDomain(c),
  })

  const response = c.json({
    ...result,
    mustChangePassword,
  })

  // CORS headers: reflect origin if in whitelist, else use first origin
  const origin = c.req.header('Origin') || 'https://cmr.seoulshop.cl'
  const allowedOrigins = [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
    'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl',
    'https://seul-kims-shop.vercel.app',
  ]
  const responseOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[3]
  response.headers.set('Access-Control-Allow-Origin', responseOrigin)
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')

  return response
}

// Register both routes (backward compatibility + NextJS apps)
app.post('/auth/login', handleLogin)
app.post('/api/auth/login', handleLogin)

// OPTIONS preflight (both routes) — MUST reflect real origin, not '*',
// because the login fetch uses credentials: 'include'. Per CORS spec,
// Allow-Origin: '*' combined with credentials is rejected by browsers,
// causing the fetch to fail silently (or hang) before the POST is even sent.
const ALLOWED_ORIGINS = [
  'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
  'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
  'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl',
  'https://seul-kims-shop.vercel.app',
]
function loginPreflightHeaders(c: any) {
  const origin = c.req.header('Origin')
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[7]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}
app.options('/auth/login', (c) => c.json(null, 200, loginPreflightHeaders(c)))
app.options('/api/auth/login', (c) => c.json(null, 200, loginPreflightHeaders(c)))

// GET /auth/me y /api/auth/me — Get current user
async function handleGetMe(c: any) {
  // Try Authorization header first, then fallback to cookie
  let token: string | undefined
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = getCookie(c, SESSION_COOKIE_NAME)
  }

  if (!token) {
    return c.json({ error: 'Missing token' }, 401)
  }

  const verified = AuthService.verifyToken(token, JWT_SECRET)

  if (!verified.ok) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  const decoded = verified.decoded as any
  return c.json({
    user: {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    }
  })
}

app.get('/auth/me', handleGetMe)
app.get('/api/auth/me', handleGetMe)

// POST /auth/logout y /api/auth/logout
async function handleLogout(c: any) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    domain: sessionCookieDomain(c),
  })
  const response = c.json({ ok: true })
  const origin = c.req.header('Origin')
  response.headers.set('Access-Control-Allow-Origin', origin || 'https://cmr.seoulshop.cl')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

app.post('/auth/logout', handleLogout)
app.post('/api/auth/logout', handleLogout)

// POST /api/auth/change-password — Cambiar contraseña (autenticado, primer-login obligatorio)
async function handleChangePassword(c: any) {
  // 1. Verificar autenticación
  let token: string | undefined
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = getCookie(c, SESSION_COOKIE_NAME)
  }

  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  const verified = AuthService.verifyToken(token, JWT_SECRET)
  if (!verified.ok) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  const decoded = verified.decoded as any
  const userId = decoded.email // Usamos email como ID

  // 2. Parsear body
  let body: any = {}
  try {
    const text = await c.req.text()
    body = JSON.parse(text)
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { oldPassword, newPassword, confirmPassword } = body
  if (!oldPassword || !newPassword || !confirmPassword) {
    return c.json({ error: 'Missing password fields' }, 400)
  }

  if (newPassword !== confirmPassword) {
    return c.json({ error: 'Passwords do not match' }, 400)
  }

  // 3. Validar complejidad de nueva contraseña (mín. 8 chars, 1 mayúscula, 1 número)
  if (newPassword.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }
  if (!/[A-Z]/.test(newPassword)) {
    return c.json({ error: 'Password must contain uppercase letter' }, 400)
  }
  if (!/[0-9]/.test(newPassword)) {
    return c.json({ error: 'Password must contain number' }, 400)
  }

  try {
    // 4. Obtener usuario y verificar contraseña anterior
    const rows = await sql`
      SELECT id, password_hash, email, name FROM users WHERE email = ${userId}
    `

    if (!rows || rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const user = rows[0]
    const isOldPasswordValid = PasswordService.verifyPassword(oldPassword, user.password_hash)

    if (!isOldPasswordValid) {
      return c.json({ error: 'Current password is incorrect' }, 401)
    }

    // 5. Hashear nueva contraseña
    const newPasswordHash = PasswordService.hashPassword(newPassword)

    // 6. Actualizar en BD
    await sql`
      UPDATE users
      SET password_hash = ${newPasswordHash},
          password_changed_at = NOW(),
          must_change_password = false
      WHERE email = ${userId}
    `

    // 7. Enviar email de confirmación
    await enqueueEmail(
      user.email,
      '✅ Contraseña Cambiada con Éxito',
      templates.passwordChangedSuccess({
        name: user.name,
        email: user.email,
        timestamp: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })
      }),
      'password-reset'
    )

    return c.json({
      ok: true,
      message: 'Password changed successfully. Confirmation email sent.',
      user: { email: user.email, name: user.name }
    })
  } catch (error: any) {
    console.error('❌ Error en change-password:', error)
    return c.json({ error: error.message || 'Failed to change password' }, 500)
  }
}

app.post('/api/auth/change-password', handleChangePassword)

// ============================================================================
// B2C ENDPOINTS (7 emails)
// ============================================================================

// Proteger endpoints de órdenes — requieren autenticación
app.use('/api/orders*', requireAuthMiddleware)
app.use('/api/orders*', requireScopeMiddleware(['orders:write']))

// POST /api/orders
app.post('/api/orders', async (c) => {
  try {
    const { customer_email, customer_name, items, total, delivery_mode } = await c.req.json()
    if (!customer_email || !items || !total) return c.json({ error: 'Missing fields' }, 400)

    const order_number = Math.floor(Math.random() * 100000)
    const [order] = await sql`
      INSERT INTO orders (number, channel, delivery_mode, status, subtotal, total)
      VALUES (${order_number}, 'web', ${delivery_mode || 'delivery'}, 'nueva', ${total}, ${total})
      RETURNING id, number
    `

    // Email confirmación
    const queueIdConfirmation = await enqueueEmail(
      customer_email,
      `✅ Orden Confirmada #${order.number}`,
      templates.orderConfirmation(order),
      'order-confirmation'
    )

    // Email admin
    const queueIdAdminNotice = await enqueueEmail(
      ADMIN_EMAIL,
      `📦 Nueva Orden #${order.number}`,
      `<p>Nueva orden de ${customer_name}. Total: $${total}</p>`,
      'order-confirmation'
    )

    const queue_ids = [queueIdConfirmation, queueIdAdminNotice]

    // Alerta de pedido grande
    if (Number(total) >= 2_000_000) {
      const queueIdLargeOrder = await enqueueEmail(
        ADMIN_EMAIL,
        `⚠️ Pedido grande: $${Number(total).toLocaleString('es-CL')}`,
        templates.largeOrderAlert(order),
        'large-order-alert'
      )
      queue_ids.push(queueIdLargeOrder)
    }

    console.log(`✅ Order created: #${order.number}`)
    return c.json({ ok: true, order_id: order.id, order_number: order.number, queue_ids })
  } catch (err) {
    console.error('Order error:', err)
    return c.json({ error: 'Error creating order' }, 500)
  }
})

// POST /api/orders/:id/status
app.post('/api/orders/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const { status, customer_email, eta } = await c.req.json()
    if (!status) return c.json({ error: 'Missing status' }, 400)

    const [order] = await sql`
      UPDATE orders SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, number
    `

    if (!order) return c.json({ error: 'Order not found' }, 404)

    let queue_id: string | undefined
    if (customer_email) {
      // order_status enum real: 'nueva' | 'preparando' | 'lista' | 'en_ruta' | 'entregada' | 'cancelada'
      const emailType = status === 'en_ruta' ? 'order-shipped'
        : status === 'entregada' ? 'order-delivered'
        : 'delivery-update'
      queue_id = await enqueueEmail(
        customer_email,
        `Actualización: Orden #${order.number}`,
        templates.orderStatus(order, status, eta),
        emailType
      )
    }

    console.log(`✅ Order status: #${order.number} → ${status}`)
    return c.json({ ok: true, status, queue_id })
  } catch (err) {
    console.error('Status error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/deliveries/:id/photo
app.post('/api/deliveries/:id/photo', async (c) => {
  try {
    const { id } = c.req.param()
    const { customer_email } = await c.req.json()

    const [assignment] = await sql`SELECT * FROM delivery_assignments WHERE id = ${id}`
    if (!assignment) return c.json({ error: 'Delivery not found' }, 404)

    // Save pod
    await sql`
      INSERT INTO delivery_pods (assignment_id, r2_key, captured_at, uploaded_at)
      VALUES (${id}, ${'pods/' + assignment.order_id + '/photo.jpg'}, NOW(), NOW())
    `

    // Update delivery & order
    await sql`UPDATE delivery_assignments SET status = 'delivered', delivered_at = NOW() WHERE id = ${id}`
    const [order] = await sql`UPDATE orders SET status = 'entregada' WHERE id = ${assignment.order_id} RETURNING number`

    let queue_id: string | undefined
    if (customer_email) {
      queue_id = await enqueueEmail(
        customer_email,
        `✅ Entregado: Orden #${order.number}`,
        templates.deliveryPhoto(order),
        'order-delivered'
      )
    }

    console.log(`✅ Delivery completed`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    console.error('Photo error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// B2B ENDPOINTS (3 emails)
// ============================================================================

// Proteger endpoints B2B — requieren autenticación
app.use('/api/b2b*', requireAuthMiddleware)
app.use('/api/b2b*', requireScopeMiddleware(['orders:write']))

// POST /api/b2b/quotes
app.post('/api/b2b/quotes', async (c) => {
  try {
    const { company_id, buyer_name, buyer_email, items, total, valid_days } = await c.req.json()
    if (!company_id || !buyer_email) return c.json({ error: 'Missing fields' }, 400)

    const quote_number = Math.floor(Math.random() * 100000)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (valid_days || 7))

    await sql`
      INSERT INTO b2b_quotes (number, company_id, buyer_name, buyer_email, status, items, subtotal, total, valid_until_at, sent_at)
      VALUES (${quote_number}, ${company_id}, ${buyer_name}, ${buyer_email}, 'sent', ${JSON.stringify(items)}, ${total}, ${total}, ${validUntil}, NOW())
    `

    const queueIdBuyer = await enqueueEmail(
      buyer_email,
      `📋 Cotización #${quote_number}`,
      templates.quote({ number: quote_number, total, validUntilAt: validUntil.toLocaleDateString('es-CL') }),
      'quote-sent'
    )

    const queueIdAdmin = await enqueueEmail(
      ADMIN_EMAIL,
      `📋 Cotización #${quote_number} enviada`,
      `<p>Cotización enviada a ${buyer_email}</p>`,
      'quote-sent'
    )

    console.log(`✅ Quote: #${quote_number}`)
    return c.json({ ok: true, quote_number, queue_ids: [queueIdBuyer, queueIdAdmin] })
  } catch (err) {
    console.error('Quote error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/b2b/quotes/:id/accept
app.post('/api/b2b/quotes/:id/accept', async (c) => {
  try {
    const { id } = c.req.param()
    const [quote] = await sql`
      UPDATE b2b_quotes SET status = 'accepted', accepted_at = NOW()
      WHERE id = ${id}
      RETURNING number, buyer_email
    `

    if (!quote) return c.json({ error: 'Quote not found' }, 404)

    const queue_id = await enqueueEmail(
      quote.buyer_email,
      `✅ Cotización #${quote.number} Aceptada`,
      `<p>Tu cotización ha sido aceptada. Procederemos con la orden.</p>`,
      'quote-accepted'
    )

    console.log(`✅ Quote accepted`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/b2b/quotes/:id/reject
app.post('/api/b2b/quotes/:id/reject', async (c) => {
  try {
    const { id } = c.req.param()
    const { reason } = await c.req.json()
    const [quote] = await sql`
      UPDATE b2b_quotes SET status = 'rejected', rejected_at = NOW(), rejection_reason = ${reason}
      WHERE id = ${id}
      RETURNING number, buyer_name
    `

    if (!quote) return c.json({ error: 'Quote not found' }, 404)

    const queue_id = await enqueueEmail(
      ADMIN_EMAIL,
      `❌ Cotización #${quote.number} Rechazada`,
      `<p>Rechazada por ${quote.buyer_name}. Razón: ${reason || 'No especificada'}</p>`,
      'quote-rejected'
    )

    console.log(`✅ Quote rejected`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// DRIVER ENDPOINTS (2 emails)
// ============================================================================

// Proteger endpoints de logística — requieren autenticación
app.use('/api/deliveries*', requireAuthMiddleware)
app.use('/api/deliveries*', requireScopeMiddleware(['orders:write']))

// POST /api/deliveries/assign
app.post('/api/deliveries/assign', async (c) => {
  try {
    const { assignment_id, driver_id, driver_email } = await c.req.json()
    if (!assignment_id || !driver_id) return c.json({ error: 'Missing fields' }, 400)

    await sql`
      UPDATE delivery_assignments
      SET driver_id = ${driver_id}, status = 'assigned', assigned_at = NOW()
      WHERE id = ${assignment_id}
    `

    let queue_id: string | undefined
    if (driver_email) {
      queue_id = await enqueueEmail(
        driver_email,
        `🚚 Nueva Entrega Asignada`,
        templates.deliveryAssigned(),
        'delivery-assigned'
      )
    }

    console.log(`✅ Delivery assigned`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/deliveries/:id/status
app.post('/api/deliveries/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const { status } = await c.req.json()

    await sql`UPDATE delivery_assignments SET status = ${status} WHERE id = ${id}`

    let queue_id: string | undefined
    if (status === 'failed') {
      queue_id = await enqueueEmail(
        ADMIN_EMAIL,
        'Entrega fallida — acción requerida',
        templates.deliveryFailed(id),
        'delivery-failed'
      )
    }

    console.log(`✅ Delivery status: ${status}`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// API KEY MIDDLEWARE & ENDPOINTS
// ============================================================================

app.use('/api/admin/*', validateApiKeyMiddleware())

// API Key Management (Admin)
app.post('/api/admin/api-keys', (c) => apiKeysController.create(c))
app.get('/api/admin/api-keys', (c) => apiKeysController.list(c))
app.post('/api/admin/api-keys/:id/revoke', (c) => apiKeysController.revoke(c))

// Admin: Seed test users (development only)
app.post('/api/admin/seed/users', async (c) => {
  if (process.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Only available in development' }, 403)
  }

  const TEST_USERS = [
    { email: 'founder@seoulshop.cl', password: 'Seoul2025!Founder', name: 'Fundador Seoul Kims', role: 'owner' },
    { email: 'gerente@seoulshop.cl', password: 'Seoul2025!Gerente', name: 'Gerente Operacional', role: 'admin' },
    { email: 'repartidor.test@seoulshop.cl', password: 'Seoul2025!Repartidor', name: 'Repartidor de Prueba', role: 'delivery' },
  ]

  try {
    const results = []
    for (const user of TEST_USERS) {
      const passwordHash = PasswordService.hashPassword(user.password)
      const existing = await sql`SELECT id FROM users WHERE email = ${user.email}`

      if (existing.length > 0) {
        results.push({ email: user.email, status: 'exists' })
        continue
      }

      const [inserted] = await sql`
        INSERT INTO users (email, password_hash, name, role, is_active)
        VALUES (${user.email}, ${passwordHash}, ${user.name}, ${user.role}, true)
        RETURNING id, email, name, role
      `

      results.push({ email: inserted.email, status: 'created', id: inserted.id })
    }

    return c.json({ ok: true, results })
  } catch (err: any) {
    console.error('Seed error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ============================================================================
// LEGACY ENDPOINTS
// ============================================================================

app.get('/api/email-queue/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const [record] = await sql`SELECT * FROM email_queue WHERE id = ${id}`
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json(record)
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, firstName, lastName } = await c.req.json()
    if (!email || !password) return c.json({ error: 'Missing fields' }, 400)

    const fullName = lastName ? `${firstName} ${lastName}` : firstName

    const queueIdAdmin = await enqueueEmail(
      ADMIN_EMAIL,
      `✨ Nuevo Usuario: ${fullName}`,
      `<p>Email: ${email}</p>`,
      'user-created'
    )

    const queueIdWelcome = await enqueueEmail(
      email,
      `¡Bienvenido a Seoul Shop!`,
      `<p>¡Hola ${fullName}! Bienvenido.</p>`,
      'welcome'
    )

    const token = jwt.sign({ userId: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '24h' })
    return c.json({ ok: true, token, queue_ids: [queueIdAdmin, queueIdWelcome] })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// STARTUP
// ============================================================================

console.log(`🚀 SEUL API v1.0 (Node.js + Railway) — Redeploy after Neon Scale upgrade`)
console.log(`✅ Admin: ${ADMIN_EMAIL}`)

// Validate DB connection on startup (non-blocking)
sql`SELECT 1`
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('⚠️ Database connection warning:', err.message))

// Run migrations and seed users
Promise.all([
  runMigrationsIfNeeded(),
  seedRealUsersIfNeeded(),
]).catch(e => console.error('⚠️ Startup initialization error:', e))

// Listen for incoming HTTP requests (Railway/Node)
const port = Number(process.env.PORT) || 8080
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`✅ Listening on http://0.0.0.0:${info.port}`)
})

export default app
