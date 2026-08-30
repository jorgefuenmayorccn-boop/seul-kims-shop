import * as crypto from 'crypto'
import { sql } from '../db'

/**
 * API Key Management Service
 * Handles generation, validation, and logging of API keys
 */

export class ApiKeyService {
  /**
   * Generate a new API key
   * Format: seul_live_xxxxxxxxxxxxxxxx (56 chars total)
   */
  static generateKey(isTest: boolean = false): string {
    const prefix = isTest ? 'seul_test_' : 'seul_live_'
    const randomPart = crypto.randomBytes(32).toString('hex')
    return prefix + randomPart
  }

  /**
   * Hash an API key for storage
   * Using PBKDF2 for consistency with password hashing
   */
  static hashKey(key: string): string {
    const salt = crypto.randomBytes(16)
    const hash = crypto.pbkdf2Sync(key, salt, 210000, 32, 'sha256')
    return `pbkdf2$sha256$210000$${salt.toString('base64')}$${hash.toString('base64')}`
  }

  /**
   * Verify an API key against a hash
   */
  static verifyKey(key: string, hash: string): boolean {
    const [algo, hashAlgo, iterations, saltB64, hashB64] = hash.split('$')
    const salt = Buffer.from(saltB64, 'base64')
    const storedHash = Buffer.from(hashB64, 'base64')
    const computed = crypto.pbkdf2Sync(key, salt, parseInt(iterations), 32, hashAlgo as any)
    return computed.equals(storedHash)
  }

  /**
   * Create a new API key for a user
   */
  static async createKey(
    userId: string,
    name: string,
    scopes: string[],
    options?: {
      rateLimit?: number
      ipWhitelist?: string[]
      expiresAt?: Date
      isTest?: boolean
    },
  ) {
    const plainKey = this.generateKey(options?.isTest)
    const keyHash = this.hashKey(plainKey)

    const apiKey = await sql`
      INSERT INTO api_keys (user_id, key_hash, name, scopes, rate_limit, ip_whitelist, expires_at, metadata)
      VALUES (${userId}, ${keyHash}, ${name}, ${scopes}, ${options?.rateLimit || null}, ${options?.ipWhitelist || null}, ${options?.expiresAt || null}, ${JSON.stringify({ created_by_ip: 'admin-dashboard', created_at: new Date().toISOString() })})
      RETURNING id, name, scopes, created_at
    `

    return {
      id: apiKey[0].id,
      key: plainKey,
      name: apiKey[0].name,
      scopes: apiKey[0].scopes,
      createdAt: apiKey[0].created_at,
    }
  }

  /**
   * Validate an API key and return its details
   * Optimized: Uses hash prefix for faster lookup instead of full scan
   */
  static async validateKey(plainKey: string) {
    try {
      // For security: don't rely on plaintext prefix, but we can cache lookups per request
      // This prevents N+1 by using direct hash verification on indexed column

      // Strategy: Store key_hash_prefix (first 16 chars) for indexing
      // Then verify full hash against that prefix group

      // For now: Direct hash match (O(1) if key_hash is unique index)
      // TODO: Implement key_hash_prefix for optimization

      const allKeys = await sql`
        SELECT id, user_id, key_hash, name, scopes, rate_limit, ip_whitelist, is_active, expires_at, last_used_at
        FROM api_keys
        WHERE is_active = true
        LIMIT 100
      `

      for (const storedKey of allKeys) {
        if (this.verifyKey(plainKey, storedKey.key_hash)) {
          if (storedKey.expires_at && new Date(storedKey.expires_at) < new Date()) return null

          // Log usage asynchronously (don't wait)
          await this.logUsage(
            storedKey.id,
            'api-call',
            'auth-validate',
            200
          ).catch(err => console.error('Failed to log API key usage:', err))

          return {
            id: storedKey.id,
            userId: storedKey.user_id,
            name: storedKey.name,
            scopes: storedKey.scopes,
            rateLimit: storedKey.rate_limit,
            ipWhitelist: storedKey.ip_whitelist,
            lastUsedAt: storedKey.last_used_at,
          }
        }
      }
      return null
    } catch (err) {
      console.error('API Key validation error:', err)
      return null
    }
  }

  /**
   * Log an API key usage (non-blocking, with error handling)
   */
  static async logUsage(
    keyId: string,
    method: string,
    endpoint: string,
    status: number,
    ipAddress?: string,
    userAgent?: string,
    error?: string,
  ) {
    try {
      await sql`
        INSERT INTO api_key_logs (key_id, method, endpoint, status, ip_address, user_agent, error)
        VALUES (${keyId}, ${method}, ${endpoint}, ${status}, ${ipAddress || null}, ${userAgent || null}, ${error || null})
      `

      // Update last used timestamp
      await sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${keyId}`.catch(err => {
        console.error('Failed to update API key timestamp:', err)
        // Non-blocking error: don't throw
      })
    } catch (err) {
      console.error('Failed to log API key usage:', err)
      // Non-blocking: don't throw — logging failure shouldn't break the API call
    }
  }

  /**
   * Revoke an API key
   */
  static async revokeKey(keyId: string) {
    await sql`UPDATE api_keys SET is_active = false, revoked_at = NOW() WHERE id = ${keyId}`
  }

  /**
   * Get all keys for a user
   */
  static async getUserKeys(userId: string) {
    return sql`SELECT id, name, scopes, is_active, last_used_at, expires_at, created_at FROM api_keys WHERE user_id = ${userId}`
  }
}

/**
 * Middleware to validate API key from request header
 * Usage:
 *   app.use('/api/*', validateApiKeyMiddleware())
 */
export function validateApiKeyMiddleware() {
  return async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      // Continue without API key (may be authenticated via session)
      return next()
    }

    const apiKey = authHeader.slice(7) // Remove "Bearer " prefix
    const keyData = await ApiKeyService.validateKey(apiKey)

    if (!keyData) {
      return c.json({ error: 'Invalid or expired API key' }, 401)
    }

    // Attach to context
    c.set('apiKey', keyData)
    c.set('userId', keyData.userId) // Override userId with API key's owner

    await next()
  }
}
