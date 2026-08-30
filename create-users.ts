#!/usr/bin/env node
/**
 * Crear 4 usuarios: Dueño, Administrador, Cajera, Delivery
 * DATABASE_URL=... npx tsx create-users.ts
 */

import postgres from 'postgres'
import * as bcrypt from 'bcryptjs'

const sql = postgres(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_PltRoX3VBLg0@ep-autumn-poetry-axvcuspa-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require', { ssl: 'require' })

async function createUser(
  email: string,
  password: string,
  name: string,
  role: 'owner' | 'admin' | 'staff' | 'delivery' | 'viewer',
) {
  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing.length > 0) {
      console.log(`  ↩ Ya existe: ${email}`)
      return { email, password, name, role, status: 'exists' }
    }

    const passwordHash = bcrypt.hashSync(password, 12)
    await sql`
      INSERT INTO users (email, "passwordHash", name, role, "isActive")
      VALUES (${email}, ${passwordHash}, ${name}, ${role}, true)
    `
    console.log(`  ✅ [${role.toUpperCase()}] ${email}`)
    return { email, password, name, role, status: 'created' }
  } catch (err) {
    console.error(`  ❌ Error: ${err instanceof Error ? err.message : String(err)}`)
    return { email, password, name, role, status: 'error' }
  }
}

async function main() {
  console.log('\n🌱 CREANDO 4 USUARIOS SEUL KING OS\n')
  console.log('════════════════════════════════════════\n')

  const users = []

  // 1️⃣ DUEÑO
  console.log('1️⃣ DUEÑO (Acceso Completo):\n')
  const owner = await createUser(
    'dueno@seoulshop.cl',
    'Seoul2025!Dueno',
    'Dueño Seoul Kims',
    'owner',
  )
  users.push(owner)

  // 2️⃣ ADMINISTRADOR
  console.log('\n2️⃣ ADMINISTRADOR (Gestión):\n')
  const admin = await createUser(
    'admin@seoulshop.cl',
    'Seoul2025!Admin',
    'Administrador Seoul Kims',
    'admin',
  )
  users.push(admin)

  // 3️⃣ CAJERA
  console.log('\n3️⃣ CAJERA (Caja Local):\n')
  const cashier = await createUser(
    'cajera@seoulshop.cl',
    'Seoul2025!Cajera',
    'Cajera Seoul Kims',
    'staff',
  )
  users.push(cashier)

  // 4️⃣ DELIVERY
  console.log('\n4️⃣ REPARTIDOR (Entregas):\n')
  const delivery = await createUser(
    'delivery@seoulshop.cl',
    'Seoul2025!Delivery',
    'Repartidor Seoul Kims',
    'delivery',
  )
  users.push(delivery)

  console.log('\n════════════════════════════════════════')
  console.log('\n✅ USUARIOS CREADOS\n')
  console.log('📋 CREDENCIALES DE ACCESO:\n')

  console.log('🔐 1. DUEÑO (Acceso Completo)')
  console.log('   Email: dueno@seoulshop.cl')
  console.log('   Contraseña: Seoul2025!Dueno')
  console.log('   Acceso: CMR (Todas las funciones)\n')

  console.log('👨‍💼 2. ADMINISTRADOR (Gestión)')
  console.log('   Email: admin@seoulshop.cl')
  console.log('   Contraseña: Seoul2025!Admin')
  console.log('   Acceso: CMR (Productos, Órdenes, Reportes)\n')

  console.log('💳 3. CAJERA (Caja Local)')
  console.log('   Email: cajera@seoulshop.cl')
  console.log('   Contraseña: Seoul2025!Cajera')
  console.log('   Acceso: POS (Punto de Venta)\n')

  console.log('🚚 4. REPARTIDOR (Entregas)')
  console.log('   Email: delivery@seoulshop.cl')
  console.log('   Contraseña: Seoul2025!Delivery')
  console.log('   Acceso: Repartidor (Driver App)\n')

  console.log('════════════════════════════════════════\n')

  await sql.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})
