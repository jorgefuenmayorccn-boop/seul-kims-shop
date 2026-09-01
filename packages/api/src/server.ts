import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { serve } from '@hono/node-server'
import * as crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { sql, ADMIN_EMAIL, JWT_SECRET, CUSTOMER_JWT_SECRET } from './db'
import { enqueueEmail, templates } from './email-queue'
import { apiKeysController } from './controllers/api-keys'
import { validateApiKeyMiddleware } from './services/api-key.service'
import { AuthService } from './services/auth.service'
import { PasswordService } from './services/password.service'
import { requireAuthMiddleware, requireScopeMiddleware, requireSession, getOptionalSession, requireCustomerSession, getOptionalCustomerSession } from './middleware/auth.middleware'
import { emitPosEvent, emitDeliveryEvent, onPosEvent, onDeliveryEvent } from './sse-broadcaster'

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

// CUSTOMER session cookie (S09, Fase 3) — deliberately a DIFFERENT name from
// SESSION_COOKIE_NAME (staff) so the two can never collide or be confused, and
// signed with CUSTOMER_JWT_SECRET (see db.ts) so a customer token is
// cryptographically invalid if replayed against a staff endpoint or vice versa.
// Same NOT-"__Host-" + Domain=.seoulshop.cl pattern as the staff cookie above —
// that prefix is strictly host-only per spec and was the root cause of the
// original cross-subdomain login bug fixed in Fase 0; not repeating it here.
const CUSTOMER_SESSION_COOKIE_NAME = 'seul_customer_session'

// Public storefront base URL — used to build links inside customer-facing
// emails (password reset, welcome). Distinct from the staff panel's
// cmr.seoulshop.cl links used in the staff email templates.
const CUSTOMER_WEB_URL = process.env.CUSTOMER_WEB_URL || 'https://seoulshop.cl'

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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

    // 0016: Generic rate limiting table (S02, bloqueador P0 #3) — same pattern as
    // login_attempts (0015) above, generalized to (bucket_key, action) pairs so any
    // write endpoint can rate-limit per user-or-IP without a KV/Redis dependency.
    const genericRateLimitTableExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'rate_limit_events' AND column_name = 'bucket_key'
    `

    if (genericRateLimitTableExists.length === 0) {
      console.log('🔄 Running migration 0016 (generic rate limiter)...')

      await sql`
        CREATE TABLE IF NOT EXISTS rate_limit_events (
          id SERIAL PRIMARY KEY,
          bucket_key VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS rate_limit_events_bucket_idx
        ON rate_limit_events(bucket_key, action, created_at DESC)
      `
      console.log('✅ Migration 0016 applied')
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

// Generic rate limiter (S02, bloqueador P0 #3 — replaces the KV-store TODO at
// auth.middleware.ts:160 with the same Postgres pattern as checkRateLimit/
// recordLoginAttempt above, generalized to any (bucket, action) pair). No new
// dependency (no Redis/Upstash/KV) — reuses the `sql` tag already in scope and
// the `rate_limit_events` table created by migration 0016.
//
// Identifier precedence: explicit `identifier` param (e.g. an authenticated
// user's id) > JWT session set by requireAuthMiddleware (c.get('user')) >
// API-key auth set by the same middleware (c.get('auth').userId) > client IP.
// Fails OPEN on DB error, matching checkRateLimit's posture — a rate-limit
// outage must never block legitimate traffic.
async function checkAndRecordRateLimit(
  c: any,
  action: string,
  opts: { limit: number; windowMinutes: number },
  identifier?: string
): Promise<{ allowed: boolean; retryAfterMinutes?: number }> {
  try {
    const jwtUser = c.get('user')
    const apiKeyAuth = c.get('auth')
    const bucketKey =
      identifier ||
      jwtUser?.id ||
      apiKeyAuth?.userId ||
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for') ||
      'unknown'

    const windowStart = new Date(Date.now() - opts.windowMinutes * 60 * 1000)
    const rows = await sql`
      SELECT count(*) AS n FROM rate_limit_events
      WHERE bucket_key = ${bucketKey} AND action = ${action} AND created_at > ${windowStart}
    `
    const count = Number(rows[0]?.n ?? 0)
    if (count >= opts.limit) {
      return { allowed: false, retryAfterMinutes: opts.windowMinutes }
    }

    await sql`INSERT INTO rate_limit_events (bucket_key, action) VALUES (${bucketKey}, ${action})`
    return { allowed: true }
  } catch (e) {
    // If the table doesn't exist yet (migration race) or DB hiccups, allow the request.
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
// CUSTOMER AUTH ENDPOINTS (S09, Fase 3) — end customers (apps/web, tienda B2C
// y portal B2B comparten la misma tabla `customers` / mismo login, ver
// b2b/login/page.tsx). COMPLETAMENTE SEPARADO del auth de staff arriba: tabla
// distinta (`customers`, no `users`), cookie distinta (CUSTOMER_SESSION_COOKIE_NAME,
// no SESSION_COOKIE_NAME), secret de firma distinta (CUSTOMER_JWT_SECRET, ver
// db.ts), sin roles/RBAC (un cliente solo tiene "autenticado como este cliente
// o no"). No reutiliza AuthService.login (que consulta `users`) — lógica propia
// pero mismo servicio de hashing (PasswordService, PBKDF2-SHA256) y mismo
// verificador de token (AuthService.verifyToken, parametrizado con el secret
// distinto).
// ============================================================================

// Password complexity — misma regla que handleChangePassword (staff) arriba,
// duplicada intencionalmente (ese código tampoco la extrajo a helper) para no
// tocar el archivo de auth de staff.
function validateCustomerPasswordComplexity(password: string): string | null {
  if (!password || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula.'
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número.'
  return null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Validación de RUT chileno (dígito verificador) — usada por POST /api/b2b/registro
// (S11, Fase 3). El frontend (apps/web/.../b2b/registro/page.tsx, formatRUTInput)
// solo agrupa dígitos visualmente, no valida el DV — esta es la única validación
// real que existe hoy, igual que documenta CLAUDE.md ("validar dígito verificador
// en el frontend antes de enviar" — el frontend no lo hace, así que el backend
// es la línea de defensa real).
function isValidRUT(rutRaw: string): boolean {
  const clean = (rutRaw || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  if (!/^\d+$/.test(body)) return false
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const res = 11 - (sum % 11)
  const expectedDv = res === 11 ? '0' : res === 10 ? 'K' : String(res)
  return expectedDv === dv
}

function normalizeRUT(rutRaw: string): string {
  const clean = (rutRaw || '').replace(/[^0-9kK]/g, '').toUpperCase()
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${grouped}-${dv}`
}

