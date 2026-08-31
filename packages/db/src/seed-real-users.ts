/**
 * Script para crear usuarios reales + ejecutar migración 0014
 * Ejecutar: pnpm --filter @seul/api tsx ../db/src/seed-real-users.ts
 */

import { sql } from '../../api/src/db'
import { PasswordService } from '../../api/src/services/password.service'

function generateTemporaryPassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  const excludeAmbiguous = chars.replace(/[0O1l|]/g, '')
  let password = ''
  for (let i = 0; i < length; i++) {
    password += excludeAmbiguous.charAt(Math.floor(Math.random() * excludeAmbiguous.length))
  }
  return password
}

const REAL_USERS = [
  { email: 'ceojorge@gmail.com', name: 'Jorge Fuenmayor', role: 'owner', description: 'SuperAdministrador' },
  { email: 'marioulloa22@verticeproductions.com', name: 'Mario Ulloa', role: 'staff', description: 'Cajero' },
  { email: 'jorgefuenmayor.ccn@gmail.com', name: 'Jorge (Delivery)', role: 'delivery', description: 'Repartidor' },
]

async function migrate() {
  console.log('\n🔄 Ejecutando migración 0014: Primer-login obligatorio...\n')

  try {
    // 1. Agregar columnas
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true
    `
    console.log('✓ Agregado: users.must_change_password')

    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP
    `
    console.log('✓ Agregado: users.password_changed_at')

    // 2. Crear tabla de reset tokens
    await sql`
      CREATE TABLE IF NOT EXISTS staff_password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✓ Creada tabla: staff_password_reset_tokens')

    // 3. Índices
    await sql`
      CREATE INDEX IF NOT EXISTS staff_pwd_reset_user_idx
      ON staff_password_reset_tokens(user_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS staff_pwd_reset_token_idx
      ON staff_password_reset_tokens(token)
    `
    console.log('✓ Índices creados\n')
  } catch (e) {
    console.error('❌ Error en migración:', e)
  }
}

async function seedUsers() {
  console.log('📧 Limpiando BD y creando usuarios REALES con contraseñas temporales...\n')

  const createdUsers: Array<{ email: string; password: string; role: string; name: string }> = []

  try {
    // Limpiar usuarios de prueba
    await sql`DELETE FROM users WHERE email IN ('founder@seoulshop.cl', 'gerente@seoulshop.cl', 'repartidor.test@seoulshop.cl')`
    console.log('✓ Usuarios de prueba eliminados\n')

    // Crear usuarios reales
    for (const user of REAL_USERS) {
      const tempPassword = generateTemporaryPassword()
      const passwordHash = PasswordService.hashPassword(tempPassword)

      await sql`
        INSERT INTO users (email, password_hash, name, role, is_active, must_change_password)
        VALUES (${user.email}, ${passwordHash}, ${user.name}, ${user.role}, true, true)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = ${passwordHash},
          name = ${user.name},
          role = ${user.role},
          must_change_password = true
      `

      createdUsers.push({
        email: user.email,
        password: tempPassword,
        role: user.role,
        name: user.name,
      })

      console.log(`✓ ${user.email} (${user.description})`)
    }

    console.log('\n📋 CREDENCIALES DE ACCESO:')
    console.log('====================================')
    createdUsers.forEach((u) => {
      console.log(`\n📧 ${u.email}`)
      console.log(`   Contraseña temporal: ${u.password}`)
      console.log(`   Rol: ${u.role}`)
      console.log(`   ⚠️  Debe cambiar contraseña en primer login`)
    })
    console.log('\n====================================')
    console.log('✅ Seeds completado. Los usuarios recibirán emails.\n')
  } catch (e) {
    console.error('❌ Error en seed:', e)
    throw e
  }
}

async function main() {
  try {
    await migrate()
    await seedUsers()
    console.log('✅ TODO LISTO PARA QA\n')
    process.exit(0)
  } catch (e) {
    console.error('❌ Error crítico:', e)
    process.exit(1)
  }
}

main()
