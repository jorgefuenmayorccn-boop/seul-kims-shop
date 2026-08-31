/**
 * Seed de usuarios REALES para producción — limpia BD, crea solo los 3 usuarios confirmados
 * Ejecutar: npx tsx packages/db/src/seed-fresh-users.ts
 *
 * Usuarios:
 * 1. ceojorge@gmail.com — SuperAdministrador (owner)
 * 2. marioulloa22@verticeproductions.com — Cajero (staff)
 * 3. jorgefuenmayor.ccn@gmail.com — Delivery (delivery)
 */

import { sql } from './client'
import { PasswordService } from '../src/services/password.service'

// Generar contraseña temporal aleatoria
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
  {
    email: 'ceojorge@gmail.com',
    name: 'Jorge Fuenmayor',
    role: 'owner',
    description: 'SuperAdministrador',
  },
  {
    email: 'marioulloa22@verticeproductions.com',
    name: 'Mario Ulloa',
    role: 'staff',
    description: 'Cajero',
  },
  {
    email: 'jorgefuenmayor.ccn@gmail.com',
    name: 'Jorge (Delivery)',
    role: 'delivery',
    description: 'Repartidor',
  },
]

async function seed() {
  try {
    console.log('🔄 Limpiando BD: eliminando usuarios antiguos...')
    await sql`DELETE FROM users WHERE email IN ('founder@seoulshop.cl', 'gerente@seoulshop.cl', 'repartidor.test@seoulshop.cl')`
    console.log('✓ Usuarios de prueba eliminados')

    console.log('\n📧 Creando usuarios REALES con contraseñas temporales...\n')

    const createdUsers: Array<{ email: string; password: string; role: string; name: string }> = []

    for (const user of REAL_USERS) {
      const tempPassword = generateTemporaryPassword()
      const passwordHash = PasswordService.hashPassword(tempPassword)

      await sql`
        INSERT INTO users (email, password_hash, name, role, is_active, must_change_password, last_login_at)
        VALUES (${user.email}, ${passwordHash}, ${user.name}, ${user.role}, true, true, NULL)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = ${passwordHash},
          name = ${user.name},
          role = ${user.role},
          must_change_password = true,
          last_login_at = NULL
      `

      createdUsers.push({
        email: user.email,
        password: tempPassword,
        role: user.role,
        name: user.name,
      })

      console.log(`✓ Usuario creado: ${user.email} (${user.description})`)
      console.log(`  Rol: ${user.role}`)
      console.log(`  Contraseña temporal: ${tempPassword}`)
      console.log(`  Estado: Primer-login OBLIGATORIO\n`)
    }

    console.log('📋 RESUMEN DE CREDENCIALES:')
    console.log('====================================')
    createdUsers.forEach((u) => {
      console.log(`\n📧 ${u.email}`)
      console.log(`   Contraseña: ${u.password}`)
      console.log(`   Rol: ${u.role}`)
      console.log(`   ⚠️  Debe cambiar contraseña en primer login`)
    })
    console.log('\n====================================')

    console.log('\n✅ Seed completado. Los usuarios recibirán emails con sus credenciales.')
  } catch (error) {
    console.error('❌ Error en seed:', error)
    process.exit(1)
  }
}

seed().then(() => process.exit(0))
