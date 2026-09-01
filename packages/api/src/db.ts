import postgres from 'postgres'
import * as crypto from 'crypto'

// ============================================================================
// ENV & CONFIG
// ============================================================================

export const RESEND_KEY = process.env.RESEND_API_KEY || ''

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@seoulshop.cl'

// JWT_SECRET must never silently fall back to a hardcoded value in production —
// that hardcoded value lives in this file's git history, so a silent fallback
// would mean anyone could forge valid session tokens. Same throw-if-missing
// pattern as DATABASE_URL below. In non-production (local dev), keep a fixed
// dev-only fallback so `pnpm dev` keeps working without extra setup.
export const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production')
  }
  return 'seul-king-os-secret-dev'
})()

// CUSTOMER_JWT_SECRET (S09) — customer-facing sessions (apps/web, cookie
// `seul_customer_session`) must never be verifiable with the STAFF JWT_SECRET
// above, and vice versa. Rather than requiring a brand-new Railway secret
// (risk: forgetting to set it would `throw` and crash the whole API on next
// deploy, same failure mode JWT_SECRET/DATABASE_URL guard against), this is
// deterministically derived from JWT_SECRET via HMAC-SHA256 with a fixed,
// distinguishing label. Result: a customer JWT is cryptographically invalid
// if presented as a staff Bearer token (and vice versa) — signature
// verification fails outright, not just a payload-shape mismatch — with zero
// new ops dependency. See middleware/auth.middleware.ts `requireCustomerSession`.
export const CUSTOMER_JWT_SECRET = crypto
  .createHmac('sha256', JWT_SECRET)
  .update('seul-customer-session-v1')
  .digest('hex')

// Build DATABASE_URL from env vars or use direct URL
const DATABASE_URL = (() => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const dbHost = process.env.DB_HOST
  const dbUser = process.env.DB_USER
  const dbPass = process.env.DB_PASSWORD
  const dbName = process.env.DB_NAME || 'neondb'
  if (dbHost && dbUser && dbPass) {
    return `postgresql://${dbUser}:${dbPass}@${dbHost}/${dbName}?sslmode=require&channel_binding=require`
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD must be configured')
  }
  return 'postgresql://localhost/seul_dev'
})()

// Optimized for Railway + Neon (stable connection pooling)
export const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 10,             // Increased: more simultaneous connections
  idle_timeout: 60,    // Increased: 60s before closing idle connections
  max_lifetime: 300,   // Increased: 5min max per connection (was 60s)
  connect_timeout: 10, // Increased: 10s to establish connection (was 5s)
  query_timeout: 10000, // Increased: 10s query timeout (was 8s)
  statement_timeout: 10000, // Increased: 10s statement timeout (was 8s)
})
