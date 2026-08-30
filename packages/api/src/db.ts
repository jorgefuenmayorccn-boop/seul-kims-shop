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
