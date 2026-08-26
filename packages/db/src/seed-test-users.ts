// Seed usuarios de prueba para testing local — ejecutar una vez
// DATABASE_URL=... npx tsx packages/db/src/seed-test-users.ts

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { users } from './schema/auth'
import { customers, b2bCompanies } from './schema/customers'
import { eq } from 'drizzle-orm'
import { webcrypto } from 'node:crypto'

const db = drizzle(neon(process.env.DATABASE_URL!))

async function hashPassword(password: string): Promise<string> {
  const enc  = new TextEncoder()
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const key  = await webcrypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 210_000, salt },
    key, 256,
  )
  return `pbkdf2$sha256$210000$${Buffer.from(salt).toString('base64')}$${Buffer.from(bits).toString('base64')}`
}

async function upsertStaff(
  email: string, password: string, name: string,
  role: 'owner' | 'admin' | 'staff' | 'delivery' | 'viewer'
) {
  const [ex] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (ex) { console.log(`  ↩ ya existe: ${email}`); return }
  await db.insert(users).values({ email, passwordHash: await hashPassword(password), name, role, isActive: true })
  console.log(`  ✓ [${role}]  ${email}  /  ${password}`)
}

async function upsertCustomer(email: string, password: string, name: string): Promise<string> {
  const [ex] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1)
  if (ex) { console.log(`  ↩ ya existe: ${email}`); return ex.id }
  const id = crypto.randomUUID()
  await db.insert(customers).values({
    id, email, name,
    passwordHash: await hashPassword(password),
    emailVerified: true, emailVerifiedAt: new Date(),
    mustChangePassword: false, marketingOptIn: false,
  })
  console.log(`  ✓ [customer]  ${email}  /  ${password}`)
  return id
}

async function main() {
  console.log('\n🌱 Seed usuarios de prueba...\n')

  await upsertStaff('admin@seoulkims.cl',      'SeulKims2025!', 'Administrador',  'owner')
  await upsertStaff('cajero@seoulkims.cl',     'Cajero2025!',   'Carlos Cajero',  'staff')
  await upsertStaff('repartidor@seoulkims.cl', 'Delivery2025!', 'Diego Driver',   'delivery')

  await upsertCustomer('test@seoulkims.cl',      'Test1234!',      'Cliente Test B2C')
  const b2bCustomerId = await upsertCustomer('mayorista@seoulkims.cl', 'Mayorista2025!', 'Importadora K-Food SpA')

  const [exCo] = await db.select({ id: b2bCompanies.id }).from(b2bCompanies)
    .where(eq(b2bCompanies.rut, '76.123.456-7')).limit(1)
  if (!exCo) {
    await db.insert(b2bCompanies).values({
      customerId:     b2bCustomerId,
      razonSocial:    'Importadora K-Food SpA',
      rut:            '76.123.456-7',
      giro:           'Importación y distribución de alimentos',
      address:        'Av. Libertad 1234, Viña del Mar',
      tier:           'hoobae',
      status:         'approved',
      creditLimitClp: 500000,
    })
    console.log('  ✓ empresa B2B vinculada y aprobada')
  } else {
    console.log('  ↩ empresa B2B ya existe')
  }

  console.log('\n✅ Listo\n')
}

main().catch(e => { console.error(e); process.exit(1) })
