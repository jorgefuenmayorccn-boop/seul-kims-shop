// Seed PRODUCCIÓN — Usuarios únicos para SEUL KING OS (seoulshop.cl)
// DATABASE_URL=... npx tsx packages/db/src/seed-production.ts

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { users } from './schema/auth'
import { eq } from 'drizzle-orm'
import { webcrypto } from 'node:crypto'

const db = drizzle(neon(process.env.DATABASE_URL!))

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const key = await webcrypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 210_000, salt },
    key,
    256,
  )
  return `pbkdf2$sha256$210000$${Buffer.from(salt).toString('base64')}$${Buffer.from(bits).toString('base64')}`
}

async function createProductionUser(
  email: string,
  password: string,
  name: string,
  role: 'owner' | 'admin',
) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)

  if (existing) {
    console.log(`  ⚠️  Ya existe: ${email}`)
    return { email, name, role, status: 'EXISTING' }
  }

  const passwordHash = await hashPassword(password)
  await db.insert(users).values({
    email,
    passwordHash,
    name,
    role,
    isActive: true,
    cargo: role === 'owner' ? 'Fundador / Dueño' : 'Gerente Operacional',
    departamento: role === 'owner' ? 'Dirección' : 'Administración',
    metadata: {
      created_by: 'seed-production',
      created_at: new Date().toISOString(),
      environment: 'production',
      project: 'seul-kims-os',
    },
  })

  console.log(`  ✅ [${role}] ${email}`)
  return { email, password, name, role, status: 'CREATED' }
}

async function main() {
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║  SEUL KING OS v1.0 — SEED PRODUCCIÓN                              ║')
  console.log('║  Dominio: seoulshop.cl                                             ║')
  console.log('║  Proyecto: Seoul Kims Viña del Mar                                ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')
  console.log('\n')

  console.log('📝 Creando usuarios de producción...\n')

  const createdUsers = []

  // Usuario 1: ROOT ADMIN (Dueño)
  const ownerResult = await createProductionUser(
    'founder@seoulshop.cl',
    'SeoulKims2026!',
    'Fundador & Dueño Seoul Kims',
    'owner',
  )
  if (ownerResult.status === 'CREATED') {
    createdUsers.push(ownerResult)
  }

  // Usuario 2: STAFF ADMIN (Administradora Local)
  const staffResult = await createProductionUser(
    'gerente@seoulshop.cl',
    'Gerente2026!',
    'Gerente Operacional',
    'admin',
  )
  if (staffResult.status === 'CREATED') {
    createdUsers.push(staffResult)
  }

  console.log('\n')

  if (createdUsers.length === 0) {
    console.log('⚠️  No hay usuarios nuevos — todos ya existen.\n')
  } else {
    console.log('╔════════════════════════════════════════════════════════════════════╗')
    console.log('║  ✅ CREDENCIALES DE ACCESO — GUARDAR EN LUGAR SEGURO             ║')
    console.log('╚════════════════════════════════════════════════════════════════════╝')
    console.log('')

    createdUsers.forEach((user) => {
      console.log(`📌 ${user.role.toUpperCase()} — ${user.name}`)
      console.log(`   Email:      ${user.email}`)
      console.log(`   Contraseña: ${user.password}`)
      console.log(`   URL:        https://cmr.seoulshop.cl/login`)
      console.log('')
    })

    console.log('⚠️  IMPORTANTE:')
    console.log('   • Estas contraseñas se mostran SOLO una vez')
    console.log('   • Cambiar contraseña en el primer login')
    console.log('   • No compartir las credenciales por email')
    console.log('   • Guardar en gestor de contraseñas seguro')
    console.log('')
  }

  console.log('✅ Seed completado\n')
}

main().catch((e) => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
