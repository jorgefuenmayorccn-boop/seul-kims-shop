import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { users } from './auth'

// API Key Scopes - what actions this key can perform
export const apiScopeEnum = pgEnum('api_scope', [
  'orders:read',
  'orders:write',
  'products:read',
  'products:write',
  'customers:read',
  'customers:write',
  'inventory:read',
  'inventory:write',
  'reports:read',
  'admin:full', // Full access (use sparingly)
])

/**
 * API Keys table - for programmatic access to SEOUL API
 *
 * Usage:
 * - Third-party integrations (POS, accounting software, etc)
 * - Mobile apps needing API access
 * - Webhooks and automation
 * - Partner integrations
 */
export const apiKeys = pgTable('api_keys', {
  id:           uuid('id').primaryKey().defaultRandom(),

  // Which user created/owns this key
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // The actual API key (stored hashed for security)
  // Format: seul_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (or seul_test_xxx for test keys)
  keyHash:      text('key_hash').notNull().unique(),

  // Human-readable name (e.g., "POS System", "Accounting Integration")
  name:         text('name').notNull(),

  // What this key is allowed to do
  scopes:       apiScopeEnum('scopes').array().notNull(),

  // Rate limiting: requests per minute (null = unlimited)
  rateLimit:    integer('rate_limit'),

  // IP whitelist (array of IP addresses allowed to use this key)
  // null = all IPs allowed
  ipWhitelist:  text('ip_whitelist').array(),

  // Whether this key is active
  isActive:     boolean('is_active').notNull().default(true),

  // Last time this key was used
  lastUsedAt:   timestamp('last_used_at'),

  // Expiration date (null = never expires)
  expiresAt:    timestamp('expires_at'),

  // Metadata: integration name, description, webhook URLs, etc
  metadata:     jsonb('metadata'),

  // Audit trail
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
  revokedAt:    timestamp('revoked_at'), // When key was revoked (if at all)
}, t => ({
  userIdx:      index('api_keys_user_idx').on(t.userId),
  activeIdx:    index('api_keys_active_idx').on(t.isActive),
  expireIdx:    index('api_keys_expire_idx').on(t.expiresAt),
}))

/**
 * API Key Usage Log - for auditing and rate limiting
 * Tracks every API call made with a key (optional, depends on volume)
 */
export const apiKeyLogs = pgTable('api_key_logs', {
  id:         uuid('id').primaryKey().defaultRandom(),

  // Which key made the request
  keyId:      uuid('key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),

  // Request details
  method:     text('method').notNull(), // GET, POST, etc
  endpoint:   text('endpoint').notNull(), // /api/orders, /api/products, etc
  status:     integer('status').notNull(), // 200, 404, 500, etc
  ipAddress:  text('ip_address'),
  userAgent:  text('user_agent'),

  // Request size (for rate limiting)
  requestSize: integer('request_size'),

  // Error message if request failed
  error:      text('error'),

  // When the request happened
  createdAt:  timestamp('created_at').defaultNow(),
}, t => ({
  keyIdx:     index('api_key_logs_key_idx').on(t.keyId),
  endpointIdx: index('api_key_logs_endpoint_idx').on(t.endpoint),
  createdIdx: index('api_key_logs_created_idx').on(t.createdAt),
}))
