// Creates a test B2C customer for development.
// Run: DATABASE_URL=... npx tsx packages/db/src/seed-customer.ts

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { customers } from './schema/customers'
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
  const email    = 'test@seoulkims.cl'
  const password = 'Test1234!'
  const name     = 'Cliente Test'

  const [existing] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email))
  if (existing) {
    console.log(`Cliente ya existe: ${email} (id: ${existing.id})`)
    return
  }

  const passwordHash = await hashPassword(password)
  const id = crypto.randomUUID()

  await db.insert(customers).values({
    id,
    email,
    name,
    passwordHash,
    emailVerified: true,
    emailVerifiedAt: new Date(),
    mustChangePassword: false,
    marketingOptIn: false,
  })

  console.log(`✓ Cliente creado: ${email} / ${password}`)
  console.log(`  ID: ${id}`)
}

main().catch(console.error)
