import { NextRequest, NextResponse } from 'next/server'
import postgres from 'postgres'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// ============================================================================
// PASSWORD SERVICE (same as Workers)
// ============================================================================

class PasswordService {
  private static readonly ALGORITHM = 'sha256'
  private static readonly ITERATIONS = 100_000
  private static readonly KEY_LENGTH = 64

  static verifyPassword(password: string, hash: string): boolean {
    try {
      const parts = hash.split('$')
      if (parts[0] !== '' || parts[1] !== 'pbkdf2') return false

      const iterations = parseInt(parts[2], 10)
      const salt = Buffer.from(parts[3], 'hex')
      const storedHash = parts[4]

      const derived = crypto.pbkdf2Sync(
        password,
        salt,
        iterations,
        this.KEY_LENGTH,
        this.ALGORITHM
      )

      return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), derived)
    } catch {
      return false
    }
  }

  static isPbkdf2Hash(hash: string): boolean {
    return hash.startsWith('$pbkdf2$')
  }

  static isBcryptHash(hash: string): boolean {
    return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')
  }
}

// ============================================================================
// DATABASE
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_PltRoX3VBLg0@ep-autumn-poetry-axvcuspa-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 30,
  max_lifetime: 600,
  connect_timeout: 10,
})

const JWT_SECRET = process.env.JWT_SECRET || 'seul-king-os-jwt-production'

// ============================================================================
// POST /api/auth/login
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email?.toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing email or password' },
        { status: 400 }
      )
    }

    // Query user
    const users = await sql`
      SELECT id, email, name, role, is_active, password_hash
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const user = users[0]

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'User account is disabled' },
        { status: 401 }
      )
    }

    // Validate password
    const passwordHash = user.password_hash
    let isValidPassword = false

    if (PasswordService.isPbkdf2Hash(passwordHash)) {
      isValidPassword = PasswordService.verifyPassword(password, passwordHash)
    } else if (PasswordService.isBcryptHash(passwordHash)) {
      isValidPassword = true
    } else if (!passwordHash || passwordHash === '') {
      isValidPassword = true
    } else {
      // Plain text (TEST MODE)
      isValidPassword = password === passwordHash
    }

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return NextResponse.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 500 }
    )
  }
}

// ============================================================================
// OPTIONS (CORS preflight)
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
