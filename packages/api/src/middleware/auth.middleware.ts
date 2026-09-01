import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { ApiKeyService } from '../services/api-key.service'
import { AuthService } from '../services/auth.service'
import { JWT_SECRET } from '../db'

// Must match SESSION_COOKIE_NAME in server.ts. There's no shared constants module
// between server.ts and middleware/ today, so this is kept in sync manually.
const SESSION_COOKIE_NAME = 'seul_session'

/**
 * Middleware para validar Bearer token (JWT) o API Key
 * Usado en endpoints que requieren autenticación
 */
export async function requireAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  // A bare (non-"Bearer ") Authorization header is how API-key clients call today —
  // preserve that behavior. A JWT never arrives that way in this codebase.
  const rawHeaderKey = authHeader && !authHeader.startsWith('Bearer ') ? authHeader : undefined

  // 1. Try API Key validation first (faster)
  const apiKeyCandidate = rawHeaderKey || bearerToken
  if (apiKeyCandidate) {
    const apiKeyData = await ApiKeyService.validateKey(apiKeyCandidate)
    if (apiKeyData) {
      c.set('auth', {
        type: 'api-key',
        id: apiKeyData.id,
        userId: apiKeyData.userId,
        scopes: apiKeyData.scopes,
        rateLimit: apiKeyData.rateLimit,
      })
      return next()
    }
  }

  // 2. Try JWT validation (session cookie or "Authorization: Bearer <jwt>") — same
  // token-lookup pattern as handleGetMe/getAuthUser in server.ts.
  const jwtToken = bearerToken || getCookie(c, SESSION_COOKIE_NAME)
  if (jwtToken) {
    const verified = AuthService.verifyToken(jwtToken, JWT_SECRET)
    if (verified.ok) {
      const decoded = verified.decoded as any
      c.set('user', decoded)
      c.set('auth', {
        type: 'jwt',
        userId: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      })
      return next()
    }
  }

  return c.json({ error: 'Invalid or expired credentials' }, 401)
}

/**
 * requireSession — canonical session-auth helper (S01, bloqueador P0 #2).
 *
 * Reads the JWT from `Authorization: Bearer <token>` or the `seul_session`
 * cookie — the exact same token-lookup pattern as `handleGetMe`/`getAuthUser`
 * in server.ts — verifies it with AuthService, and optionally checks the
 * user's role.
 *
 * This is NOT Hono middleware (no `next()`) — it's called directly inside a
 * handler body, since that's how every existing session-checked endpoint in
 * server.ts is structured today (no middleware chain per route). Usage:
 *
 *   const authUser = await requireSession(c)
 *   if (authUser instanceof Response) return authUser
 *   // authUser is now { id, email, role, name }
 *
 *   const authUser = await requireSession(c, ['owner', 'admin'])
 *   if (authUser instanceof Response) return authUser
 *
 * DECISION (S01): every NEW session-checked endpoint added from here on
 * should use this instead of re-implementing the cookie/Bearer parsing that
 * `handleGetMe`/`getAuthUser` in server.ts originally established and that
 * several endpoints (users, shifts, till-sessions, delivery/assignments,
 * tienda-config, register) have each copy-pasted independently. Existing
 * endpoints are NOT all migrated in S01 — only a few low-risk read-only ones,
 * as a proof of concept — to avoid regressing endpoints that already work in
 * production. Full migration of the remaining endpoints is follow-up work,
 * not blocking S01.
 */
export async function requireSession(
  c: Context,
  roles?: string[]
): Promise<{ id: string; email: string; role: string; name: string } | Response> {
  const authHeader = c.req.header('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const token = bearerToken || getCookie(c, SESSION_COOKIE_NAME)

  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  const verified = AuthService.verifyToken(token, JWT_SECRET)
  if (!verified.ok) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  const user = verified.decoded as { id: string; email: string; role: string; name: string }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return user
}

// Like requireSession, but never fails: returns the authenticated user if a
// valid session is present, or null for an anonymous/public caller. Used by
// endpoints that must serve BOTH staff (cerebro/pos, full data) and public
// visitors (apps/web storefront, no session) — e.g. the product catalog.
export async function getOptionalSession(
  c: Context
): Promise<{ id: string; email: string; role: string; name: string } | null> {
  const authHeader = c.req.header('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const token = bearerToken || getCookie(c, SESSION_COOKIE_NAME)
  if (!token) return null

  const verified = AuthService.verifyToken(token, JWT_SECRET)
  if (!verified.ok) return null

  return verified.decoded as { id: string; email: string; role: string; name: string }
}

/**
 * Middleware para validar scopes específicos en API Keys
 */
export function requireScopeMiddleware(requiredScopes: string[]) {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth')

    if (!auth) {
      return c.json({ error: 'API key required' }, 401)
    }

    // Scopes are a restriction mechanism for third-party API keys. A JWT session
    // (staff/admin logged in via cookie or Bearer token) is already fully
    // authenticated by requireAuthMiddleware, so it bypasses the scope check.
    if (auth.type === 'jwt') {
      return next()
    }

    if (auth.type !== 'api-key') {
      return c.json({ error: 'API key required' }, 401)
    }

    const hasAllScopes = requiredScopes.every(scope => auth.scopes.includes(scope))

    if (!hasAllScopes) {
      return c.json(
        { error: `Missing scopes: ${requiredScopes.join(', ')}` },
        403
      )
    }

    return next()
  }
}

/**
 * Middleware para rate limiting por API Key
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  const auth = c.get('auth')

  if (!auth || !auth.rateLimit) {
    return next() // Sin limite
  }

  // NOTE (S02, bloqueador P0 #3): the generic, KV-free rate limiter now lives as
  // `checkAndRecordRateLimit(c, action, opts, identifier?)` in server.ts, using a
  // Postgres table (`rate_limit_events`, migration 0016) — same pattern as the
  // existing login_attempts limiter. It is applied directly inside the handlers
  // for POST /api/orders, POST /api/b2b/quotes, and POST /api/auth/register
  // (the highest-risk write endpoints), not through this Hono middleware, because
  // this middleware only runs for API-key-scoped routes (`auth.rateLimit` above)
  // while those three endpoints are reached via JWT session too. Wiring API-key
  // `rateLimit` config through the same helper is follow-up work, not done in S02.
  return next()
}

/**
 * Middleware para IP whitelist validation
 */
export async function ipWhitelistMiddleware(c: Context, next: Next) {
  const auth = c.get('auth')

  if (!auth || !auth.ipWhitelist || auth.ipWhitelist.length === 0) {
    return next() // Sin restricción de IP
  }

  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'

  if (!auth.ipWhitelist.includes(clientIp)) {
    return c.json({ error: 'IP address not whitelisted' }, 403)
  }

  return next()
}
