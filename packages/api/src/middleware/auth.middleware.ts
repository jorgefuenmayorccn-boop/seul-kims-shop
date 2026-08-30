import { Context, Next } from 'hono'
import { ApiKeyService } from '../services/api-key.service'

/**
 * Middleware para validar Bearer token (JWT) o API Key
 * Usado en endpoints que requieren autenticación
 */
export async function requireAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    return c.json({ error: 'Missing Authorization header' }, 401)
  }

  let tokenOrKey = authHeader

  // Bearer token (JWT) o API Key
  if (authHeader.startsWith('Bearer ')) {
    tokenOrKey = authHeader.slice(7)
  }

  // 1. Try API Key validation first (faster)
  const apiKeyData = await ApiKeyService.validateKey(tokenOrKey)
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

  // 2. Try JWT validation (sessions/user login)
  // TODO: Implement JWT validation

  return c.json({ error: 'Invalid or expired credentials' }, 401)
}

/**
 * Middleware para validar scopes específicos en API Keys
 */
export function requireScopeMiddleware(requiredScopes: string[]) {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth')

    if (!auth || auth.type !== 'api-key') {
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

  // TODO: Implement rate limiter (use KV store)
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
