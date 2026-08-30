import { PasswordService } from '../services/password.service'
import { sql } from '../db'

/**
 * Script para crear usuarios de prueba reales en la BD
 * Úsalo una sola vez: npx tsx src/scripts/seed-test-users.ts
 */

const TEST_USERS = [
  {
    email: 'founder@seoulshop.cl',
    password: 'Seoul2025!Founder',
    name: 'Fundador Seoul Kims',
    role: 'owner' as const,
  },
  {
    email: 'gerente@seoulshop.cl',
    password: 'Seoul2025!Gerente',
    name: 'Gerente Operacional',
    role: 'admin' as const,
  },
  {
    email: 'repartidor.test@seoulshop.cl',
    password: 'Seoul2025!Repartidor',
    name: 'Repartidor de Prueba',
    role: 'delivery' as const,
  },
]

async function seedUsers() {
  try {
    console.log('🌱 Sembrando usuarios de prueba...\n')

    for (const user of TEST_USERS) {
      // Hash password
      const passwordHash = PasswordService.hashPassword(user.password)

      // Check if user exists
      const existing = await sql`
        SELECT id FROM users WHERE email = ${user.email} LIMIT 1
      `

      if (existing.length > 0) {
        console.log(`⏭️  ${user.email} ya existe (saltando)`)
        continue
      }

      // Insert user
      const [inserted] = await sql`
        INSERT INTO users (email, password_hash, name, role, is_active)
        VALUES (${user.email}, ${passwordHash}, ${user.name}, ${user.role}, true)
        RETURNING id, email, name, role
      `

      console.log(`✅ ${inserted.email} creado`)
      console.log(`   ID: ${inserted.id}`)
      console.log(`   Rol: ${inserted.role}`)
      console.log(`   Contraseña: ${user.password}\n`)
    }

    console.log('✅ Seeding completado\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📝 Usuarios disponibles para testing:')
    TEST_USERS.forEach(u => {
      console.log(`\n  Email: ${u.email}`)
      console.log(`  Contraseña: ${u.password}`)
      console.log(`  Rol: ${u.role}`)
    })
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

seedUsers()
