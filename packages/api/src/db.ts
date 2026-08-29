import postgres from 'postgres'

// ============================================================================
// ENV & CONFIG
// ============================================================================

export const RESEND_KEY = process.env.RESEND_API_KEY || ''

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@seoulshop.cl'
export const JWT_SECRET = process.env.JWT_SECRET || 'seul-king-os-secret-dev'

export const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost/seul_dev',
  { ssl: 'require', max: 20, idle_timeout: 30, max_lifetime: 3600 })
