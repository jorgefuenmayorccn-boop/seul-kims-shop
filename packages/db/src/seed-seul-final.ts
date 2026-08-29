#!/usr/bin/env node
// Seed usuarios finales: SUPER_ADMIN + CAJERO para entregar a cliente
// DATABASE_URL=... npx tsx packages/db/src/seed-seul-final.ts

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { users } from './schema/auth'
import { eq } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'

const sql = postgres(process.env.DATABASE_URL || '', { ssl: 'require' })
const db = drizzle(sql)

async function upsertUser(
  email: string,
  password: string,
  name: string,
  role: 'owner' | 'admin' | 'staff' | 'delivery' | 'viewer',
) {
  try {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    if (existing && existing.length > 0) {
      console.log(`  ↩ ya existe: ${email} (${role})`)
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
    console.log(`  ✅ [${role.toUpperCase()}] ${email} / ${password}`)
  } catch (err) {
    console.error(`  ❌ Error al crear ${email}:`, err)
  }
}

async function main() {
  console.log('\n🌱 Seed SEUL KING OS — Usuarios Finales\n')

  // SUPER_ADMIN
  await upsertUser(
    'admin@seoulshop.cl',
    'SeulKims2025!Admin',
    'Jorge Fuenmayor — Super Administrador',
    'owner'
  )

  // CAJERO — Solo puede subir productos nuevos
  await upsertUser(
    'cajero@seoulshop.cl',
    'SeulKims2025!Cajero',
    'Cajero Seoul Kims',
    'staff'
  )

  console.log('\n✅ Usuarios creados — Listo para entregar a cliente\n')
  console.log('📋 PERMISOS:')
  console.log('  owner (admin@seoulshop.cl) → Acceso total')
  console.log('  staff (cajero@seoulshop.cl) → Solo subir productos (CMR)')
  console.log()

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
