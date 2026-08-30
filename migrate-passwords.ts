#!/usr/bin/env node
/**
 * Password Migration Script: bcrypt → PBKDF2-SHA256
 *
 * USAGE:
 *   DATABASE_URL=... npx tsx migrate-passwords.ts
 *
 * SAFETY:
 *   - Reads all users
 *   - Hashes passwords with PBKDF2-SHA256
 *   - Updates only empty password fields (first-time setup)
 *   - Skips existing bcrypt/PBKDF2 hashes
 */

import postgres from 'postgres'
import crypto from 'crypto'

const sql = postgres(
  process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_PltRoX3VBLg0@ep-autumn-poetry-axvcuspa-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  { ssl: 'require' }
)

// PBKDF2-SHA256 implementation (same as PasswordService)
function hashPassword(password: string): string {
  const ITERATIONS = 100_000
  const KEY_LENGTH = 64
  const SALT_LENGTH = 32
  const ALGORITHM = 'sha256'

  const salt = crypto.randomBytes(SALT_LENGTH)
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, ALGORITHM)
  return `$pbkdf2$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`
}

async function migratePasswords() {
  console.log('\n🔐 PASSWORD MIGRATION: bcrypt → PBKDF2-SHA256\n')
  console.log('════════════════════════════════════════\n')

  try {
    // Default passwords for known test users
    const defaults: Record<string, string> = {
      'founder@seoulshop.cl': 'Seoul2025!Founder',
      'gerente@seoulshop.cl': 'Seoul2025!Gerente',
      'repartidor.test@seoulshop.cl': 'Seoul2025!Repartidor',
      // Add more as needed
    }

    // Get all users
    const users = await sql`SELECT id, email, "passwordHash" FROM users ORDER BY email`

    let updated = 0
    let skipped = 0

    for (const user of users) {
      const { id, email, passwordHash } = user
      const defaultPassword = defaults[email]

      // Skip if already has valid hash
      if (passwordHash && (passwordHash.startsWith('$pbkdf2$') || passwordHash.startsWith('$2'))) {
        console.log(`⏭️  ${email} — Already hashed`)
        skipped++
        continue
      }

      // Use default password or generate random
      const password = defaultPassword || crypto.randomBytes(12).toString('base64')
      const newHash = hashPassword(password)

      await sql`UPDATE users SET "passwordHash" = ${newHash} WHERE id = ${id}`

      console.log(`✅ ${email}`)
      if (defaultPassword) {
        console.log(`   Password: ${password}`)
      } else {
        console.log(`   Random password generated (user must reset)`)
      }
      updated++
    }

    console.log('\n════════════════════════════════════════')
    console.log(`\n📊 Migration complete:`)
    console.log(`   ✅ Updated: ${updated}`)
    console.log(`   ⏭️  Skipped: ${skipped}`)
    console.log(`\n🎯 Next steps:`)
    console.log(`   1. Test login with new credentials`)
    console.log(`   2. Users without defaults must reset password on first login`)
    console.log(`   3. Remove bcrypt validation fallback in 30 days\n`)

    await sql.end()
    process.exit(0)
  } catch (err) {
    console.error('❌ Migration failed:', err)
    await sql.end()
    process.exit(1)
  }
}

migratePasswords()
