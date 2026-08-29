#!/usr/bin/env node
/**
 * SEED: Usuarios finales para entrega a cliente
 * DATABASE_URL=... npx tsx packages/db/src/seed-final-users.ts
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { users } from './schema/auth'
import { eq } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'

const sql = postgres(process.env.DATABASE_URL || '', { ssl: 'require' })
const db = drizzle(sql)

async function createUser(
  email: string,
  password: string,
  name: string,
  role: 'owner' | 'admin' | 'staff' | 'delivery' | 'viewer',
) {
  try {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (existing.length > 0) {
      console.log(`  ↩ Ya existe: ${email}`)
      return
    }

    const passwordHash = bcrypt.hashSync(password, 12)
    await db.insert(users).values({
      email,
      passwordHash,
      name,
      role,
      isActive: true,
    })
    console.log(`  ✅ [${role.toUpperCase()}] ${email}`)
  } catch (err) {
    console.error(`  ❌ Error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function main() {
  console.log('\n🌱 CREANDO USUARIOS FINALES PARA CLIENTE\n')
  console.log('================================================\n')

  // SUPER ADMINISTRADOR
  console.log('1️⃣  SUPER ADMINISTRADOR:')
  await createUser(
    'admin@seoulshop.cl',
    'Seoul2025!Admin',
    'Jorge Fuenmayor — Super Administrador',
    'owner',
  )

  // CAJERO (limitado a ingreso de productos)
  console.log('\n2️⃣  CAJERO (Ingreso de Productos):\n')
  await createUser(
    'cajero@seoulshop.cl',
    'Seoul2025!Cajero',
    'Cajero Seoul Kims — Ingreso de Productos',
    'staff',
  )

  console.log('\n================================================')
  console.log('\n✅ USUARIOS FINALES CREADOS\n')
  console.log('📋 CREDENCIALES PARA CLIENTE:\n')
  console.log('🔐 SUPER ADMINISTRADOR:')
  console.log('   Email: admin@seoulshop.cl')
  console.log('   Contraseña: Seoul2025!Admin')
  console.log('   Acceso: CMR (cerebro.seoulshop.cl)')
  console.log('   Permisos: Acceso total\n')

  console.log('📦 CAJERO (Ingreso de Productos):\n')
  console.log('   Email: cajero@seoulshop.cl')
  console.log('   Contraseña: Seoul2025!Cajero')
  console.log('   Acceso: CMR (cerebro.seoulshop.cl)')
  console.log('   Permisos: Solo ingreso de productos nuevos\n')

  console.log('================================================\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})
