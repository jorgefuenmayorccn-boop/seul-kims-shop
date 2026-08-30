import * as crypto from 'crypto'

/**
 * Password hashing service — PBKDF2-SHA256 (NIST PKCS#5 compatible)
 * Workers-native, zero external dependencies
 */
export class PasswordService {
  private static readonly ALGORITHM = 'sha256'
  private static readonly ITERATIONS = 100_000 // NIST recommendation: ≥100k
  private static readonly KEY_LENGTH = 64 // 512 bits
  private static readonly SALT_LENGTH = 32 // 256 bits

  /**
   * Hash a password using PBKDF2-SHA256
   * Returns: "$pbkdf2$iterations$salt$hash"
   */
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(this.SALT_LENGTH)
    const hash = crypto.pbkdf2Sync(
      password,
      salt,
      this.ITERATIONS,
      this.KEY_LENGTH,
      this.ALGORITHM
    )
    return `$pbkdf2$${this.ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`
  }

  /**
   * Verify password against PBKDF2 hash
   */
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

      // Timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(storedHash, 'hex'),
        derived
      )
    } catch {
      return false
    }
  }

  /**
   * Check if hash is legacy bcrypt (for migration)
   */
  static isBcryptHash(hash: string): boolean {
    return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')
  }

  /**
   * Check if hash is modern PBKDF2
   */
  static isPbkdf2Hash(hash: string): boolean {
    return hash.startsWith('$pbkdf2$')
  }
}
