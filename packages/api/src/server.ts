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
import { requireAuthMiddleware, requireScopeMiddleware, requireSession, getOptionalSession } from './middleware/auth.middleware'

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
    return c.json({ ok: true })
  } catch (err) {
    console.error('Assign driver error:', err)
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
