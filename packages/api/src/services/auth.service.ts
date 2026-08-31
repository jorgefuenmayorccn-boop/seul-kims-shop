import jwt from 'jsonwebtoken'
import { sql } from '../db'
import { PasswordService } from './password.service'

export class AuthService {
  static async login(email: string, password: string, jwtSecret: string) {
    if (!email || !password) {
      return { ok: false, error: 'Missing email or password', status: 400 }
    }

    try {
      const emailLower = email.toLowerCase()
      const result = await sql`SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = ${emailLower} LIMIT 1`

      if (!result || result.length === 0) {
        return { ok: false, error: 'Invalid credentials', status: 401 }
      }

      const user = result[0]

      if (!user.is_active) {
        return { ok: false, error: 'User account is disabled', status: 401 }
      }

      // Validate password against hash
      const isPasswordValid = PasswordService.verifyPassword(password, user.password_hash)
      if (!isPasswordValid) {
        return { ok: false, error: 'Invalid credentials', status: 401 }
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        },
        jwtSecret,
        { expiresIn: '7d' }
      )

      return {
        ok: true,
        status: 200,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      }
    } catch (err) {
      console.error('Login error:', err)
      return { ok: false, error: 'Internal server error', status: 500 }
    }
  }

  static verifyToken(token: string, jwtSecret: string) {
    try {
      const decoded = jwt.verify(token, jwtSecret)
      return { ok: true, decoded }
    } catch (err) {
      return { ok: false, error: 'Invalid or expired token' }
    }
  }
}