// POST /api/customer/register — crea cuenta de cliente final. El formulario
// (apps/web/.../cuenta/registro/page.tsx) NO pide contraseña — igual que el
// onboarding de staff (seedRealUsersIfNeeded/initialCredentials arriba), se
// genera una contraseña temporal, se hashea, se envía por correo, y
// must_change_password queda en true para forzar el cambio en el primer login.
// Si el email ya existe como cliente "fantasma" (creado por POS/checkout de
// invitado, sin password_hash — customers.email es UNIQUE, así que un INSERT
// duplicado rompería la constraint), esta cuenta se "reclama": se actualiza esa
// misma fila en vez de crear una duplicada, preservando el historial de pedidos
// ya asociado a ese customer_id.
app.post('/api/customer/register', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const name = (body.name || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const marketingOptIn = !!body.marketingOptIn

  if (!name || !email) {
    return c.json({ ok: false, error: 'Nombre y correo son obligatorios.' }, 400)
  }
  if (!isValidEmail(email)) {
    return c.json({ ok: false, error: 'Correo electrónico inválido.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'customer:register', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const existing = await sql`
      SELECT id, password_hash FROM customers WHERE lower(email) = ${email} AND deleted_at IS NULL LIMIT 1
    `

    if (existing.length > 0 && existing[0].password_hash) {
      return c.json({ ok: false, error: 'Ya existe una cuenta con este correo. Inicia sesión.' }, 409)
    }

    const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
    const passwordHash = PasswordService.hashPassword(tempPassword)
    const marketingOptInAt = marketingOptIn ? new Date() : null

    if (existing.length > 0) {
      // Reclamar cliente "fantasma" existente (creado por POS/checkout invitado)
      await sql`
        UPDATE customers
        SET name = ${name},
            password_hash = ${passwordHash},
            must_change_password = true,
            email_verified = false,
            marketing_opt_in = ${marketingOptIn},
            marketing_opt_in_at = ${marketingOptInAt}
        WHERE id = ${existing[0].id}
      `
    } else {
      await sql`
        INSERT INTO customers (email, name, password_hash, must_change_password, email_verified, marketing_opt_in, marketing_opt_in_at, created_channel)
        VALUES (${email}, ${name}, ${passwordHash}, true, false, ${marketingOptIn}, ${marketingOptInAt}, 'web')
      `
    }

    await enqueueEmail(
      email,
      '¡Bienvenido a Seoul Shop!',
      templates.customerInitialCredentials({ email, password: tempPassword, name }),
      'welcome'
    )

    return c.json({ ok: true })
  } catch (error: any) {
    console.error('❌ Error en customer/register:', error)
    return c.json({ ok: false, error: 'No se pudo crear la cuenta.' }, 500)
  }
})

// AUTH LOGIN HANDLER — cliente (shared por /api/customer/login)
async function handleCustomerLogin(c: any) {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''

  if (!email || !password) {
    return c.json({ ok: false, error: 'Correo y contraseña son obligatorios.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'customer:login', { limit: 20, windowMinutes: 5 }, email)
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const rows = await sql`
      SELECT id, email, name, password_hash, email_verified, must_change_password, marketing_opt_in
      FROM customers
      WHERE lower(email) = ${email} AND deleted_at IS NULL
      LIMIT 1
    `

    if (rows.length === 0 || !rows[0].password_hash) {
      return c.json({ ok: false, error: 'Correo o contraseña incorrectos.' }, 401)
    }

    const customer = rows[0]
    const validPassword = PasswordService.verifyPassword(password, customer.password_hash)
    if (!validPassword) {
      return c.json({ ok: false, error: 'Correo o contraseña incorrectos.' }, 401)
    }

    // Verificación implícita del correo: si el cliente puede iniciar sesión con
    // la contraseña que le enviamos por correo, ya demostró ser dueño de ese
    // correo — no hay un endpoint separado de "click para verificar" en S09
    // (decisión de alcance documentada en SEUL_SESSION_09.md).
    const emailVerified = true
    await sql`
      UPDATE customers
      SET last_login_at = NOW(),
          email_verified = true,
          email_verified_at = COALESCE(email_verified_at, NOW())
      WHERE id = ${customer.id}
    `

    const token = jwt.sign(
      { customerId: customer.id, email: customer.email, name: customer.name, type: 'customer' },
      CUSTOMER_JWT_SECRET,
      { expiresIn: '7d' }
    )

    setCookie(c, CUSTOMER_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 604800, // 7 días
      domain: sessionCookieDomain(c),
    })

    const response = c.json({
      ok: true,
      mustChangePassword: customer.must_change_password,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        emailVerified,
        mustChangePassword: customer.must_change_password,
        marketingOptIn: customer.marketing_opt_in,
      },
    })

    // Mismo patrón que handleLogin (staff): reflejar el Origin real, nunca '*',
    // porque el fetch usa credentials: 'include'.
    const origin = c.req.header('Origin') || CUSTOMER_WEB_URL
    const responseOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : CUSTOMER_WEB_URL
    response.headers.set('Access-Control-Allow-Origin', responseOrigin)
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Allow-Credentials', 'true')

    return response
  } catch (error: any) {
    console.error('❌ Error en customer/login:', error)
    return c.json({ ok: false, error: 'Error interno.' }, 500)
  }
}

app.post('/api/customer/login', handleCustomerLogin)

// OPTIONS preflight — mismo patrón exacto que /api/auth/login (staff), lección
// explícita de esta sesión: reutilizar loginPreflightHeaders, no inventar uno
// nuevo. Es genérico (solo lee el header Origin), sirve igual para este login.
app.options('/api/customer/login', (c) => c.json(null, 200, loginPreflightHeaders(c)))

// GET /api/customer/me
app.get('/api/customer/me', async (c) => {
  const customerAuth = await requireCustomerSession(c)
  if (customerAuth instanceof Response) return customerAuth

  const rows = await sql`
    SELECT id, email, name, email_verified, must_change_password, marketing_opt_in
    FROM customers
    WHERE id = ${customerAuth.customerId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (rows.length === 0) {
    return c.json({ ok: false, error: 'Cuenta no encontrada.' }, 401)
  }

  const customer = rows[0]
  return c.json({
    ok: true,
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      emailVerified: customer.email_verified,
      mustChangePassword: customer.must_change_password,
      marketingOptIn: customer.marketing_opt_in,
    },
  })
})

// POST /api/customer/logout — mismo patrón que handleLogout (staff): borrar la
// cookie con exactamente los mismos atributos (path + domain) con los que se
// seteó, si no el browser no la borra de verdad (bug ya corregido del lado
// staff, no repetido acá).
app.post('/api/customer/logout', async (c) => {
  deleteCookie(c, CUSTOMER_SESSION_COOKIE_NAME, {
    path: '/',
    domain: sessionCookieDomain(c),
  })
  const response = c.json({ ok: true })
  const origin = c.req.header('Origin')
  response.headers.set('Access-Control-Allow-Origin', origin || CUSTOMER_WEB_URL)
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
})

// POST /api/customer/password-change — autenticado, requiere contraseña actual
app.post('/api/customer/password-change', async (c) => {
  const customerAuth = await requireCustomerSession(c)
  if (customerAuth instanceof Response) return customerAuth

  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const { currentPassword, newPassword } = body
  if (!currentPassword || !newPassword) {
    return c.json({ ok: false, error: 'Faltan campos de contraseña.' }, 400)
  }

  const complexityError = validateCustomerPasswordComplexity(newPassword)
  if (complexityError) {
    return c.json({ ok: false, error: complexityError }, 400)
  }

  try {
    const rows = await sql`
      SELECT id, email, name, password_hash FROM customers WHERE id = ${customerAuth.customerId} AND deleted_at IS NULL
    `
    if (rows.length === 0) {
      return c.json({ ok: false, error: 'Cuenta no encontrada.' }, 404)
    }

    const customer = rows[0]
    if (!PasswordService.verifyPassword(currentPassword, customer.password_hash)) {
      return c.json({ ok: false, error: 'La contraseña actual es incorrecta.' }, 401)
    }

    const newHash = PasswordService.hashPassword(newPassword)
    await sql`
      UPDATE customers
      SET password_hash = ${newHash}, must_change_password = false
      WHERE id = ${customer.id}
    `

    await enqueueEmail(
      customer.email,
      'Tu contraseña fue actualizada',
      templates.customerPasswordChanged({
        name: customer.name,
        email: customer.email,
        timestamp: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
      }),
      'password-reset'
    )

    return c.json({ ok: true })
  } catch (error: any) {
    console.error('❌ Error en customer/password-change:', error)
    return c.json({ ok: false, error: 'No se pudo cambiar la contraseña.' }, 500)
  }
})

// POST /api/customer/password-forgot — NUNCA revela si el correo existe.
// Rate-limited por email (además de la protección genérica por IP que ya da
// el fallback de checkAndRecordRateLimit) para no poder usar este endpoint
// para bombardear la bandeja de entrada de una víctima.
app.post('/api/customer/password-forgot', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  if (!email) {
    return c.json({ ok: false, error: 'Correo obligatorio.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'customer:password-forgot', { limit: 20, windowMinutes: 5 }, email)
  if (!rl.allowed) {
    // Incluso rate-limited, respondemos ok:true — el mensaje de "demasiadas
    // solicitudes" en sí mismo no revela si la cuenta existe, pero seguir
    // devolviendo el mismo 200 genérico es más simple y consistente con el
    // resto de este endpoint (nunca revelar), sin perder la protección: el
    // INSERT/envío de correo de abajo simplemente no ocurre.
    return c.json({ ok: true })
  }

  try {
    const rows = await sql`
      SELECT id, name, password_hash FROM customers
      WHERE lower(email) = ${email} AND deleted_at IS NULL
      LIMIT 1
    `

    if (rows.length > 0 && rows[0].password_hash) {
      const customer = rows[0]
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h

      await sql`
        INSERT INTO password_reset_tokens (token, customer_id, expires_at)
        VALUES (${token}, ${customer.id}, ${expiresAt})
      `

      const resetUrl = `${CUSTOMER_WEB_URL}/cuenta/recuperar/${token}`
      await enqueueEmail(
        email,
        'Recuperar tu contraseña — Seoul Shop',
        templates.customerPasswordResetLink({ name: customer.name, resetUrl }),
        'password-reset'
      )
    }
    // Si no existe o es una cuenta sin password (fantasma de POS), no hacemos
    // nada — pero respondemos exactamente igual para no revelar existencia.
  } catch (error: any) {
    console.error('❌ Error en customer/password-forgot:', error)
    // No revelar el error tampoco — mismo ok:true genérico.
  }

  return c.json({ ok: true })
})

// POST /api/customer/password-reset — con token de un solo uso (tabla
// password_reset_tokens, ya modelada en customer-auth.ts, TTL 1h)
app.post('/api/customer/password-reset', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const { token, newPassword } = body
  if (!token || !newPassword) {
    return c.json({ ok: false, error: 'Faltan campos.' }, 400)
  }

  const complexityError = validateCustomerPasswordComplexity(newPassword)
  if (complexityError) {
    return c.json({ ok: false, error: complexityError }, 400)
  }

  try {
    const rows = await sql`
      SELECT prt.customer_id, prt.expires_at, prt.used_at, c.email, c.name
      FROM password_reset_tokens prt
      JOIN customers c ON c.id = prt.customer_id
      WHERE prt.token = ${token}
      LIMIT 1
    `

    if (rows.length === 0) {
      return c.json({ ok: false, error: 'Enlace inválido o expirado.' }, 400)
    }

    const row = rows[0]
    if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return c.json({ ok: false, error: 'Enlace inválido o expirado.' }, 400)
    }

    const newHash = PasswordService.hashPassword(newPassword)
    await sql`
      UPDATE customers
      SET password_hash = ${newHash}, must_change_password = false
      WHERE id = ${row.customer_id}
    `
    await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ${token}`

    await enqueueEmail(
      row.email,
      'Tu contraseña fue actualizada',
      templates.customerPasswordChanged({
        name: row.name,
        email: row.email,
        timestamp: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
      }),
      'password-reset'
    )

    return c.json({ ok: true })
  } catch (error: any) {
    console.error('❌ Error en customer/password-reset:', error)
    return c.json({ ok: false, error: 'No se pudo restablecer la contraseña.' }, 500)
  }
})

// ============================================================================
// CUSTOMER ORDERS + PUBLIC CHECKOUT (S10, Fase 3) — catálogo + pedidos del
// cliente. Los endpoints de auth de arriba (register/login/me/logout/
// password-*) son de S09 y no se tocan en esta sesión.
// ============================================================================

// GET /api/customer/orders — pedidos del cliente autenticado
// (apps/web/.../cuenta/pedidos/page.tsx). Filtra SIEMPRE por el customerId de
// la sesión (requireCustomerSession), nunca por un parámetro — un cliente
// jamás debe poder pedir los pedidos de otro customerId adivinando/pasando un id.
app.get('/api/customer/orders', async (c) => {
  const customerAuth = await requireCustomerSession(c)
  if (customerAuth instanceof Response) return customerAuth

  try {
    const rows = await sql`
      SELECT id, number, total, status, dte_status, channel, created_at
      FROM orders
      WHERE customer_id = ${customerAuth.customerId}
      ORDER BY created_at DESC
      LIMIT 100
    `
    return c.json({
      orders: rows.map((r: any) => ({
        id: r.id,
        number: r.number,
        total: r.total,
        status: r.status,
        dteStatus: r.dte_status,
        channel: r.channel,
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('Customer orders error:', err)
    return c.json({ error: 'No se pudieron cargar tus pedidos.' }, 500)
  }
})

// POST /api/customers/guest (S10) — upsert de cliente invitado para checkout
// sin cuenta (apps/web/.../checkout/page.tsx, upsertGuestCustomer). Mismo
// patrón "reclamar fantasma" que POST /api/customer/register (S09):
// customers.email es UNIQUE, así que un email que ya existe (con o sin
// password_hash) se reutiliza en vez de duplicar — preserva el historial de
// pedidos ya asociado a ese customer_id. Público, sin sesión — a diferencia
// del registro real, no crea password_hash ni envía ningún correo.
app.post('/api/customers/guest', async (c) => {
  const rl = await checkAndRecordRateLimit(c, 'customers:guest', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const name  = (body.name || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const phone = (body.phone || '').trim() || null

  if (!name || !email) {
    return c.json({ error: 'Nombre y correo son obligatorios.' }, 400)
  }
  if (!isValidEmail(email)) {
    return c.json({ error: 'Correo electrónico inválido.' }, 400)
  }

  try {
    const existing = await sql`SELECT id FROM customers WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`
    if (existing.length > 0) {
      // Reclama la fila existente — refresca nombre/teléfono si vinieron
      // distintos, nunca toca password_hash/auth de una cuenta que ya exista.
      await sql`
        UPDATE customers SET name = ${name}, phone = COALESCE(${phone}, phone)
        WHERE id = ${existing[0].id}
      `
      return c.json({ customerId: existing[0].id, isNew: false })
    }

    const [created] = await sql`
      INSERT INTO customers (name, email, phone, created_channel)
      VALUES (${name}, ${email}, ${phone}, 'web')
      RETURNING id
    `
    return c.json({ customerId: created.id, isNew: true })
  } catch (err) {
    console.error('Guest customer error:', err)
    return c.json({ error: 'Error al registrar datos de contacto.' }, 500)
  }
})

// POST /api/public/orders (S10) — crea un pedido desde la tienda web pública
// (apps/web/.../checkout/page.tsx, createWebOrder). El frontend llamaba
// originalmente POST /api/orders/public, que nunca existió en el backend —
// se construye acá bajo un path distinto a propósito: /api/orders* (ver
// `app.use('/api/orders*', requireAuthMiddleware)` más arriba) exige API key
// con scope orders:write o sesión STAFF, y un visitante anónimo (o un cliente
// logueado con seul_customer_session, que tampoco es sesión staff) tiene que
// poder crear su propio pedido sin ninguna de esas dos credenciales. Colgar
// esto de /api/orders/public habría quedado atrapado por ese middleware sin
// forma limpia de exceptuarlo; un path fuera del prefijo evita depender de
// un detalle frágil de orden de registro de rutas en Hono.
//
// customer_id: si hay sesión de cliente activa, SIEMPRE se usa el customerId
// de esa sesión — nunca el que venga en el body — para que un cliente
// logueado no pueda crear un pedido atribuido a otro customerId. Sin sesión
// (checkout de invitado), se usa el customerId del body, creado un instante
// antes vía POST /api/customers/guest.
//
// Precio: el unitPrice que manda el frontend (copiado del carrito) se
// IGNORA — se recalcula desde products.price_retail al momento de crear el
// pedido, para que nadie pueda mandar un total manipulado. price_retail es
// información ya pública (GET /api/products), así que no hay fuga de datos
// al leerlo acá sin sesión.
//
// NO descuenta inventario — ningún endpoint de este backend lo hace todavía
// (ni POS ni B2B); es deuda pre-existente documentada en el plan maestro, no
// introducida por esta sesión.
//
// pdfToken: se devuelve null — no existe generación de PDF/boleta en este
// backend (orders.pdf_token existe en el schema pero ningún endpoint lo
// llena); es la Fase de SII/DTE, pospuesta post-entrega por decisión del
// cliente (commit 042e8f4). El checkout de apps/web no usa pdfToken hoy
// (solo result.number), así que null no rompe nada.
app.post('/api/public/orders', async (c) => {
  const rl = await checkAndRecordRateLimit(c, 'public-orders:create', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const { deliveryMode, metroStation, metroSlot, deliveryAddress, notes, items } = body
  const VALID_DELIVERY_MODES = ['rappi', 'metro', 'pickup', 'shipping', 'delivery']

  if (!deliveryMode || !VALID_DELIVERY_MODES.includes(deliveryMode)) {
    return c.json({ error: 'Modo de entrega inválido.' }, 400)
  }
  if (!Array.isArray(items) || items.length === 0) {
    return c.json({ error: 'El carrito está vacío.' }, 400)
  }
  for (const it of items) {
    if (!it.productId || !(Number(it.quantity) > 0)) {
      return c.json({ error: 'Ítems de pedido inválidos.' }, 400)
    }
  }

  // Sesión de cliente opcional — nunca bloquea (el checkout de invitado debe
  // seguir funcionando sin login), pero si existe, manda por sobre cualquier
  // customerId que venga en el body.
  const customerAuth = await getOptionalCustomerSession(c)
  const customerId: string | undefined = customerAuth?.customerId || body.customerId

  if (!customerId) {
    return c.json({ error: 'Falta customerId.' }, 400)
  }

  try {
    const [customer] = await sql`
      SELECT id, email, name FROM customers WHERE id = ${customerId} AND deleted_at IS NULL LIMIT 1
    `
    if (!customer) return c.json({ error: 'Cliente no encontrado.' }, 404)

    // Precios reales desde products — nunca confiar en el unitPrice del body.
    const productIds = items.map((it: any) => it.productId)
    const products = await sql`
      SELECT id, price_retail, status FROM products WHERE id = ANY(${productIds})
    `
    const productMap = new Map(products.map((p: any) => [p.id, p]))

    let subtotal = 0
    const resolvedItems: Array<{ productId: string; quantity: number; unitPrice: number; isBaes: boolean; lineTotal: number }> = []
    for (const it of items) {
      const p: any = productMap.get(it.productId)
      if (!p || p.status !== 'active') {
        return c.json({ error: 'Uno de los productos ya no está disponible.' }, 400)
      }
      const quantity = Number(it.quantity)
      const unitPrice = Number(p.price_retail)
      const lineTotal = Math.round(unitPrice * quantity)
      subtotal += lineTotal
      resolvedItems.push({ productId: it.productId, quantity, unitPrice, isBaes: !!it.isBaes, lineTotal })
    }

    const order_number = Math.floor(Math.random() * 100000)

    const order = await sql.begin(async (tx: any) => {
      const [ord] = await tx`
        INSERT INTO orders (number, channel, customer_id, status, delivery_mode, delivery_address, metro_station, metro_slot, subtotal, total, notes)
        VALUES (${order_number}, 'web', ${customerId}, 'nueva', ${deliveryMode}, ${deliveryAddress || null}, ${metroStation || null}, ${metroSlot || null}, ${subtotal}, ${subtotal}, ${notes || null})
        RETURNING id, number
      `
      for (const it of resolvedItems) {
        await tx`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, is_baes, subtotal)
          VALUES (${ord.id}, ${it.productId}, ${it.quantity}, ${it.unitPrice}, ${it.isBaes}, ${it.lineTotal})
        `
      }
      return ord
    })

    if (customer.email) {
      await enqueueEmail(
        customer.email,
        `✅ Orden Confirmada #${order.number}`,
        templates.orderConfirmation(order),
        'order-confirmation'
      )
    }
    await enqueueEmail(
      ADMIN_EMAIL,
      `📦 Nueva Orden #${order.number}`,
      `<p>Nueva orden de ${customer.name}. Total: $${subtotal}</p>`,
      'order-confirmation'
    )

    emitPosEvent({
      type: 'order.created',
      channel: 'web',
      payload: {
        orderId: order.id,
        number: order.number,
        channel: 'web',
        total: subtotal,
        deliveryMode,
        itemCount: resolvedItems.length,
        createdAt: new Date().toISOString(),
      },
    })

    console.log(`✅ Public order created: #${order.number}`)
    return c.json({ ok: true, orderId: order.id, number: order.number, pdfToken: null, total: subtotal })
  } catch (err) {
    console.error('Public order error:', err)
    return c.json({ error: 'Error al crear el pedido.' }, 500)
  }
})

// ============================================================================
// SHARED AUTH HELPER — JWT via Authorization header or session cookie.
// NOTE (updated S01): requireAuthMiddleware now validates JWTs too (see
// middleware/auth.middleware.ts), and that same file now exports
// `requireSession(c, roles?)` — the canonical replacement for this local
// helper. New endpoints should use `requireSession` instead of `getAuthUser`.
// `getAuthUser` is kept as-is for the endpoints already using it below to
// avoid regressing anything in production; migrate opportunistically.
// ============================================================================
async function getAuthUser(c: any): Promise<{ id: string; email: string; role: string; name: string } | null> {
  let token: string | undefined
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = getCookie(c, SESSION_COOKIE_NAME)
  }
  if (!token) return null
  const verified = AuthService.verifyToken(token, JWT_SECRET)
  if (!verified.ok) return null
  return verified.decoded as any
}

// ============================================================================
// USERS MANAGEMENT (Usuarios panel + Despacho driver selector)
// ============================================================================

