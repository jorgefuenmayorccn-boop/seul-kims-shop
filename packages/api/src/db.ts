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
  const dbPass = process.env.DB_PASSWORD || 'npg_PltRoX3VBLg0'
  const dbName = process.env.DB_NAME || 'neondb'
  if (dbHost && dbUser) {
    return `postgresql://${dbUser}:${dbPass}@${dbHost}/${dbName}?sslmode=require&channel_binding=require`
  }
  return 'postgresql://localhost/seul_dev'
})()

// Optimized for Cloudflare Workers + Neon PaaS
export const sql = postgres(DATABASE_URL,
  {
    ssl: 'require',
    max: 5,
    idle_timeout: 20,
    max_lifetime: 120,
    connect_timeout: 6,
  })
