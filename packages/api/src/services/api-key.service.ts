import * as crypto from 'crypto'
import { db } from '../db'
import { apiKeys, apiKeyLogs } from '@seul/db/schema'
import { eq, and } from 'drizzle-orm'

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

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        userId,
        keyHash,
        name,
        scopes: scopes as any,
        rateLimit: options?.rateLimit,
        ipWhitelist: options?.ipWhitelist,
        expiresAt: options?.expiresAt,
        metadata: {
          created_by_ip: 'admin-dashboard', // Can be set from request IP
          created_at: new Date().toISOString(),
        },
      })
      .returning()

    return {
      id: apiKey.id,
      key: plainKey, // Only returned once at creation
      name: apiKey.name,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    }
  }

  /**
   * Validate an API key and return its details
   */
  static async validateKey(plainKey: string) {
    // Extract key prefix to determine if test or live
    const isTest = plainKey.startsWith('seul_test_')

    // Find key by hash (but we can't query by hash easily)
    // In production, would use a separate table with hashed keys as the key
    // For now, fetch all keys and verify (not ideal for scale, but works)
    const allKeys = await db.select().from(apiKeys)

    for (const storedKey of allKeys) {
      if (this.verifyKey(plainKey, storedKey.keyHash)) {
        // Check if key is active
        if (!storedKey.isActive) {
          return null // Key is revoked
        }

        // Check if key is expired
        if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
          return null // Key is expired
        }

        return {
          id: storedKey.id,
          userId: storedKey.userId,
          name: storedKey.name,
          scopes: storedKey.scopes,
          rateLimit: storedKey.rateLimit,
          ipWhitelist: storedKey.ipWhitelist,
          lastUsedAt: storedKey.lastUsedAt,
        }
      }
    }

    return null // Key not found or invalid
  }

  /**
   * Log an API key usage
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
    await db.insert(apiKeyLogs).values({
      keyId,
      method,
      endpoint,
      status,
      ipAddress,
      userAgent,
      error,
      requestSize: undefined,
    })

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ updatedAt: new Date() })
      .where(eq(apiKeys.id, keyId))
  }

  /**
   * Revoke an API key
   */
  static async revokeKey(keyId: string) {
    await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId))
  }

  /**
   * Get all keys for a user
   */
  static async getUserKeys(userId: string) {
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
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
