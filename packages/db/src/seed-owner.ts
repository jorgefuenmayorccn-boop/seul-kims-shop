// Creates the first owner user for El Cerebro.
// Run: DATABASE_URL=... npx tsx packages/db/src/seed-owner.ts

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { users } from './schema/auth'
import { eq } from 'drizzle-orm'
import { webcrypto } from 'node:crypto'

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) throw new Error('DATABASE_URL requerida')

const sql = neon(DATABASE_URL)
const db  = drizzle(sql)

async function hashPassword(password: string): Promise<string> {
  const enc  = new TextEncoder()
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const key  = await webcrypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 210_000, salt },
    key, 256,
  )
  const saltB64 = Buffer.from(salt).toString('base64')
  const hashB64 = Buffer.from(bits).toString('base64')
  return `pbkdf2$sha256$210000$${saltB64}$${hashB64}`
}

async function main() {
  const email    = process.argv[2]
  const password = process.argv[3]
  const name     = process.argv[4] ?? 'Owner'

  if (!email || !password) {
    console.error('Uso: npx tsx packages/db/src/seed-owner.ts <email> <password> [nombre]')
    process.exit(1)
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    console.error(`Ya existe un usuario con email: ${email}`)
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  const [user] = await db.insert(users).values({
    email,
    passwordHash,
    name,
    role: 'owner',
    isActive: true,
  }).returning({ id: users.id, email: users.email, name: users.name, role: users.role })

  console.log('✓ Owner creado:')
  console.log(`  ID:    ${user.id}`)
  console.log(`  Email: ${user.email}`)
  console.log(`  Nombre: ${user.name}`)
  console.log(`  Rol:   ${user.role}`)
}

main().catch(err => { console.error(err); process.exit(1) })