// GET /api/auth/users — lista de usuarios (consumida por Usuarios y Despacho)
// RBAC (S02, matriz sección 6.1): la sección "Usuarios" (gestión: editar rol,
// desactivar, crear) es owner-only — ver PUT/DELETE abajo y POST /api/auth/register.
// Este GET, sin embargo, también alimenta el selector de repartidor del panel
// Despacho (apps/cerebro/src/app/(admin)/despacho/page.tsx:67), al que staff/admin
// SÍ tienen acceso por la matriz — restringirlo a owner rompería Despacho para
// esos roles. Se deja en owner+admin+staff (mismos roles que ya pueden entrar a
// Despacho) en vez de owner-only para no regresionar esa pantalla.
app.get('/api/auth/users', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT id, email, name, role, is_active, cargo, departamento, telefono_personal,
             last_login_at, created_at, must_change_password
      FROM users
      ORDER BY created_at ASC
    `
    return c.json({
      users: rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        isActive: r.is_active,
        cargo: r.cargo,
        departamento: r.departamento,
        telefonoPersonal: r.telefono_personal,
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
        mustChangePassword: r.must_change_password,
      })),
    })
  } catch (err) {
    console.error('List users error:', err)
    return c.json({ error: 'Error listing users' }, 500)
  }
})

// PUT /api/auth/users/:id — editar usuario (isActive, role, name, cargo, departamento, telefonoPersonal)
// RBAC (S02, matriz sección 6.1): Usuarios es visible/editable solo para 'owner'.
app.put('/api/auth/users/:id', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  try {
    const [updated] = await sql`
      UPDATE users SET
        role               = COALESCE(${body.role ?? null}, role),
        is_active          = COALESCE(${typeof body.isActive === 'boolean' ? body.isActive : null}, is_active),
        name               = COALESCE(${body.name ?? null}, name),
        cargo              = COALESCE(${body.cargo ?? null}, cargo),
        departamento       = COALESCE(${body.departamento ?? null}, departamento),
        telefono_personal  = COALESCE(${body.telefonoPersonal ?? null}, telefono_personal),
        updated_at         = NOW()
      WHERE id = ${id}
      RETURNING id, email, name, role, is_active, cargo, departamento, telefono_personal, last_login_at, created_at
    `

    if (!updated) return c.json({ error: 'User not found' }, 404)

    return c.json({
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: updated.is_active,
        cargo: updated.cargo,
        departamento: updated.departamento,
        telefonoPersonal: updated.telefono_personal,
        lastLoginAt: updated.last_login_at,
        createdAt: updated.created_at,
      },
    })
  } catch (err) {
    console.error('Update user error:', err)
    return c.json({ error: 'Error updating user' }, 500)
  }
})

// DELETE /api/auth/users/:id — soft-delete (is_active=false). FKs (delivery_assignments,
// shifts, till_sessions, cash_movements, etc.) reference users.id — a hard delete would
// either fail on FK constraints or cascade-destroy operational history, so this only
// deactivates the account (matches the frontend's own confirm-dialog copy).
// RBAC (S02, matriz sección 6.1): Usuarios es visible/editable solo para 'owner'.
app.delete('/api/auth/users/:id', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  try {
    const [target] = await sql`SELECT id, role FROM users WHERE id = ${id}`
    if (!target) return c.json({ error: 'User not found' }, 404)
    if (target.role === 'owner') {
      return c.json({ error: 'No se puede eliminar una cuenta owner' }, 403)
    }

    await sql`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ${id}`
    return c.json({ ok: true })
  } catch (err) {
    console.error('Delete user error:', err)
    return c.json({ error: 'Error deleting user' }, 500)
  }
})

// ============================================================================
// SHIFTS & TILL SESSIONS (POS caja) — two distinct, already-modeled concepts:
//   shift        = one cashier's workday on a device (table `shifts`)
//   till_session = one cash-drawer session nested inside a shift, FK'd via
//                  shift_id (table `till_sessions`) — a shift can span
//                  multiple till sessions if the till is closed/reopened.
// Both tables + `cash_movements` already existed in the DB (Drizzle schema
// in packages/db/src/schema/{shifts,till-sessions}.ts predates this work);
// only the HTTP layer was missing. Both enforce "one open per device" via a
// partial unique index, so races surface as a friendly 409 (pg code 23505).
// ============================================================================

const ZREPORT_METHODS = ['cash', 'debit', 'credit', 'baes', 'qr', 'transfer'] as const

async function computeTillZReport(tillId: string): Promise<any | null> {
  const [till] = await sql`
    SELECT ts.id, ts.session_number, ts.shift_id, ts.opening_float, ts.opened_at, ts.closed_at,
           s.shift_number, u.name AS cashier_name
    FROM till_sessions ts
    JOIN shifts s ON s.id = ts.shift_id
    JOIN users u ON u.id = ts.opened_by
    WHERE ts.id = ${tillId}
  `
  if (!till) return null

  const [agg] = await sql`
    SELECT
      count(*) FILTER (WHERE status != 'cancelada') AS ticket_count,
      count(*) FILTER (WHERE status = 'cancelada')  AS void_count,
      COALESCE(sum(total) FILTER (WHERE status != 'cancelada'), 0) AS gross_total
    FROM orders WHERE till_session_id = ${tillId}
  `

  const methodRows = await sql`
    SELECT op.method, COALESCE(sum(op.amount), 0) AS amount
    FROM order_payments op
    JOIN orders o ON o.id = op.order_id
    WHERE o.till_session_id = ${tillId} AND o.status != 'cancelada'
    GROUP BY op.method
  `

  const [refundAgg] = await sql`
    SELECT count(*) AS refund_count, COALESCE(sum(r.refund_amount_clp), 0) AS refund_total
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    WHERE o.till_session_id = ${tillId} AND r.status = 'processed'
  `

  const byMethod: Record<string, number> = Object.fromEntries(ZREPORT_METHODS.map(m => [m, 0]))
  for (const row of methodRows) {
    byMethod[row.method] = (byMethod[row.method] ?? 0) + Number(row.amount)
  }

  const grossTotal = Number(agg.gross_total)
  const refundTotal = Number(refundAgg.refund_total)
  const openingFloat = Number(till.opening_float)

  return {
    tillId: till.id,
    tillSessionNumber: till.session_number,
    shiftId: till.shift_id,
    shiftNumber: till.shift_number,
    cashierName: till.cashier_name,
    openedAt: till.opened_at,
    closedAt: till.closed_at,
    openingFloat,
    ticketCount: Number(agg.ticket_count),
    voidCount: Number(agg.void_count),
    refundCount: Number(refundAgg.refund_count),
    grossTotal,
    refundTotal,
    netTotal: grossTotal - refundTotal,
    byMethod,
    expectedCash: openingFloat + (byMethod.cash ?? 0),
  }
}

async function computeMasterZReport(shiftId: string): Promise<any | null> {
  const [shift] = await sql`SELECT id, shift_number, opened_at, closed_at FROM shifts WHERE id = ${shiftId}`
  if (!shift) return null

  const tillRows = await sql`SELECT id FROM till_sessions WHERE shift_id = ${shiftId} ORDER BY session_number ASC`
  const tillReports: any[] = []
  for (const t of tillRows) {
    const r = await computeTillZReport(t.id)
    if (r) tillReports.push(r)
  }

  const byMethod: Record<string, number> = Object.fromEntries(ZREPORT_METHODS.map(m => [m, 0]))
  for (const r of tillReports) {
    for (const [method, amount] of Object.entries(r.byMethod as Record<string, number>)) {
      byMethod[method] = (byMethod[method] ?? 0) + Number(amount)
    }
  }

  const grossTotal = tillReports.reduce((s, r) => s + r.grossTotal, 0)
  const refundTotal = tillReports.reduce((s, r) => s + r.refundTotal, 0)

  return {
    shiftId: shift.id,
    shiftNumber: shift.shift_number,
    openedAt: shift.opened_at,
    closedAt: shift.closed_at,
    tillCount: tillReports.length,
    totalTickets: tillReports.reduce((s, r) => s + r.ticketCount, 0),
    totalVoids: tillReports.reduce((s, r) => s + r.voidCount, 0),
    totalRefunds: tillReports.reduce((s, r) => s + r.refundCount, 0),
    grossTotal,
    refundTotal,
    netTotal: grossTotal - refundTotal,
    byMethod,
    tills: tillReports.map(r => ({
      tillId: r.tillId,
      tillSessionNumber: r.tillSessionNumber,
      cashierName: r.cashierName,
      openedAt: r.openedAt,
      closedAt: r.closedAt,
      openingFloat: r.openingFloat,
      ticketCount: r.ticketCount,
      netTotal: r.netTotal,
      byMethod: r.byMethod,
    })),
  }
}

// --- Shifts ---

app.post('/api/shifts/open', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const deviceId = body.device_id
  const openingFloat = Number(body.opening_float_clp) || 0
  if (!deviceId) return c.json({ error: 'Missing device_id' }, 400)

  try {
    const [shift] = await sql`
      INSERT INTO shifts (opened_by, device_id, opening_float)
      VALUES (${authUser.id}, ${deviceId}, ${openingFloat})
      RETURNING id, shift_number, opened_at, opening_float, device_id
    `
    return c.json({
      shift: {
        id: shift.id, shiftNumber: shift.shift_number, openedAt: shift.opened_at,
        openingFloat: shift.opening_float, deviceId: shift.device_id,
      },
    })
  } catch (err: any) {
    if (err?.code === '23505') return c.json({ error: 'Ya hay un turno abierto en este dispositivo' }, 409)
    console.error('Open shift error:', err)
    return c.json({ error: err.message || 'Error al abrir turno' }, 500)
  }
})

app.get('/api/shifts/active', async (c) => {
  // Migrated to requireSession (S01 proof-of-concept, bloqueador P0 #2).
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const deviceId = c.req.query('device_id')
  if (!deviceId) return c.json({ error: 'Missing device_id' }, 400)

  try {
    const [shift] = await sql`
      SELECT id, shift_number, opened_at, opening_float, device_id
      FROM shifts WHERE device_id = ${deviceId} AND status = 'open'
    `
    return c.json({
      shift: shift ? {
        id: shift.id, shiftNumber: shift.shift_number, openedAt: shift.opened_at,
        openingFloat: shift.opening_float, deviceId: shift.device_id,
      } : null,
    })
  } catch (err) {
    console.error('Active shift error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.get('/api/shifts/history', async (c) => {
  // Migrated to requireSession (S01 proof-of-concept, bloqueador P0 #2).
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '30', 10) || 30, 1), 100)

  try {
    const rows = await sql`
      SELECT s.id, s.shift_number, s.device_id, s.status, s.opened_at, s.closed_at,
             s.opening_float, s.closing_summary, u.name AS cashier_name, u.email AS cashier_email
      FROM shifts s
      JOIN users u ON u.id = s.opened_by
      ORDER BY s.opened_at DESC
      LIMIT ${limit}
    `
    return c.json({
      shifts: rows.map((r: any) => ({
        id: r.id, shiftNumber: r.shift_number, deviceId: r.device_id, status: r.status,
        openedAt: r.opened_at, closedAt: r.closed_at, openingFloat: r.opening_float,
        cashierName: r.cashier_name, cashierEmail: r.cashier_email,
        closingSummary: r.closing_summary,
      })),
    })
  } catch (err) {
    console.error('Shift history error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.get('/api/shifts/:id/z-report', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const masterReport = await computeMasterZReport(c.req.param('id'))
    if (!masterReport) return c.json({ error: 'Shift not found' }, 404)
    return c.json({ masterReport })
  } catch (err) {
    console.error('Master z-report error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.post('/api/shifts/:id/close', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  const id = c.req.param('id')
  try {
    const [shift] = await sql`SELECT id FROM shifts WHERE id = ${id}`
    if (!shift) return c.json({ error: 'Shift not found' }, 404)

    const openTills = await sql`SELECT id FROM till_sessions WHERE shift_id = ${id} AND status = 'open'`
    if (openTills.length > 0) {
      return c.json({
        error: 'Hay una caja abierta en este turno. Ciérrala antes de cerrar el turno.',
        openTillIds: openTills.map((t: any) => t.id),
      }, 409)
    }

    const masterReport = await computeMasterZReport(id)
    await sql`
      UPDATE shifts SET status = 'closed', closed_at = NOW(), closing_summary = ${masterReport}
      WHERE id = ${id}
    `
    return c.json({ masterReport })
  } catch (err) {
    console.error('Close shift error:', err)
    return c.json({ error: 'Error al cerrar turno' }, 500)
  }
})

// --- Till sessions ---

app.post('/api/till-sessions/open', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const shiftId = body.shift_id
  const deviceId = body.device_id
  const openingFloat = Number(body.opening_float_clp) || 0
  if (!shiftId || !deviceId) return c.json({ error: 'Missing shift_id or device_id' }, 400)

  try {
    const [shift] = await sql`SELECT id, status FROM shifts WHERE id = ${shiftId}`
    if (!shift) return c.json({ error: 'Shift not found' }, 404)
    if (shift.status !== 'open') return c.json({ error: 'El turno no está abierto' }, 409)

    const [till] = await sql`
      INSERT INTO till_sessions (shift_id, opened_by, device_id, opening_float)
      VALUES (${shiftId}, ${authUser.id}, ${deviceId}, ${openingFloat})
      RETURNING id, session_number, shift_id, opened_at, opening_float, device_id
    `
    return c.json({
      tillSession: {
        id: till.id, sessionNumber: till.session_number, shiftId: till.shift_id,
        openedAt: till.opened_at, openingFloat: till.opening_float, deviceId: till.device_id,
        openedByName: authUser.name,
      },
    })
  } catch (err: any) {
    if (err?.code === '23505') return c.json({ error: 'Ya hay una caja abierta en este dispositivo' }, 409)
    console.error('Open till error:', err)
    return c.json({ error: err.message || 'Error al abrir caja' }, 500)
  }
})

app.get('/api/till-sessions/active', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  const deviceId = c.req.query('device_id')
  if (!deviceId) return c.json({ error: 'Missing device_id' }, 400)

  try {
    const [till] = await sql`
      SELECT ts.id, ts.session_number, ts.shift_id, ts.opened_at, ts.opening_float, ts.device_id,
             u.name AS opened_by_name
      FROM till_sessions ts
      JOIN users u ON u.id = ts.opened_by
      WHERE ts.device_id = ${deviceId} AND ts.status = 'open'
    `
    return c.json({
      tillSession: till ? {
        id: till.id, sessionNumber: till.session_number, shiftId: till.shift_id,
        openedAt: till.opened_at, openingFloat: till.opening_float, deviceId: till.device_id,
        openedByName: till.opened_by_name,
      } : null,
    })
  } catch (err) {
    console.error('Active till error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.get('/api/till-sessions/:id/z-report', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const zReport = await computeTillZReport(c.req.param('id'))
    if (!zReport) return c.json({ error: 'Till session not found' }, 404)
    return c.json({ zReport })
  } catch (err) {
    console.error('Till z-report error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.post('/api/till-sessions/:id/close', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  const id = c.req.param('id')
  try {
    const [till] = await sql`SELECT id FROM till_sessions WHERE id = ${id}`
    if (!till) return c.json({ error: 'Till session not found' }, 404)

    const zReport = await computeTillZReport(id)
    await sql`
      UPDATE till_sessions SET status = 'closed', closed_at = NOW(), closing_summary = ${zReport}
      WHERE id = ${id}
    `
    return c.json({ zReport })
  } catch (err) {
    console.error('Close till error:', err)
    return c.json({ error: 'Error al cerrar caja' }, 500)
  }
})

// ============================================================================
// B2C ENDPOINTS (7 emails)
// ============================================================================

// Proteger endpoints de órdenes — requieren autenticación
app.use('/api/orders*', requireAuthMiddleware)
app.use('/api/orders*', requireScopeMiddleware(['orders:write']))

// POST /api/orders
app.post('/api/orders', async (c) => {
  // Rate limit (S02, bloqueador P0 #3): 20 pedidos / 5 min por usuario o IP.
  const rl = await checkAndRecordRateLimit(c, 'orders:create', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

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

    // SSE (S08, Fase 2): notify every connected POS terminal in real time —
    // emit at the moment of change, no polling. Channel is hardcoded 'web'
    // above (this endpoint has no other caller today), which is exactly the
    // "external channel" the POS client-side filter (`data.channel !== 'pos'`
    // in apps/pos/src/lib/order-events.ts) is built to surface.
    emitPosEvent({
      type: 'order.created',
      channel: 'web',
      payload: {
        orderId: order.id,
        number: order.number,
        channel: 'web',
        total: Number(total),
        deliveryMode: delivery_mode || 'delivery',
        itemCount: Array.isArray(items) ? items.length : 0,
        createdAt: new Date().toISOString(),
      },
    })

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
// También registrado como PATCH: apps/cerebro/.../comandas/page.tsx (drag-and-drop
// del Kanban, agregado en S04) llama PATCH en vez de POST — mismo handler, dos
// métodos, para no romper ningún consumidor existente que ya use POST.
async function handleOrderStatusUpdate(c: any) {
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
}
app.post('/api/orders/:id/status', handleOrderStatusUpdate)
app.patch('/api/orders/:id/status', handleOrderStatusUpdate)

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
// NOTA (S11, Fase 3): estrechado de '/api/b2b*' a '/api/b2b/quotes*'. El wildcard
// original protegía correctamente las 3 rutas que existían hasta hoy (todas bajo
// /api/b2b/quotes) exigiendo API key con scope orders:write o sesión STAFF — pero
// como Hono compone TODOS los middlewares cuyo patrón matchea la ruta de la
// request (sin importar en qué orden del archivo se registran los handlers
// específicos), ese wildcard habría bloqueado con 401 cualquier ruta nueva bajo
// /api/b2b/* añadida más abajo (registro público, catálogo/empresa/wallet con
// sesión de CLIENTE, no de staff) antes de que sus propios handlers pudieran
// siquiera evaluar la sesión de cliente. Estrechar el patrón no cambia el
// comportamiento de ninguna ruta que ya funcionaba (las 3 de /quotes siguen
// exactamente igual de protegidas) — cero regresión.
app.use('/api/b2b/quotes*', requireAuthMiddleware)
app.use('/api/b2b/quotes*', requireScopeMiddleware(['orders:write']))

// POST /api/b2b/quotes
app.post('/api/b2b/quotes', async (c) => {
  // Rate limit (S02, bloqueador P0 #3): 20 cotizaciones / 5 min por usuario o IP.
  const rl = await checkAndRecordRateLimit(c, 'b2b/quotes:create', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

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
// PORTAL B2B — empresa mayorista (S11, Fase 3)
// ============================================================================
// DECISIÓN DE ARQUITECTURA (verificada contra el modelo de datos antes de
// escribir código): el portal B2B usa EXACTAMENTE la misma sesión de cliente
// que B2C (`seul_customer_session` / requireCustomerSession) — NO existe un
// login ni una cookie propios para empresas. `b2b_companies.customer_id` es
// NOT NULL y apunta a una sola fila de `customers` (un dueño/contacto por
// empresa, no varios usuarios por empresa — packages/db/src/schema/customers.ts).
// Confirma la decisión: apps/web/.../b2b/login/page.tsx (escrito antes de esta
// sesión) ya llama /api/customer/login + /api/customer/me, y el comentario de
// CUSTOMER AUTH ENDPOINTS más arriba (línea ~608) ya decía "tienda B2C y portal
// B2B comparten la misma tabla customers / mismo login" — esta sesión solo
// construye el backend que faltaba, no inventa el diseño.
//
// requireB2BCompany(c) es el "requireB2BSession" del brief: llama a
// requireCustomerSession y resuelve la empresa asociada a ese customerId. Un
// cliente B2C normal (sesión de cliente válida, pero sin empresa) recibe 403 —
// así nunca puede alcanzar precios/datos B2B con su propia sesión, que es el
// requisito de aislamiento explícito de esta sesión.
async function requireB2BCompany(c: any): Promise<
  | { customer: { customerId: string; email: string; name: string }; company: any }
  | Response
> {
  const customer = await requireCustomerSession(c)
  if (customer instanceof Response) return customer

  const [company] = await sql`
    SELECT id, customer_id, razon_social, rut, giro, address, tier, status,
           credit_limit_clp, credit_used_clp, wallet_balance_clp, payment_days,
           created_at, approved_at
    FROM b2b_companies
    WHERE customer_id = ${customer.customerId}
    ORDER BY created_at ASC
    LIMIT 1
  `
  if (!company) {
    return c.json({ error: 'Tu cuenta no tiene una empresa B2B asociada.' }, 403)
  }
  return { customer, company }
}

// POST /api/b2b/registro — solicitud de cuenta mayorista, PÚBLICA (sin sesión)
// — apps/web/.../b2b/registro/page.tsx. Mismo patrón "reclamar cliente
// fantasma" que POST /api/customer/register (S09): customers.email es UNIQUE.
//
// DECISIÓN: a diferencia del registro B2C (donde reclamar un fantasma sin
// password es el único caso), aquí hay 3 casos posibles para el email
// recibido: (1) no existe → se crea con password temporal; (2) existe pero SIN
// password (fantasma de POS/checkout invitado) → se reclama con password
// temporal, igual que S09; (3) existe CON password (ya es cliente B2C activo)
// → NO se pisa su password (lo dejaría fuera de su cuenta actual), solo se le
// asocia la empresa nueva a su customer_id existente. En los 3 casos la cuenta
// queda logueable de inmediato — no existe hoy una pantalla en cerebro para
// "aprobar" el registro de una EMPRESA nueva (solo existe para solicitudes de
// CRÉDITO, ver /api/b2b/solicitudes más abajo, confirmado por grep antes de
// escribir esto), así que gatear el login detrás de una aprobación que ningún
// botón puede otorgar dejaría a todo registrante bloqueado para siempre.
// `status` de la empresa queda en 'pending' igual — el copy del formulario
// ("te contactaremos… para activar tu cuenta") se entiende como activar el
// CANAL DE PEDIDOS por WhatsApp, no el acceso al portal. Documentado como
// decisión de esta sesión, no como bug.
app.post('/api/b2b/registro', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const razonSocial = String(body.razonSocial || '').trim()
  const rutRaw = String(body.rut || '').trim()
  const giro = String(body.giro || '').trim()
  const address = String(body.address || '').trim()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const phone = body.phone ? String(body.phone).trim() : null

  if (!razonSocial || !rutRaw || !giro || !address || !name || !email) {
    return c.json({ ok: false, error: 'Completa todos los campos obligatorios.' }, 400)
  }
  if (!isValidEmail(email)) {
    return c.json({ ok: false, error: 'Correo electrónico inválido.' }, 400)
  }
  if (!isValidRUT(rutRaw)) {
    return c.json({ ok: false, error: 'RUT de empresa inválido.' }, 400)
  }
  const rut = normalizeRUT(rutRaw)

  const rl = await checkAndRecordRateLimit(c, 'b2b:registro', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const [existingCompany] = await sql`SELECT id FROM b2b_companies WHERE rut = ${rut} LIMIT 1`
    if (existingCompany) {
      return c.json({ ok: false, error: 'Ya existe una empresa registrada con ese RUT.' }, 409)
    }

    const existing = await sql`
      SELECT id, password_hash FROM customers WHERE lower(email) = ${email} AND deleted_at IS NULL LIMIT 1
    `

    if (existing.length > 0) {
      const [ownedCompany] = await sql`SELECT id FROM b2b_companies WHERE customer_id = ${existing[0].id} LIMIT 1`
      if (ownedCompany) {
        return c.json({ ok: false, error: 'Ya existe una cuenta B2B con este correo.' }, 409)
      }
    }

    let customerId: string
    let tempPassword: string | null = null

    if (existing.length > 0 && existing[0].password_hash) {
      // Caso 3: ya es cliente activo (B2C) — no se toca su password.
      customerId = existing[0].id
    } else if (existing.length > 0) {
      // Caso 2: fantasma sin password — reclamar, mismo criterio que S09.
      customerId = existing[0].id
      tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
      const passwordHash = PasswordService.hashPassword(tempPassword)
      await sql`
        UPDATE customers
        SET name = ${name}, phone = COALESCE(${phone}, phone),
            password_hash = ${passwordHash}, must_change_password = true
        WHERE id = ${customerId}
      `
    } else {
      // Caso 1: nuevo.
      tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
      const passwordHash = PasswordService.hashPassword(tempPassword)
      const [created] = await sql`
        INSERT INTO customers (email, name, phone, password_hash, must_change_password, email_verified, created_channel)
        VALUES (${email}, ${name}, ${phone}, ${passwordHash}, true, false, 'b2b')
        RETURNING id
      `
      customerId = created.id
    }

    await sql`
      INSERT INTO b2b_companies (customer_id, razon_social, rut, giro, address, status, tier)
      VALUES (${customerId}, ${razonSocial}, ${rut}, ${giro}, ${address}, 'pending', 'hoobae')
    `

    const credentialsBlock = tempPassword
      ? `<div style="background: #f0f0f0; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #888;"><small>Ya puedes entrar a tu Portal Mayorista con estas credenciales:</small></p>
          <p style="margin: 5px 0; font-family: monospace; font-size: 14px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0; font-family: monospace; font-size: 14px;"><strong>Contraseña temporal:</strong> ${tempPassword}</p>
        </div>`
      : `<p style="color: #555;">Ya puedes entrar al Portal Mayorista con tu correo y contraseña habituales.</p>`

    await enqueueEmail(
      email,
      '¡Solicitud recibida! — Portal Mayorista Seoul Shop',
      `<div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: white; padding: 30px; border-radius: 8px; border-top: 4px solid #d7263d;">
          <h1 style="color: #d7263d; margin-top: 0;">¡Solicitud recibida!</h1>
          <p style="color: #555; line-height: 1.6;">Hola <strong>${name}</strong>, tu solicitud de cuenta mayorista para <strong>${razonSocial}</strong> fue recibida. Te contactaremos por WhatsApp en 24–48 horas hábiles.</p>
          ${credentialsBlock}
          <div style="margin: 30px 0;">
            <a href="${CUSTOMER_WEB_URL}/b2b/login" style="display: inline-block; background: #d7263d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir al Portal Mayorista →</a>
          </div>
        </div>
      </div>`,
      'welcome'
    )

    await enqueueEmail(
      ADMIN_EMAIL,
      `🏢 Nueva solicitud B2B — ${razonSocial}`,
      `<p>Nueva empresa mayorista registrada: <strong>${razonSocial}</strong> (${rut}). Contacto: ${name} · ${email}${phone ? ' · ' + phone : ''}.</p>`,
      'contact-form-reply'
    )

    return c.json({ ok: true })
  } catch (err: any) {
    console.error('B2B registro error:', err)
    if (err?.code === '23505') {
      return c.json({ ok: false, error: 'Ya existe una empresa o cuenta con esos datos.' }, 409)
    }
    return c.json({ ok: false, error: 'No se pudo enviar la solicitud.' }, 500)
  }
})

// GET /api/b2b/empresa/me — apps/web/.../b2b/dashboard/page.tsx
app.get('/api/b2b/empresa/me', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  const limit = Number(company.credit_limit_clp ?? 0)
  const used = Number(company.credit_used_clp ?? 0)
  const creditPct = limit > 0 ? Math.round((used / limit) * 100) : 0

  return c.json({
    id: company.id,
    razonSocial: company.razon_social,
    rut: company.rut,
    giro: company.giro,
    address: company.address,
    tier: company.tier,
    status: company.status,
    creditLimitClp: limit,
    creditUsedClp: used,
    walletBalanceClp: Number(company.wallet_balance_clp ?? 0),
    paymentDays: Number(company.payment_days ?? 0),
    customerId: company.customer_id,
    creditPct,
  })
})

// GET /api/b2b/catalogo — precios netos mayoristas. SOLO empresa autenticada
// (nunca público anónimo, nunca cliente B2C normal — requisito explícito de
// esta sesión). apps/web/.../b2b/catalogo/page.tsx corre como Server Component
// y reenvía la cookie de sesión a mano (mismo patrón que serverFetch de
// apps/cerebro/src/lib/api.ts — no una excepción nueva).
app.get('/api/b2b/catalogo', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session

  const q = c.req.query('q')?.trim()
  const qCond = q
    ? sql`AND (p.name ILIKE ${'%' + q + '%'} OR p.sku ILIKE ${'%' + q + '%'} OR p.brand ILIKE ${'%' + q + '%'})`
    : sql``

  try {
    const rows = await sql`
      SELECT p.id, p.sku, p.name, p.brand, p.price_retail, p.price_b2b,
             p.cold_chain, p.is_baes_eligible, p.weight_grams,
             COALESCE(stock.qty_total, 0) AS stock_total
      FROM products p
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.quantity), 0) AS qty_total FROM inventory i WHERE i.product_id = p.id
      ) stock ON true
      WHERE p.status = 'active' AND p.price_b2b IS NOT NULL ${qCond}
      ORDER BY p.name ASC
      LIMIT 500
    `

    return c.json({
      products: rows.map((r: any) => ({
        id: r.id, sku: r.sku, name: r.name, brand: r.brand,
        priceRetail: Number(r.price_retail), priceB2B: Number(r.price_b2b),
        coldChain: r.cold_chain, isBaesEligible: r.is_baes_eligible,
        weightGrams: r.weight_grams, stock: Number(r.stock_total),
      })),
    })
  } catch (err) {
    console.error('B2B catálogo error:', err)
    return c.json({ error: 'Error al listar catálogo B2B' }, 500)
  }
})

// POST /api/b2b/credit-request — apps/web/.../b2b/credito/page.tsx. company_id
// SIEMPRE de la sesión (nunca del body) — mismo criterio que S10 con
// customerId en /api/public/orders: una empresa no puede solicitar crédito a
// nombre de otra adivinando su UUID. (El frontend anterior a esta sesión
// mandaba un companyId tecleado a mano en un input de texto — se corrigió en
// el mismo commit, ver apps/web/.../b2b/credito/page.tsx).
app.post('/api/b2b/credit-request', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const amountClp = parseInt(body.amountClp, 10)
  const reason = body.reason ? String(body.reason).trim() : null

  if (!amountClp || amountClp <= 0) {
    return c.json({ ok: false, error: 'Monto inválido.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'b2b:credit-request', { limit: 20, windowMinutes: 5 }, company.id)
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const [created] = await sql`
      INSERT INTO b2b_credit_requests (company_id, amount_clp, reason, status)
      VALUES (${company.id}, ${amountClp}, ${reason}, 'pending')
      RETURNING id
    `

    await enqueueEmail(
      ADMIN_EMAIL,
      `💳 Solicitud de crédito B2B — ${company.razon_social}`,
      `<p><strong>${company.razon_social}</strong> (${company.rut}) solicitó ${amountClp.toLocaleString('es-CL')} CLP de crédito. Motivo: ${reason || 'No especificado'}.</p>`,
      'contact-form-reply'
    )

    return c.json({ ok: true, id: created.id })
  } catch (err) {
    console.error('B2B credit-request error:', err)
    return c.json({ ok: false, error: 'No se pudo enviar la solicitud.' }, 500)
  }
})

// GET /api/b2b/credit-requests/:id — detalle de una solicitud. Accesible por
// la empresa dueña (sesión B2B) o por staff owner/admin (mismo consumidor
// potencial que /api/b2b/solicitudes, aunque hoy ningún frontend llama este
// endpoint puntual — se construye igual porque el plan lo pide explícitamente
// y GET /api/b2b/wallet/:id ya establece el mismo criterio de :id-vs-sesión).
app.get('/api/b2b/credit-requests/:id', async (c) => {
  const id = c.req.param('id')

  const staffUser = await getOptionalSession(c)
  if (staffUser && ['owner', 'admin'].includes(staffUser.role)) {
    const [row] = await sql`
      SELECT cr.id, cr.company_id, cr.amount_clp, cr.reason, cr.status,
             cr.reviewed_at, cr.reviewer_note, cr.created_at,
             comp.razon_social, comp.rut
      FROM b2b_credit_requests cr
      JOIN b2b_companies comp ON comp.id = cr.company_id
      WHERE cr.id = ${id}
      LIMIT 1
    `
    if (!row) return c.json({ error: 'Solicitud no encontrada' }, 404)
    return c.json({
      id: row.id, companyId: row.company_id, amountClp: Number(row.amount_clp),
      reason: row.reason, status: row.status, reviewedAt: row.reviewed_at,
      reviewerNote: row.reviewer_note, createdAt: row.created_at,
      razonSocial: row.razon_social, rut: row.rut,
    })
  }

  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  const [row] = await sql`
    SELECT id, company_id, amount_clp, reason, status, reviewed_at, reviewer_note, created_at
    FROM b2b_credit_requests
    WHERE id = ${id} AND company_id = ${company.id}
    LIMIT 1
  `
  if (!row) return c.json({ error: 'Solicitud no encontrada' }, 404)
  return c.json({
    id: row.id, companyId: row.company_id, amountClp: Number(row.amount_clp),
    reason: row.reason, status: row.status, reviewedAt: row.reviewed_at,
    reviewerNote: row.reviewer_note, createdAt: row.created_at,
  })
})

// PATCH /api/b2b/credit-requests/:id/review — STAFF (owner/admin) —
// apps/cerebro/.../b2b/solicitudes/page.tsx (botones Aprobar/Rechazar). NO
// listado explícitamente en el brief de esta sesión bajo ese nombre exacto,
// pero es el endpoint real que ese componente YA construido llama (confirmado
// por grep antes de escribir código) — sin esto, "GET /api/b2b/solicitudes" no
// tendría ninguna acción posible desde cerebro. Al aprobar, acredita el monto
// en la wallet de la empresa (b2b_wallet_ledger + b2b_companies.wallet_balance_clp)
// — es el único lugar del sistema que escribe en el ledger hoy. Una solicitud
// ya revisada no se puede volver a revisar (409).
app.patch('/api/b2b/credit-requests/:id/review', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const id = c.req.param('id')
  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const status = body.status
  const reviewerNote = body.reviewerNote ? String(body.reviewerNote).trim() : null

  if (!['approved', 'rejected'].includes(status)) {
    return c.json({ error: 'status debe ser approved o rejected' }, 400)
  }

  try {
    const [reqRow] = await sql`
      SELECT cr.id, cr.company_id, cr.amount_clp, cr.status, comp.razon_social, comp.customer_id
      FROM b2b_credit_requests cr
      JOIN b2b_companies comp ON comp.id = cr.company_id
      WHERE cr.id = ${id}
      LIMIT 1
    `
    if (!reqRow) return c.json({ error: 'Solicitud no encontrada' }, 404)
    if (reqRow.status !== 'pending') {
      return c.json({ error: 'Esta solicitud ya fue revisada' }, 409)
    }

    await sql`
      UPDATE b2b_credit_requests
      SET status = ${status}, reviewed_by = ${authUser.id}, reviewed_at = NOW(),
          reviewer_note = ${reviewerNote}, updated_at = NOW()
      WHERE id = ${id}
    `

    if (status === 'approved') {
      const [comp] = await sql`SELECT wallet_balance_clp FROM b2b_companies WHERE id = ${reqRow.company_id}`
      const newBalance = Number(comp.wallet_balance_clp) + Number(reqRow.amount_clp)

      await sql`UPDATE b2b_companies SET wallet_balance_clp = ${newBalance} WHERE id = ${reqRow.company_id}`
      await sql`
        INSERT INTO b2b_wallet_ledger (company_id, type, amount_clp, balance_after, reference_id, reference_type, notes, created_by)
        VALUES (${reqRow.company_id}, 'credit', ${reqRow.amount_clp}, ${newBalance}, ${reqRow.id}, 'credit_request', ${reviewerNote}, ${authUser.id})
      `
    }

    const [customerRow] = await sql`SELECT email FROM customers WHERE id = ${reqRow.customer_id}`
    const contactEmail = customerRow?.email ?? null

    if (contactEmail) {
      const label = status === 'approved' ? '✅ Aprobada' : '❌ Rechazada'
      await enqueueEmail(
        contactEmail,
        `${label} — Solicitud de crédito ${reqRow.razon_social}`,
        `<p>Tu solicitud de crédito por ${Number(reqRow.amount_clp).toLocaleString('es-CL')} CLP fue ${status === 'approved' ? 'aprobada' : 'rechazada'}.${reviewerNote ? ' Nota: ' + reviewerNote : ''}</p>`,
        status === 'approved' ? 'quote-accepted' : 'quote-rejected'
      )
    }

    return c.json({ ok: true })
  } catch (err) {
    console.error('B2B credit review error:', err)
    return c.json({ error: 'Error al revisar solicitud' }, 500)
  }
})

// GET /api/b2b/solicitudes — STAFF (owner/admin), apps/cerebro/.../b2b/solicitudes/page.tsx.
// Pese al nombre ("solicitudes"), es específicamente el listado de solicitudes
// de CRÉDITO (b2b_credit_requests) — no hay una pantalla de aprobación de
// registro de EMPRESA nueva en cerebro hoy (ver decisión documentada en
// POST /api/b2b/registro arriba). Confirmado leyendo el componente ya
// existente antes de escribir esta ruta (grep, lección explícita de esta
// sesión: verificar shape/consumidor real antes de construir).
app.get('/api/b2b/solicitudes', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const status = c.req.query('status')
  const statusCond = status && ['pending', 'approved', 'rejected'].includes(status)
    ? sql`WHERE cr.status = ${status}`
    : sql``

  try {
    const rows = await sql`
      SELECT cr.id, cr.company_id, cr.amount_clp, cr.reason, cr.status,
             cr.reviewed_at, cr.reviewer_note, cr.created_at,
             comp.razon_social, comp.rut, comp.tier
      FROM b2b_credit_requests cr
      JOIN b2b_companies comp ON comp.id = cr.company_id
      ${statusCond}
      ORDER BY cr.created_at DESC
      LIMIT 200
    `
    return c.json({
      solicitudes: rows.map((r: any) => ({
        id: r.id, companyId: r.company_id, amountClp: Number(r.amount_clp),
        reason: r.reason, status: r.status, reviewedAt: r.reviewed_at,
        reviewerNote: r.reviewer_note, createdAt: r.created_at,
        razonSocial: r.razon_social, rut: r.rut, tier: r.tier,
      })),
    })
  } catch (err) {
    console.error('B2B solicitudes error:', err)
    return c.json({ error: 'Error al listar solicitudes' }, 500)
  }
})

// GET /api/b2b/pedidos/:id — apps/web/.../b2b/dashboard/page.tsx. :id es el id
// de la EMPRESA (empresa.id, no de un pedido) — confirmado leyendo el
// componente (`fetch(.../b2b/pedidos/${data.id})` justo después de cargar
// /empresa/me). El :id del param se verifica contra la empresa de la sesión —
// 403 si no coincide (una empresa no puede leer los pedidos de otra
// adivinando su UUID). Los pedidos B2B no tienen columna propia en `orders`
// (no existe orders.company_id) — se resuelven por customer_id = el dueño de
// la empresa + channel = 'b2b', el mismo criterio que ya usa el enum
// order_channel (packages/db/src/schema/orders.ts).
app.get('/api/b2b/pedidos/:id', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  const id = c.req.param('id')
  if (id !== company.id) {
    return c.json({ error: 'No autorizado para ver los pedidos de esta empresa' }, 403)
  }

  try {
    const rows = await sql`
      SELECT id, number, total, status, dte_status, dte_folio, created_at
      FROM orders
      WHERE customer_id = ${company.customer_id} AND channel = 'b2b'
      ORDER BY created_at DESC
      LIMIT 50
    `
    return c.json({
      pedidos: rows.map((r: any) => ({
        id: r.id, number: r.number, total: r.total, status: r.status,
        dteStatus: r.dte_status, dteFolio: r.dte_folio, createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('B2B pedidos error:', err)
    return c.json({ error: 'Error al listar pedidos' }, 500)
  }
})

// GET /api/b2b/wallet/:id — apps/web/.../b2b/estado-cuenta/page.tsx. Mismo
// criterio de verificación de :id que /pedidos/:id arriba.
app.get('/api/b2b/wallet/:id', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  const id = c.req.param('id')
  if (id !== company.id) {
    return c.json({ error: 'No autorizado para ver la wallet de esta empresa' }, 403)
  }

  try {
    const ledger = await sql`
      SELECT id, type, amount_clp, balance_after, notes, created_at
      FROM b2b_wallet_ledger
      WHERE company_id = ${company.id}
      ORDER BY created_at DESC
      LIMIT 100
    `
    return c.json({
      empresa: {
        id: company.id,
        razonSocial: company.razon_social,
        walletBalanceClp: Number(company.wallet_balance_clp ?? 0),
        creditLimitClp: Number(company.credit_limit_clp ?? 0),
        creditUsedClp: Number(company.credit_used_clp ?? 0),
      },
      ledger: ledger.map((r: any) => ({
        id: r.id, type: r.type, amountClp: Number(r.amount_clp),
        balanceAfter: Number(r.balance_after), notes: r.notes, createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('B2B wallet error:', err)
    return c.json({ error: 'Error al obtener wallet' }, 500)
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
// DESPACHO PANEL (Cerebro admin) — /api/delivery/... (singular)
// Distinct route prefix from the driver-facing /api/deliveries/... (plural)
// above: those are gated behind requireAuthMiddleware, which today only
// validates API Keys (JWT branch is a TODO in auth.middleware.ts) and would
// 401 every session-cookie admin request. Reuses the same delivery_assignments
// table/business logic — only the list+assign HTTP surface was missing.
// ============================================================================

app.get('/api/delivery/assignments', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const rows = await sql`
      SELECT
        da.id, da.order_id, da.driver_id, da.status, da.amount_to_collect, da.payment_at_door,
        da.route_index, da.assigned_at, da.delivered_at, da.created_at,
        o.number AS order_number, o.total AS order_total, o.delivery_mode,
        o.delivery_address, o.metro_station, o.metro_slot,
        COALESCE(o.guest_name, cu.name)   AS customer_name,
        COALESCE(o.guest_phone, cu.phone) AS customer_phone
      FROM delivery_assignments da
      JOIN orders o ON o.id = da.order_id
      LEFT JOIN customers cu ON cu.id = o.customer_id
      ORDER BY da.created_at DESC
    `
    return c.json({
      assignments: rows.map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        driverId: r.driver_id,
        status: r.status,
        amountToCollect: r.amount_to_collect,
        paymentAtDoor: r.payment_at_door,
        routeIndex: r.route_index,
        assignedAt: r.assigned_at,
        deliveredAt: r.delivered_at,
        createdAt: r.created_at,
        orderNumber: r.order_number,
        orderTotal: r.order_total,
        deliveryMode: r.delivery_mode,
        deliveryAddress: r.delivery_address,
        metroStation: r.metro_station,
        metroSlot: r.metro_slot,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
      })),
    })
  } catch (err) {
    console.error('List delivery assignments error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// RBAC (S02, matriz sección 6.1): Despacho es owner/admin/staff (no delivery, no viewer).
app.put('/api/delivery/assignments/:id/assign', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const driverId = body.driverId
  if (!driverId) return c.json({ error: 'Missing driverId' }, 400)

  try {
    const [assignment] = await sql`
      UPDATE delivery_assignments
      SET driver_id = ${driverId}, status = 'assigned', assigned_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `
    if (!assignment) return c.json({ error: 'Assignment not found' }, 404)

    // SSE (S08, Fase 2): fire a targeted dispatch alert to the assigned
    // driver only — never a broadcast (see sse-broadcaster.ts). One extra
    // read here, triggered only by an actual assign action (not a timer),
    // so it does not add per-connection DB load.
    try {
      const [details] = await sql`
        SELECT
          da.id AS assignment_id, da.amount_to_collect, da.payment_at_door,
          o.id AS order_id, o.number AS order_number, o.total, o.delivery_mode,
          o.delivery_address, o.metro_station, o.metro_slot,
          COALESCE(o.guest_name, cu.name)   AS customer_name,
          COALESCE(o.guest_phone, cu.phone) AS customer_phone,
          cu.commune
        FROM delivery_assignments da
        JOIN orders o ON o.id = da.order_id
        LEFT JOIN customers cu ON cu.id = o.customer_id
        WHERE da.id = ${id}
      `
      if (details) {
        emitDeliveryEvent(driverId, {
          type: 'order.ready_for_dispatch',
          payload: {
            orderId: details.order_id,
            orderNumber: details.order_number,
            assignmentId: details.assignment_id,
            driverId,
            total: details.total,
            amountToCollect: details.amount_to_collect,
            paymentAtDoor: details.payment_at_door,
            deliveryMode: details.delivery_mode,
            customerName: details.customer_name,
            customerPhone: details.customer_phone,
            deliveryAddress: details.delivery_address,
            commune: details.commune,
            metroStation: details.metro_station,
            metroSlot: details.metro_slot,
          },
        })
      }
    } catch (sseErr) {
      // Never fail the assign action because of a notification error.
      console.error('SSE delivery emit error:', sseErr)
    }

    return c.json({ ok: true })
  } catch (err) {
    console.error('Assign driver error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// REPARTIDOR (driver-facing app) — /api/delivery/... (S07, Fase 2)
// Role `delivery` only (matriz sección 6.1) — a driver only ever sees/reports
// their OWN assignments, keyed off authUser.id from the session, never a
// client-supplied driver id.
// ============================================================================

// GET /api/delivery/assignments/mine — apps/repartidor/src/app/page.tsx
// (loadAssignments). Frontend does its own client-side split into "Activos"
// (status not in delivered/failed) vs. "Historial" (delivered/failed) from
// this SAME array — so this endpoint intentionally returns everything for
// the driver, not just pending ones. Shape matches the `Assignment`
// interface in page.tsx exactly (customerName/guestName kept separate —
// frontend does its own `?? ` fallback, no COALESCE server-side here).
app.get('/api/delivery/assignments/mine', async (c) => {
  const authUser = await requireSession(c, ['delivery'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT
        da.id, da.order_id, da.status, da.amount_to_collect, da.payment_at_door,
        da.route_index, da.delivered_at, da.failed_at, da.failure_reason,
        o.number AS order_number, o.total AS order_total, o.delivery_mode,
        o.delivery_address, o.metro_station, o.metro_slot,
        cu.name  AS customer_name, cu.phone AS customer_phone,
        o.guest_name, o.guest_phone,
        EXISTS (
          SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = o.id AND p.cold_chain = 'frozen'
        ) AS has_frozen,
        EXISTS (
          SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = o.id AND p.cold_chain = 'refrigerated'
        ) AS has_refrigerated
      FROM delivery_assignments da
      JOIN orders o ON o.id = da.order_id
      LEFT JOIN customers cu ON cu.id = o.customer_id
      WHERE da.driver_id = ${authUser.id}
      ORDER BY
        (da.status NOT IN ('delivered', 'failed')) DESC,
        da.route_index ASC NULLS LAST,
        da.assigned_at ASC NULLS LAST,
        da.created_at DESC
    `
    return c.json({
      assignments: rows.map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        status: r.status,
        amountToCollect: r.amount_to_collect,
        paymentAtDoor: r.payment_at_door,
        routeIndex: r.route_index,
        orderNumber: r.order_number,
        orderTotal: r.order_total,
        deliveryMode: r.delivery_mode,
        deliveryAddress: r.delivery_address,
        metroStation: r.metro_station,
        metroSlot: r.metro_slot,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        guestName: r.guest_name,
        guestPhone: r.guest_phone,
        hasFrozen: r.has_frozen,
        hasRefrigerated: r.has_refrigerated,
        deliveredAt: r.delivered_at,
        failedAt: r.failed_at,
        failureReason: r.failure_reason,
      })),
    })
  } catch (err) {
    console.error('List my delivery assignments error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// PUT /api/delivery/assignments/:id/status — apps/repartidor/src/app/page.tsx
// (handleStatusUpdate, handleAcceptAlert). Found missing during S07's audit:
// the ONLY status-update route that existed was `POST /api/deliveries/:id/status`
// (plural, gated behind requireAuthMiddleware which only validates API keys —
// a driver's session cookie would 401 there even if the path matched). Same
// fix pattern as Despacho admin (S02): reuse delivery_assignments, add the
// session-cookie-auth surface under the singular /api/delivery/* prefix.
// A driver may only update an assignment that's actually theirs.
app.put('/api/delivery/assignments/:id/status', async (c) => {
  const authUser = await requireSession(c, ['delivery'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const status = body.status
  if (!status) return c.json({ error: 'Missing status' }, 400)

  try {
    const [existing] = await sql`SELECT driver_id, order_id FROM delivery_assignments WHERE id = ${id}`
    if (!existing) return c.json({ error: 'Assignment not found' }, 404)
    if (existing.driver_id !== authUser.id) return c.json({ error: 'Forbidden' }, 403)

    const timestampCol = status === 'accepted' ? sql`accepted_at = NOW(),`
      : status === 'in_transit' ? sql`picked_up_at = NOW(),`
      : status === 'delivered' ? sql`delivered_at = NOW(),`
      : status === 'failed' ? sql`failed_at = NOW(),`
      : sql``

    const paymentCond = body.amountCollected
      ? sql`payment_at_door = 'collected', payment_method = ${body.paymentMethod ?? 'cash'},`
      : sql``

    await sql`
      UPDATE delivery_assignments
      SET status = ${status}, ${timestampCol} ${paymentCond} updated_at = NOW()
      WHERE id = ${id}
    `

    if (status === 'delivered') {
      await sql`UPDATE orders SET status = 'entregada' WHERE id = ${existing.order_id}`
    }

    return c.json({ ok: true, status })
  } catch (err) {
    console.error('Driver status update error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/delivery/location — GPS ping while `status = in_transit`
// (apps/repartidor/src/app/page.tsx, watchPosition + 30s interval fallback).
// Writes to delivery_location_pings (packages/db/src/schema/delivery.ts) — a
// standalone tracking table, separate from delivery_assignments itself, so a
// dense stream of pings never touches the assignment row. driver_id always
// comes from the session, never the request body.
app.post('/api/delivery/location', async (c) => {
  const authUser = await requireSession(c, ['delivery'])
  if (authUser instanceof Response) return authUser

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const { assignmentId, latitude, longitude, accuracy } = body
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return c.json({ error: 'Missing latitude/longitude' }, 400)
  }

  try {
    await sql`
      INSERT INTO delivery_location_pings (driver_id, assignment_id, latitude, longitude, accuracy)
      VALUES (${authUser.id}, ${assignmentId ?? null}, ${latitude}, ${longitude}, ${accuracy ?? null})
    `
    return c.json({ ok: true })
  } catch (err) {
    console.error('Location ping error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// DESPACHO — repartidores / Rappi / liquidaciones (Cerebro + POS admin views)
// Role owner/admin/staff (matriz sección 6.1 — mismo grupo que Despacho arriba).
// ============================================================================

// GET /api/delivery/drivers — selector de repartidor en Despacho
// (apps/pos/src/components/pos/delivery/{assign-driver-modal,dispatch-panel,
// dispatch-bifurcation-panel}.tsx). Distinct from `GET /api/auth/users`
// (which also lists staff/admin/owner accounts, no `activeJobs`) — this is
// scoped to role=delivery only and adds the one field those 3 modals all
// actually need: how many jobs each driver currently has in flight.
app.get('/api/delivery/drivers', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT
        u.id, u.name, u.email,
        COUNT(da.id) FILTER (WHERE da.status IN ('assigned', 'accepted', 'in_transit')) AS active_jobs
      FROM users u
      LEFT JOIN delivery_assignments da ON da.driver_id = u.id
      WHERE u.role = 'delivery' AND u.is_active = true
      GROUP BY u.id, u.name, u.email
      ORDER BY u.name ASC
    `
    return c.json({
      drivers: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        activeJobs: Number(r.active_jobs),
      })),
    })
  } catch (err) {
    console.error('List drivers error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/delivery/dispatch-rappi — apps/pos/.../rappi-dispatch-modal.tsx.
// NO REAL RAPPI INTEGRATION EXISTS. This does not call any Rappi API — Seoul
// Kims has no Rappi merchant/API credentials configured today (see CLAUDE.md
// "Logística: Rappi + Metro Merval" — mentioned as a channel, no credentials
// documented anywhere in this repo's env vars). What this endpoint does is
// exactly what the schema already models for this case (`dispatch_type`,
// `third_party_name`, `third_party_tracking` on delivery_assignments, added
// in migrate-0009 "Bifurcación de flota: interna vs. terceros"): record, in
// our own DB, that staff manually handed the order to a Rappi courier whose
// name/tracking code they read off the Rappi app/SMS and typed into the
// modal. If/when the business gets real Rappi API credentials, this is the
// endpoint to extend with an actual outbound call — until then this is
// bookkeeping, not dispatch automation, and must not be presented as more.
app.post('/api/delivery/dispatch-rappi', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const { orderId, thirdPartyName, thirdPartyTracking, amountToCollect, paymentAtDoor } = body
  if (!orderId || !thirdPartyName) {
    return c.json({ error: 'Missing orderId or thirdPartyName' }, 400)
  }

  try {
    const [order] = await sql`SELECT id FROM orders WHERE id = ${orderId}`
    if (!order) return c.json({ error: 'Order not found' }, 404)

    const [existing] = await sql`SELECT id FROM delivery_assignments WHERE order_id = ${orderId}`

    let assignmentId: string
    if (existing) {
      await sql`
        UPDATE delivery_assignments
        SET dispatch_type = 'rappi',
            third_party_name = ${thirdPartyName},
            third_party_tracking = ${thirdPartyTracking ?? null},
            third_party_saved_at = NOW(),
            third_party_saved_by = ${authUser.id},
            status = 'assigned',
            assigned_at = NOW(),
            amount_to_collect = ${amountToCollect ?? 0},
            payment_at_door = ${paymentAtDoor ?? 'not_required'},
            updated_at = NOW()
        WHERE id = ${existing.id}
      `
      assignmentId = existing.id
    } else {
      const [created] = await sql`
        INSERT INTO delivery_assignments
          (order_id, dispatch_type, third_party_name, third_party_tracking,
           third_party_saved_at, third_party_saved_by, status, assigned_at,
           amount_to_collect, payment_at_door)
        VALUES
          (${orderId}, 'rappi', ${thirdPartyName}, ${thirdPartyTracking ?? null},
           NOW(), ${authUser.id}, 'assigned', NOW(),
           ${amountToCollect ?? 0}, ${paymentAtDoor ?? 'not_required'})
        RETURNING id
      `
      assignmentId = created.id
    }

    console.log(`✅ Rappi dispatch recorded for order ${orderId} (${thirdPartyName})`)
    return c.json({ ok: true, assignmentId })
  } catch (err) {
    console.error('Dispatch Rappi error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/delivery/drivers/:driverId/z-report — apps/pos/.../driver-z-report-modal.tsx.
// Computes the pending liquidation period for one driver: from the moment
// right after their last paid payout (or the epoch, if they've never been
// paid) up to now. KNOWN LIMITATION (documented, not fixed here — out of
// S07 scope): `distancia_km` / `monto_repartidor_clp` on delivery_assignments
// are columns modeled in migrate-0009 but NO endpoint anywhere in this
// codebase (this session included) ever writes them — there is no distance-
// tracking logic yet (would need to derive km from the location-ping trail
// this session just started collecting, or from a maps API). So `totalKm`
// and `grossClp` will correctly read as 0 today for every driver, and
// `netPayable` will be 0-minus-cashCollected, until a future session adds
// that computation. Not faked here.
app.get('/api/delivery/drivers/:driverId/z-report', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { driverId } = c.req.param()

  try {
    const [driver] = await sql`SELECT id, name, email FROM users WHERE id = ${driverId} AND role = 'delivery'`
    if (!driver) return c.json({ error: 'Driver not found' }, 404)

    const [lastPayout] = await sql`
      SELECT period_to FROM delivery_payouts
      WHERE driver_id = ${driverId}
      ORDER BY period_to DESC
      LIMIT 1
    `
    const periodFrom = lastPayout?.period_to ?? new Date(0)
    const periodTo = new Date()

    const [agg] = await sql`
      SELECT
        COUNT(*) AS deliveries_count,
        COALESCE(SUM(distancia_km), 0) AS total_km,
        COALESCE(SUM(monto_repartidor_clp), 0) AS gross_clp,
        COALESCE(SUM(amount_to_collect) FILTER (WHERE payment_at_door = 'collected'), 0) AS cash_collected
      FROM delivery_assignments
      WHERE driver_id = ${driverId}
        AND status = 'delivered'
        AND delivered_at > ${periodFrom}
        AND delivered_at <= ${periodTo}
    `

    const grossClp = Number(agg.gross_clp)
    const cashCollected = Number(agg.cash_collected)

    return c.json({
      driver: { id: driver.id, name: driver.name, email: driver.email },
      periodFrom: periodFrom instanceof Date ? periodFrom.toISOString() : periodFrom,
      periodTo: periodTo.toISOString(),
      deliveriesCount: Number(agg.deliveries_count),
      totalKm: Number(agg.total_km),
      grossClp,
      cashCollected,
      netPayable: grossClp - cashCollected,
    })
  } catch (err) {
    console.error('Driver z-report error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/delivery/payouts — historial de liquidaciones (sección 7 del plan
// maestro la lista explícitamente). Sin consumidor de GET en las 4 apps hoy
// (solo el POST de abajo, disparado por "Liquidar turno" en
// driver-z-report-modal.tsx) — se construye igual porque el plan la pide y
// porque es la lectura natural que necesitará una futura pantalla de
// historial de liquidaciones. Optional `?driverId=` filters to one driver.
app.get('/api/delivery/payouts', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const driverId = c.req.query('driverId')

  try {
    const rows = driverId
      ? await sql`
          SELECT dp.*, u.name AS driver_name, u.email AS driver_email
          FROM delivery_payouts dp
          JOIN users u ON u.id = dp.driver_id
          WHERE dp.driver_id = ${driverId}
          ORDER BY dp.created_at DESC
        `
      : await sql`
          SELECT dp.*, u.name AS driver_name, u.email AS driver_email
          FROM delivery_payouts dp
          JOIN users u ON u.id = dp.driver_id
          ORDER BY dp.created_at DESC
        `
    return c.json({
      payouts: rows.map((r: any) => ({
        id: r.id,
        driverId: r.driver_id,
        driverName: r.driver_name,
        driverEmail: r.driver_email,
        periodFrom: r.period_from,
        periodTo: r.period_to,
        deliveriesCount: r.deliveries_count,
        totalKm: r.total_km,
        grossClp: r.gross_clp,
        cashCollected: r.cash_collected,
        netPayable: r.net_payable,
        paidAt: r.paid_at,
        notes: r.notes,
      })),
    })
  } catch (err) {
    console.error('List payouts error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/delivery/payouts — "Liquidar turno" button in
// driver-z-report-modal.tsx. Registers (and immediately marks paid — this IS
// the "pay now" action, there's no separate approval step in the UI) a
// payout using the exact figures the z-report GET above just computed and
// the modal echoed back in the request body.
app.post('/api/delivery/payouts', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const {
    driverId, periodFrom, periodTo, deliveriesCount,
    totalKm, grossClp, cashCollected, netPayable, notes,
  } = body
  if (!driverId || !periodFrom || !periodTo) {
    return c.json({ error: 'Missing driverId/periodFrom/periodTo' }, 400)
  }

  try {
    const [payout] = await sql`
      INSERT INTO delivery_payouts
        (driver_id, period_from, period_to, deliveries_count, total_km,
         gross_clp, cash_collected, net_payable, paid_at, paid_by, notes)
      VALUES
        (${driverId}, ${periodFrom}, ${periodTo}, ${deliveriesCount ?? 0}, ${totalKm ?? 0},
         ${grossClp ?? 0}, ${cashCollected ?? 0}, ${netPayable ?? 0}, NOW(), ${authUser.id}, ${notes ?? null})
      RETURNING id
    `
    console.log(`✅ Payout registered for driver ${driverId}: ${payout.id}`)
    return c.json({ ok: true, id: payout.id })
  } catch (err) {
    console.error('Create payout error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// TIENDA CONFIG (singleton key/value settings) — Ajustes / Seguridad panels
// `tienda_config` (key TEXT PK, value TEXT) already existed in prod, already
// populated (metro_station_name, void_pin, dte_provider, etc — see
// packages/db/src/schema/orders.ts). Generic GET/PUT by key on top of it
// covers the requested analytics_pin without a schema change.
// ============================================================================

// GET /api/tienda-config/public — bank-transfer / QR-payment details shown to whoever is
// paying, during POS checkout (components/pos/checkout/pay-qr.tsx expects
// { config: { bank_name, bank_account, bank_account_type, bank_rut, bank_holder } }).
// Deliberately public/no-auth (unlike the generic :key route below): it's the same bank
// account info a cashier reads out loud for a transfer, and pay-qr.tsx's fetch does not
// send credentials. Registered before the generic '/:key' route so 'public' isn't
// swallowed as an arbitrary settings key with a {key,value} shape.
app.get('/api/tienda-config/public', async (c) => {
  try {
    const keys = ['bank_name', 'bank_account', 'bank_account_type', 'bank_rut', 'bank_holder']
    const rows = await sql`SELECT key, value FROM tienda_config WHERE key IN ${sql(keys)}`
    const byKey = new Map(rows.map((r: any) => [r.key, r.value]))
    return c.json({
      config: {
        bank_name:         byKey.get('bank_name')         ?? null,
        bank_account:      byKey.get('bank_account')      ?? null,
        bank_account_type: byKey.get('bank_account_type') ?? null,
        bank_rut:          byKey.get('bank_rut')           ?? null,
        bank_holder:       byKey.get('bank_holder')        ?? null,
      },
    })
  } catch (err) {
    console.error('Get tienda-config public error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.get('/api/tienda-config/:key', async (c) => {
  // Migrated to requireSession (S01 proof-of-concept, bloqueador P0 #2).
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const key = c.req.param('key')
  try {
    const [row] = await sql`SELECT value FROM tienda_config WHERE key = ${key}`
    return c.json({ key, value: row?.value ?? null })
  } catch (err) {
    console.error('Get tienda-config error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.put('/api/tienda-config/:key', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  const key = c.req.param('key')
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  if (typeof body.value !== 'string') return c.json({ error: 'Missing value' }, 400)

  try {
    await sql`
      INSERT INTO tienda_config (key, value, updated_at)
      VALUES (${key}, ${body.value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `
    return c.json({ ok: true, key, value: body.value })
  } catch (err) {
    console.error('Update tienda-config error:', err)
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

// POST /api/auth/register — crea un usuario STAFF real (usado por el panel Usuarios).
// No es self-signup: requiere sesión válida (mismo guard que GET/PUT/DELETE /api/auth/users),
// genera una contraseña temporal (igual patrón que seedRealUsersIfNeeded) y la envía por
// email con la plantilla de credenciales iniciales — el password que venga en el body del
// formulario se ignora a propósito, nunca se persiste texto plano ni se elige por el creador.
// RBAC (S02, matriz sección 6.1): Usuarios (incluye crear cuentas nuevas) es owner-only.
app.post('/api/auth/register', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  // Rate limit (S02, bloqueador P0 #3): 20 registros / 5 min por owner autenticado.
  const rl = await checkAndRecordRateLimit(c, 'auth:register', { limit: 20, windowMinutes: 5 }, authUser.id)
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const email = String(body.email || '').toLowerCase().trim()
  const name = String(body.name || '').trim()
  const role = body.role || 'staff'
  const cargo = body.cargo || null
  const departamento = body.departamento || null
  const telefonoPersonal = body.telefonoPersonal || null

  if (!email || !name) {
    return c.json({ error: 'Faltan campos requeridos (nombre, email)' }, 400)
  }

  const VALID_ROLES = ['owner', 'admin', 'staff', 'delivery', 'viewer']
  if (!VALID_ROLES.includes(role)) {
    return c.json({ error: 'Rol inválido' }, 400)
  }

  try {
    const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing) {
      return c.json({ error: 'Ya existe un usuario con ese email' }, 409)
    }

    const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
    const passwordHash = PasswordService.hashPassword(tempPassword)

    const [created] = await sql`
      INSERT INTO users (email, password_hash, name, role, is_active, must_change_password, cargo, departamento, telefono_personal)
      VALUES (${email}, ${passwordHash}, ${name}, ${role}, true, true, ${cargo}, ${departamento}, ${telefonoPersonal})
      RETURNING id, email, name, role, is_active, cargo, departamento, telefono_personal, last_login_at, created_at
    `

    try {
      await enqueueEmail(
        email,
        '🎉 ¡Bienvenido a SEUL KING OS v1.0!',
        templates.initialCredentials({
          email,
          password: tempPassword,
          name,
          role,
        }),
        'welcome'
      )
    } catch (emailError) {
      console.error(`⚠️  Register — email error for ${email}:`, emailError)
    }

    return c.json({
      ok: true,
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role,
        isActive: created.is_active,
        cargo: created.cargo,
        departamento: created.departamento,
        telefonoPersonal: created.telefono_personal,
        lastLoginAt: created.last_login_at,
        createdAt: created.created_at,
      },
    })
  } catch (err: any) {
    console.error('Register error:', err)
    if (err?.code === '23505') {
      return c.json({ error: 'Ya existe un usuario con ese email' }, 409)
    }
    return c.json({ error: 'Error al crear usuario' }, 500)
  }
})

// ============================================================================
// PRODUCTOS + INVENTARIO (S03 — Fase 1)
// ============================================================================
// Usa packages/db/src/schema/products.ts e inventory.ts tal cual modelados.
// Todos requieren sesión (requireSession sin restricción de rol — cualquier
// cuenta autenticada de cerebro/pos/web puede consultar catálogo/inventario;
// no hay dato sensible por rol en estos endpoints de solo lectura).

const VALID_PRODUCT_STATUS = ['active', 'inactive', 'discontinued']
const VALID_COLD_CHAIN = ['ambient', 'refrigerated', 'frozen']
const VALID_EXPIRY_FILTERS = ['fresh', 'warning', 'urgent', 'expired']

// Sesión OPCIONAL: apps/web (tienda pública, sin login de cliente aún — eso es
// Fase 3) necesita listar productos sin estar autenticado. Staff (cerebro/pos)
// sigue mandando su cookie y recibe el shape completo (costo, precio B2B,
// descuentos internos); un visitante público recibe solo los campos vendibles
// (ver `isStaff` más abajo) — nunca exponer costo/margen a un anónimo.
app.get('/api/products', async (c) => {
  const authUser = await getOptionalSession(c)
  const isStaff = authUser !== null

  const statusParam = c.req.query('status')
  const q = c.req.query('q')?.trim()
  const category = c.req.query('category')?.trim()
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '100', 10) || 100, 1), 500)

  // Default: solo activos (POS/web nunca deben listar inactivos/descontinuados por
  // accidente). `status=all`/`draft`/etc solo lo puede pedir staff autenticado —
  // un visitante público SIEMPRE ve solo 'active', sin importar el query param.
  const statusCond = !isStaff || !statusParam
    ? sql`AND p.status = 'active'`
    : statusParam === 'all'
      ? sql``
      : VALID_PRODUCT_STATUS.includes(statusParam)
        ? sql`AND p.status = ${statusParam}`
        : sql`AND p.status = 'active'`

  const qCond = q
    ? sql`AND (p.name ILIKE ${'%' + q + '%'} OR p.name_ko ILIKE ${'%' + q + '%'} OR p.sku ILIKE ${'%' + q + '%'} OR p.barcode ILIKE ${'%' + q + '%'} OR p.brand ILIKE ${'%' + q + '%'})`
    : sql``

  // `category` acepta id (uuid, usado por POS) o slug (usado por la tienda web) —
  // los dos frontends lo llaman de forma distinta, esto cubre ambos sin tocarlos.
  const categoryCond = category
    ? sql`AND (p.category_id::text = ${category} OR cat.slug = ${category})`
    : sql``

  try {
    const rows = await sql`
      SELECT
        p.id, p.sku, p.barcode, p.name, p.name_ko, p.slug, p.brand,
        p.cost_price, p.price_retail, p.price_web, p.price_pos, p.price_b2b,
        p.discount_web_pct, p.discount_pos_pct, p.discount_b2b_pct,
        p.is_baes_eligible, p.cold_chain, p.is_weighable, p.status, p.image_url,
        p.category_id, cat.name AS category_name,
        stock.qty_total AS stock_total,
        stock.next_expiry,
        COUNT(*) OVER() AS full_count
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      -- NOTA: inventory_summary existe en el schema pero su migración/trigger
      -- (packages/db/src/migrations/001_inventory_summary.sql) nunca se aplicó
      -- en producción (0 filas, sin trigger instalado) — se agrega en vivo desde
      -- la tabla inventory en vez de confiar en esa tabla derivada y desactualizada.
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(i.quantity), 0) AS qty_total,
          MIN(i.expires_at) FILTER (WHERE i.quantity > 0 AND i.expires_at IS NOT NULL) AS next_expiry
        FROM inventory i
        WHERE i.product_id = p.id
      ) stock ON true
      WHERE 1=1 ${statusCond} ${qCond} ${categoryCond}
      ORDER BY p.name ASC
      LIMIT ${limit}
    `

    return c.json({
      products: rows.map((r: any) => ({
        id: r.id, sku: r.sku, name: r.name, nameKo: r.name_ko,
        slug: r.slug, brand: r.brand,
        priceRetail: r.price_retail, priceWeb: r.price_web,
        isBaesEligible: r.is_baes_eligible, coldChain: r.cold_chain, isWeighable: r.is_weighable,
        status: r.status, imageUrl: r.image_url,
        categoryId: r.category_id, categoryName: r.category_name,
        stockTotal: Number(r.stock_total ?? 0),
        nextExpiry: r.next_expiry,
        // Solo staff autenticado (cerebro/pos) recibe costo, precios internos
        // (POS/B2B) y descuentos — nunca exponer margen a un visitante público.
        ...(isStaff ? {
          barcode: r.barcode,
          costPrice: r.cost_price,
          pricePOS: r.price_pos,
          priceB2B: r.price_b2b,
          discountWebPct: r.discount_web_pct,
          discountPOSPct: r.discount_pos_pct,
          discountB2BPct: r.discount_b2b_pct,
        } : {}),
      })),
      total: rows.length > 0 ? Number(rows[0].full_count) : 0,
    })
  } catch (err) {
    console.error('List products error:', err)
    return c.json({ error: 'Error al listar productos' }, 500)
  }
})

// Público — apps/web (tienda sin login de cliente todavía) también lo consume,
// y no expone nada sensible (solo nombre/slug/emoji de categoría).
app.get('/api/products/meta/categories', async (c) => {
  try {
    const rows = await sql`
      SELECT id, name, slug, emoji, sort_order
      FROM categories
      ORDER BY sort_order ASC, name ASC
    `
    return c.json({
      categories: rows.map((r: any) => ({
        id: r.id, name: r.name, slug: r.slug, emoji: r.emoji, sortOrder: r.sort_order,
      })),
    })
  } catch (err) {
    console.error('List categories error:', err)
    return c.json({ error: 'Error al listar categorías' }, 500)
  }
})

// Usado por el escáner de código de barras del POS (apps/pos/src/app/page.tsx,
// handleScan). También matchea por SKU como fallback — el mismo criterio que ya
// usa el POS contra su caché local de productos antes de llamar a este endpoint.
app.get('/api/products/barcode/:code', async (c) => {
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const code = c.req.param('code')

  try {
    const [p] = await sql`
      SELECT
        p.id, p.sku, p.barcode, p.name, p.name_ko, p.slug, p.brand,
        p.cost_price, p.price_retail, p.price_web, p.price_pos, p.price_b2b,
        p.discount_web_pct, p.discount_pos_pct, p.discount_b2b_pct,
        p.is_baes_eligible, p.cold_chain, p.is_weighable, p.status, p.image_url,
        p.category_id, cat.name AS category_name,
        stock.qty_total AS stock_total
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.quantity), 0) AS qty_total
        FROM inventory i
        WHERE i.product_id = p.id
      ) stock ON true
      WHERE p.barcode = ${code} OR p.sku = ${code}
      LIMIT 1
    `

    if (!p) return c.json({ error: 'Producto no encontrado' }, 404)

    return c.json({
      product: {
        id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, nameKo: p.name_ko,
        slug: p.slug, brand: p.brand,
        costPrice: p.cost_price, priceRetail: p.price_retail, priceWeb: p.price_web,
        pricePOS: p.price_pos, priceB2B: p.price_b2b,
        discountWebPct: p.discount_web_pct, discountPOSPct: p.discount_pos_pct, discountB2BPct: p.discount_b2b_pct,
        isBaesEligible: p.is_baes_eligible, coldChain: p.cold_chain, isWeighable: p.is_weighable,
        status: p.status, imageUrl: p.image_url,
        categoryId: p.category_id, categoryName: p.category_name,
        stockTotal: Number(p.stock_total ?? 0),
      },
    })
  } catch (err) {
    console.error('Barcode lookup error:', err)
    return c.json({ error: 'Error al buscar producto' }, 500)
  }
})

// Detalle completo — usado por cerebro en /products/[id]/edit (getProductById).
// Incluye sellos "Alto En" (Ley 20.606, product_sellos) y galería de imágenes
// (product_images, R2). product_images está vacía en producción hoy (nunca se
// construyó el endpoint de upload) — el campo `url` queda null sin R2_PUBLIC_URL
// configurado, listo para cuando exista.
app.get('/api/products/id/:id', async (c) => {
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const id = c.req.param('id')

  try {
    const [p] = await sql`
      SELECT
        p.id, p.sku, p.barcode, p.name, p.name_ko, p.slug, p.description, p.brand,
        p.cost_price, p.price_retail, p.price_web, p.price_pos, p.price_b2b,
        p.discount_web_pct, p.discount_pos_pct, p.discount_b2b_pct,
        p.weight_grams, p.is_weighable, p.is_baes_eligible, p.cold_chain, p.status, p.image_url,
        p.category_id, cat.name AS category_name,
        stock.qty_total AS stock_total, stock.next_expiry
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(i.quantity), 0) AS qty_total,
          MIN(i.expires_at) FILTER (WHERE i.quantity > 0 AND i.expires_at IS NOT NULL) AS next_expiry
        FROM inventory i
        WHERE i.product_id = p.id
      ) stock ON true
      WHERE p.id = ${id}
      LIMIT 1
    `

    if (!p) return c.json({ error: 'Producto no encontrado' }, 404)

    const [sellos, images] = await Promise.all([
      sql`SELECT sello FROM product_sellos WHERE product_id = ${id}`,
      sql`SELECT id, r2_key, sort_order FROM product_images WHERE product_id = ${id} ORDER BY sort_order ASC`,
    ])

    const r2PublicUrl = process.env.R2_PUBLIC_URL || ''

    return c.json({
      id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, nameKo: p.name_ko,
      slug: p.slug, description: p.description, brand: p.brand,
      costPrice: p.cost_price, priceRetail: p.price_retail, priceWeb: p.price_web,
      pricePOS: p.price_pos, priceB2B: p.price_b2b,
      discountWebPct: p.discount_web_pct, discountPOSPct: p.discount_pos_pct, discountB2BPct: p.discount_b2b_pct,
      weightGrams: p.weight_grams, isWeighable: p.is_weighable, isBaesEligible: p.is_baes_eligible,
      coldChain: p.cold_chain, status: p.status, imageUrl: p.image_url,
      categoryId: p.category_id, categoryName: p.category_name,
      stockTotal: Number(p.stock_total ?? 0), nextExpiry: p.next_expiry,
      sellos: sellos.map((s: any) => s.sello),
      images: images.map((im: any) => ({
        id: im.id,
        url: r2PublicUrl ? `${r2PublicUrl}/${im.r2_key}` : null,
        r2Key: im.r2_key,
        sortOrder: im.sort_order,
      })),
    })
  } catch (err) {
    console.error('Product detail error:', err)
    return c.json({ error: 'Error al obtener producto' }, 500)
  }
})

// GET /api/products/:slug (S10, Fase 3) — detalle público para la tienda
// (apps/web, producto/[slug]/page.tsx vía apiServerFetch, GET /api/products/${slug}).
// Contraparte pública de /api/products/id/:id de arriba (esa exige sesión
// staff y sirve a cerebro por id, no por slug). Siempre público, sin sesión —
// mismo criterio de privacidad de precios que GET /api/products (S03): nunca
// expone costPrice/priceB2B/pricePOS/discountXXXPct a un visitante. Solo
// status='active' es alcanzable por slug — un producto draft/discontinued
// nunca debe ser visible en la tienda pública así se conozca el slug exacto.
//
// Segmento único (`:slug`) — no colisiona con las rutas de arriba
// (meta/categories, barcode/:code, id/:id) porque todas tienen 2 segmentos
// después de /products y esta tiene 1; Hono las distingue por profundidad de
// ruta, no por orden de registro.
app.get('/api/products/:slug', async (c) => {
  const slug = c.req.param('slug')

  try {
    const [p] = await sql`
      SELECT
        p.id, p.sku, p.name, p.name_ko, p.slug, p.description, p.brand,
        p.price_retail, p.price_web,
        p.weight_grams, p.is_weighable, p.is_baes_eligible, p.cold_chain, p.status, p.image_url,
        p.category_id, cat.name AS category_name,
        stock.qty_total AS stock_total, stock.next_expiry
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(i.quantity), 0) AS qty_total,
          MIN(i.expires_at) FILTER (WHERE i.quantity > 0 AND i.expires_at IS NOT NULL) AS next_expiry
        FROM inventory i
        WHERE i.product_id = p.id
      ) stock ON true
      WHERE p.slug = ${slug} AND p.status = 'active'
      LIMIT 1
    `

    if (!p) return c.json({ error: 'Producto no encontrado' }, 404)

    const [sellos, images] = await Promise.all([
      sql`SELECT sello FROM product_sellos WHERE product_id = ${p.id}`,
      sql`SELECT id, r2_key, sort_order FROM product_images WHERE product_id = ${p.id} ORDER BY sort_order ASC`,
    ])

    const r2PublicUrl = process.env.R2_PUBLIC_URL || ''

    return c.json({
      id: p.id, sku: p.sku, name: p.name, nameKo: p.name_ko,
      slug: p.slug, description: p.description, brand: p.brand,
      priceRetail: p.price_retail, priceWeb: p.price_web,
      weightGrams: p.weight_grams, isWeighable: p.is_weighable, isBaesEligible: p.is_baes_eligible,
      coldChain: p.cold_chain, status: p.status, imageUrl: p.image_url,
      categoryId: p.category_id, categoryName: p.category_name,
      stockTotal: Number(p.stock_total ?? 0), nextExpiry: p.next_expiry,
      sellos: sellos.map((s: any) => s.sello),
      images: images.map((im: any) => ({
        id: im.id,
        url: r2PublicUrl ? `${r2PublicUrl}/${im.r2_key}` : null,
        r2Key: im.r2_key,
        sortOrder: im.sort_order,
      })),
    })
  } catch (err) {
    console.error('Product detail by slug error:', err)
    return c.json({ error: 'Error al obtener producto' }, 500)
  }
})

// Listado de lotes de inventario — usado por cerebro en /inventory (getInventory).
// Semáforo de vencimiento (expiryStatus) con los mismos umbrales que
// packages/ui/src/badge-expiry.tsx (getStatus): <0d vencido, <15d urgente,
// <30d por vencer, resto fresco. Filtros calcados de la UI: category (id o
// slug), expiry, cold_chain, baes.
app.get('/api/inventory', async (c) => {
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const category = c.req.query('category')?.trim()
  const expiry = c.req.query('expiry')?.trim()
  const coldChain = c.req.query('cold_chain')?.trim()
  const baes = c.req.query('baes')?.trim()
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '300', 10) || 300, 1), 1000)

  const categoryCond = category
    ? sql`AND (p.category_id::text = ${category} OR cat.slug = ${category})`
    : sql``

  const expiryCond = expiry && VALID_EXPIRY_FILTERS.includes(expiry)
    ? expiry === 'expired'
      ? sql`AND i.expires_at IS NOT NULL AND i.expires_at < NOW()`
      : expiry === 'urgent'
        ? sql`AND i.expires_at IS NOT NULL AND i.expires_at >= NOW() AND i.expires_at < NOW() + INTERVAL '15 days'`
        : expiry === 'warning'
          ? sql`AND i.expires_at IS NOT NULL AND i.expires_at >= NOW() + INTERVAL '15 days' AND i.expires_at < NOW() + INTERVAL '30 days'`
          : sql`AND i.expires_at IS NOT NULL AND i.expires_at >= NOW() + INTERVAL '30 days'`
    : sql``

  const coldChainCond = coldChain && VALID_COLD_CHAIN.includes(coldChain)
    ? sql`AND p.cold_chain = ${coldChain}`
    : sql``

  const baesCond = baes === 'true' ? sql`AND p.is_baes_eligible = true` : sql``

  try {
    const rows = await sql`
      SELECT
        i.id, i.product_id, p.name AS product_name, p.sku, p.brand,
        i.lot, i.quantity, i.expires_at, i.location,
        p.cold_chain, p.is_baes_eligible, cat.name AS category_name,
        CASE
          WHEN i.expires_at IS NULL THEN NULL
          WHEN i.expires_at < NOW() THEN 'expired'
          WHEN i.expires_at < NOW() + INTERVAL '15 days' THEN 'urgent'
          WHEN i.expires_at < NOW() + INTERVAL '30 days' THEN 'warning'
          ELSE 'fresh'
        END AS expiry_status,
        COUNT(*) OVER() AS full_count
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE 1=1 ${categoryCond} ${expiryCond} ${coldChainCond} ${baesCond}
      ORDER BY i.expires_at ASC NULLS LAST
      LIMIT ${limit}
    `

    return c.json({
      items: rows.map((r: any) => ({
        id: r.id, productId: r.product_id, productName: r.product_name, sku: r.sku,
        brand: r.brand, lot: r.lot, quantity: r.quantity,
        expiresAt: r.expires_at, location: r.location,
        coldChain: r.cold_chain, isBaesEligible: r.is_baes_eligible,
        categoryName: r.category_name, expiryStatus: r.expiry_status,
      })),
      total: rows.length > 0 ? Number(rows[0].full_count) : 0,
    })
  } catch (err) {
    console.error('List inventory error:', err)
    return c.json({ error: 'Error al listar inventario' }, 500)
  }
})

// ============================================================================
// ORDERS + DASHBOARD (S04 — Fase 1, Comandas + Dashboard)
// ============================================================================
// Todo lo de aquí abajo requiere sesión de staff SIEMPRE (a diferencia de
// /api/products y /api/categories, que S03 tuvo que abrir con getOptionalSession
// porque la tienda pública los consume sin login). Se verificó con grep en las 4
// apps (`grep -rn "api/dashboard\|api/orders" apps/*/src`) que ni Comandas ni
// Dashboard son consumidos por apps/web (tienda pública) — solo por apps/cerebro
// (Dashboard, Comandas) y apps/pos (polling de pedidos entrantes, fallback de SSE
// de Fase 2/S08). Ningún dato aquí incluye costPrice/priceB2B/pricePOS ni margen —
// son pedidos y agregados de ventas, no el catálogo con precios internos.

const VALID_ORDER_STATUS  = ['nueva', 'preparando', 'lista', 'en_ruta', 'entregada', 'cancelada']
const VALID_ORDER_CHANNEL = ['pos', 'web', 'b2b', 'whatsapp']

// GET /api/orders — listar pedidos con filtros opcionales (status, channel, limit).
// Consumido por cerebro (`getRecentOrders`, Dashboard → tabla "Últimos pedidos",
// solo ?limit) y por POS (`order-events.ts`, fallback de polling cuando el SSE de
// S08 aún no existe, con ?channel=web&status=nueva&limit=10). Roles: owner/admin/
// staff (POS lo usa en operación diaria) + viewer (solo lectura de Dashboard).
app.get('/api/orders', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff', 'viewer'])
  if (authUser instanceof Response) return authUser

  const status  = c.req.query('status')?.trim()
  const channel = c.req.query('channel')?.trim()
  const limit   = Math.min(Math.max(parseInt(c.req.query('limit') || '20', 10) || 20, 1), 200)

  const statusCond = status && VALID_ORDER_STATUS.includes(status)
    ? sql`AND o.status = ${status}`
    : sql``
  const channelCond = channel && VALID_ORDER_CHANNEL.includes(channel)
    ? sql`AND o.channel = ${channel}`
    : sql``

  try {
    const rows = await sql`
      SELECT
        o.id, o.number, o.channel, o.status, o.delivery_mode,
        o.metro_station, o.metro_slot, o.notes, o.total, o.created_at,
        COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE 1=1 ${statusCond} ${channelCond}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `

    return c.json({
      orders: rows.map((r: any) => ({
        // `id` es el contrato de cerebro (RecentOrdersTable); `orderId` es un alias
        // para el tipo IncomingOrder que espera POS en su fallback de polling — las
        // dos apps consumen esta misma lista con nombres de campo distintos.
        id: r.id, orderId: r.id, number: r.number, channel: r.channel, status: r.status,
        deliveryMode: r.delivery_mode, metroStation: r.metro_station, metroSlot: r.metro_slot,
        notes: r.notes, total: r.total, itemCount: Number(r.item_count ?? 0),
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('List orders error:', err)
    return c.json({ error: 'Error al listar pedidos' }, 500)
  }
})

// GET /api/orders/comandas — vista Kanban de Comandas (cerebro): pedidos activos
// (nueva/preparando/lista — NO incluye en_ruta/entregada/cancelada) agrupados por
// columna. Roles: owner/admin/staff (matriz de sección 6.1 — viewer no ve Comandas).
app.get('/api/orders/comandas', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT
        o.id, o.number, o.channel, o.status, o.delivery_mode,
        o.metro_station, o.metro_slot, o.total, o.dte_status, o.created_at,
        COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status IN ('nueva', 'preparando', 'lista')
      GROUP BY o.id
      ORDER BY o.created_at ASC
    `

    const comandas = rows.map((r: any) => ({
      id: r.id, number: r.number, channel: r.channel, status: r.status,
      deliveryMode: r.delivery_mode, metroStation: r.metro_station, metroSlot: r.metro_slot,
      total: r.total, dteStatus: r.dte_status, createdAt: r.created_at,
      itemCount: Number(r.item_count ?? 0),
    }))

    return c.json({
      nueva:      comandas.filter((o: any) => o.status === 'nueva'),
      preparando: comandas.filter((o: any) => o.status === 'preparando'),
      lista:      comandas.filter((o: any) => o.status === 'lista'),
    })
  } catch (err) {
    console.error('Comandas error:', err)
    return c.json({ error: 'Error al listar comandas' }, 500)
  }
})

// GET /api/dashboard/stats — KPIs del panel (cerebro Dashboard). Roles: owner/
// admin/viewer (matriz de sección 6.1 — staff no tiene Dashboard en su matriz;
// coincide con `nav[]` de sidebar.tsx: Dashboard → ['owner','admin','viewer']).
app.get('/api/dashboard/stats', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'viewer'])
  if (authUser instanceof Response) return authUser

  try {
    const [salesToday] = await sql`
      SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cnt
      FROM orders
      WHERE created_at::date = CURRENT_DATE AND status != 'cancelada' AND voided_at IS NULL
    `
    const [salesYesterday] = await sql`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM orders
      WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day' AND status != 'cancelada' AND voided_at IS NULL
    `
    const [activeOrders] = await sql`
      SELECT COUNT(*) AS cnt FROM orders WHERE status IN ('nueva', 'preparando', 'lista', 'en_ruta')
    `
    const [webPending] = await sql`
      SELECT COUNT(*) AS cnt FROM orders
      WHERE channel = 'web' AND status NOT IN ('entregada', 'cancelada')
    `
    // "B2B sin cobrar" (label del KPI en cerebro): sin sistema de wallet/cobranza
    // B2B todavía (Fase 3, S11/S12 — GET /api/b2b/wallet no existe), se define como
    // cotizaciones enviadas al cliente y aún sin resolver (sent/viewed) — lo más
    // cercano a "pendiente" que el modelo de datos permite hoy sin inventar columnas.
    const [b2bPending] = await sql`
      SELECT COUNT(*) AS cnt FROM b2b_quotes WHERE status IN ('sent', 'viewed')
    `
    const [expiringWeek] = await sql`
      SELECT COUNT(DISTINCT product_id) AS cnt FROM inventory
      WHERE quantity > 0 AND expires_at IS NOT NULL
        AND expires_at >= NOW() AND expires_at < NOW() + INTERVAL '7 days'
    `
    // "Stock crítico": no existe columna min_stock en products (packages/db/src/
    // schema/products.ts) — se usa un umbral fijo de 5 unidades totales por
    // producto activo, mismo tipo de decisión pragmática que S03 tomó con
    // inventory_summary (tabla derivada sin trigger, se calcula en vivo).
    const CRITICAL_STOCK_THRESHOLD = 5
    const [criticalStock] = await sql`
      SELECT COUNT(*) AS cnt FROM (
        SELECT p.id
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE p.status = 'active'
        GROUP BY p.id
        HAVING COALESCE(SUM(i.quantity), 0) <= ${CRITICAL_STOCK_THRESHOLD}
      ) low_stock
    `
    const top5 = await sql`
      SELECT p.id AS product_id, p.name, SUM(oi.quantity) AS units, SUM(oi.subtotal) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.created_at::date = CURRENT_DATE AND o.status != 'cancelada' AND o.voided_at IS NULL
      GROUP BY p.id, p.name
      ORDER BY units DESC
      LIMIT 5
    `

    const ventasHoy  = Number(salesToday.total)
    const ventasAyer = Number(salesYesterday.total)
    const deltaVentas = ventasAyer > 0 ? ((ventasHoy - ventasAyer) / ventasAyer) * 100 : null
    const ticketPromedio = Number(salesToday.cnt) > 0 ? ventasHoy / Number(salesToday.cnt) : 0

    return c.json({
      ventasHoy, ventasAyer, deltaVentas, ticketPromedio,
      pedidosActivos: Number(activeOrders.cnt),
      pedidosWebSinDespachar: Number(webPending.cnt),
      b2bPendientes: Number(b2bPending.cnt),
      vencenEstaSemana: Number(expiringWeek.cnt),
      stockCritico: Number(criticalStock.cnt),
      top5Productos: top5.map((r: any) => ({
        productId: r.product_id, name: r.name, units: Number(r.units), revenue: Number(r.revenue),
      })),
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return c.json({ error: 'Error al calcular estadísticas' }, 500)
  }
})

// GET /api/dashboard/alerts — semáforo de vencimiento + DTE fallidos (cerebro
// Dashboard, banners superiores). Roles: owner/admin/viewer (misma matriz que stats).
// Umbral de "urgentes" (3 días) sigue el copy hardcodeado en dashboard/page.tsx
// ("vencen en menos de 3 días") — es un umbral MÁS estricto que el semáforo de
// /api/inventory (15/30 días, BadgeExpiry), a propósito: esto es la alerta crítica
// del Dashboard, no la navegación completa del inventario.
app.get('/api/dashboard/alerts', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'viewer'])
  if (authUser instanceof Response) return authUser

  try {
    const vencidos = await sql`
      SELECT p.id AS product_id, p.name, SUM(i.quantity) AS quantity, MIN(i.expires_at) AS expires_at
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.quantity > 0 AND i.expires_at IS NOT NULL AND i.expires_at < NOW()
      GROUP BY p.id, p.name
      ORDER BY expires_at ASC
    `
    const urgentes = await sql`
      SELECT p.id AS product_id, p.name, SUM(i.quantity) AS quantity, MIN(i.expires_at) AS expires_at
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.quantity > 0 AND i.expires_at IS NOT NULL
        AND i.expires_at >= NOW() AND i.expires_at < NOW() + INTERVAL '3 days'
      GROUP BY p.id, p.name
      ORDER BY expires_at ASC
    `
    const dtesFallidos = await sql`
      SELECT id, number FROM orders WHERE dte_status = 'failed' ORDER BY created_at DESC LIMIT 20
    `

    const vencidosOut = vencidos.map((r: any) => ({
      productId: r.product_id, name: r.name, quantity: Number(r.quantity), expiresAt: r.expires_at,
    }))
    const urgentesOut = urgentes.map((r: any) => ({
      productId: r.product_id, name: r.name, quantity: Number(r.quantity), expiresAt: r.expires_at,
    }))
    const dtesFallidosOut = dtesFallidos.map((r: any) => ({ id: r.id, number: r.number }))

    return c.json({
      vencidos: vencidosOut,
      urgentes: urgentesOut,
      dtesFallidos: dtesFallidosOut,
      hasAlerts: vencidosOut.length > 0 || urgentesOut.length > 0 || dtesFallidosOut.length > 0,
    })
  } catch (err) {
    console.error('Dashboard alerts error:', err)
    return c.json({ error: 'Error al calcular alertas' }, 500)
  }
})

// ============================================================================
// SSE — TIEMPO REAL (S08, Fase 2)
// GET /api/events/pos — apps/pos/src/lib/order-events.ts (EventSource client
// already existed, waiting on this route — was the confirmed
// ERR_CONNECTION_REFUSED). GET /api/events/delivery — apps/repartidor/src/
// lib/delivery-events.ts (same situation).
//
// Both use the single in-process EventEmitter fan-out in ./sse-broadcaster —
// NOT a per-client Postgres LISTEN/NOTIFY and NOT a per-client polling
// `setInterval` (see the header comment there for why: Neon/Railway pool is
// `max: 10`, and that exact mistake already took down the VÉRTICE CRM once).
// The only per-connection timer here is an in-memory heartbeat `setInterval`
// that writes a no-op SSE comment-like `ping` message — it never touches the
// database, so opening 50 of these costs zero extra DB connections.
// ============================================================================

const SSE_HEARTBEAT_MS = 15_000

// GET /api/events/pos — same access group as the rest of POS/Despacho
// (matriz 6.1: owner/admin/staff — not delivery, not viewer).
app.get('/api/events/pos', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  return streamSSE(c, async (stream) => {
    const unsubscribe = onPosEvent((payload) => {
      stream.writeSSE({ data: JSON.stringify(payload) }).catch(() => {})
    })

    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {})
    }, SSE_HEARTBEAT_MS)

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        unsubscribe()
        resolve()
      })
    })
  })
})

// GET /api/events/delivery — role `delivery` only. `driverId` for targeting
// is always `authUser.id` from the session, never a client-supplied value —
// same invariant already established for /api/delivery/assignments/mine and
// /api/delivery/location (S07).
app.get('/api/events/delivery', async (c) => {
  const authUser = await requireSession(c, ['delivery'])
  if (authUser instanceof Response) return authUser

  return streamSSE(c, async (stream) => {
    const unsubscribe = onDeliveryEvent(authUser.id, (payload) => {
      stream.writeSSE({ data: JSON.stringify(payload) }).catch(() => {})
    })

    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {})
    }, SSE_HEARTBEAT_MS)

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        unsubscribe()
        resolve()
      })
    })
  })
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
