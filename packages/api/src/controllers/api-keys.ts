import { Context } from 'hono'
import { ApiKeyService } from '../services/api-key.service'

/**
 * API Key Management Endpoints
 * Used by staff dashboard to create/revoke/list API keys
 */

export const apiKeysController = {
  /**
   * POST /api/admin/api-keys
   * Create a new API key for the authenticated user
   */
  async create(c: Context) {
    try {
      const userId = c.get('userId')
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const body = await c.req.json()
      const { name, scopes, rateLimit, ipWhitelist, expiresAt } = body

      if (!name || !scopes || !Array.isArray(scopes) || scopes.length === 0) {
        return c.json(
          { error: 'Invalid request: name and scopes required' },
          400,
        )
      }

      const newKey = await ApiKeyService.createKey(userId, name, scopes, {
        rateLimit: rateLimit || undefined,
        ipWhitelist: ipWhitelist || undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      })

      return c.json(newKey, 201)
    } catch (error) {
      console.error('[API Keys] Create error:', error)
      return c.json({ error: 'Failed to create API key' }, 500)
    }
  },

  /**
   * GET /api/admin/api-keys
   * List all API keys for the authenticated user
   */
  async list(c: Context) {
    try {
      const userId = c.get('userId')
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const keys = await ApiKeyService.getUserKeys(userId)

      return c.json(keys, 200)
    } catch (error) {
      console.error('[API Keys] List error:', error)
      return c.json({ error: 'Failed to fetch API keys' }, 500)
    }
  },

  /**
   * POST /api/admin/api-keys/:id/revoke
   * Revoke an API key
   */
  async revoke(c: Context) {
    try {
      const userId = c.get('userId')
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const keyId = c.req.param('id')

      // Verify the key belongs to the user
      const keys = await ApiKeyService.getUserKeys(userId)
      const keyExists = keys.some(k => k.id === keyId)

      if (!keyExists) {
        return c.json({ error: 'API key not found or unauthorized' }, 404)
      }

      await ApiKeyService.revokeKey(keyId)

      return c.json({ success: true, message: 'API key revoked' }, 200)
    } catch (error) {
      console.error('[API Keys] Revoke error:', error)
      return c.json({ error: 'Failed to revoke API key' }, 500)
    }
  },
}
