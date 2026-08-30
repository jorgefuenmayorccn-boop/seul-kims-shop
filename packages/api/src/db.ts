import postgres from 'postgres'

// ============================================================================
// ENV & CONFIG
// ============================================================================

export const RESEND_KEY = process.env.RESEND_API_KEY || ''

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@seoulshop.cl'
export const JWT_SECRET = process.env.JWT_SECRET || 'seul-king-os-secret-dev'

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

// Ultra-stable for Cloudflare Workers + Neon (optimized for HTTP request/response cycles)
export const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 5,              // Cloudflare Workers: 5-10 optimal
  idle_timeout: 15,    // 15s before closing idle connections
  max_lifetime: 60,    // Max 60s per connection
  connect_timeout: 5,  // 5s to establish connection
  query_timeout: 8000, // 8s query timeout
  statement_timeout: 8000, // 8s statement timeout
})
