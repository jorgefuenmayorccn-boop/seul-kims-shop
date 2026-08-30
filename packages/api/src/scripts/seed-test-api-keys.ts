import { ApiKeyService } from '../services/api-key.service'
import { sql } from '../db'

/**
 * Script para crear claves API de prueba
 * Úsalo: npx tsx src/scripts/seed-test-api-keys.ts
 */

const TEST_API_KEYS = [
  {
    email: 'founder@seoulshop.cl',
    name: 'Founder Development Key',
    scopes: ['orders:read', 'orders:write', 'products:read', 'products:write', 'admin:full'],
    rateLimit: null,
  },
  {
    email: 'gerente@seoulshop.cl',
    name: 'Manager Integration Key',
    scopes: ['orders:read', 'orders:write', 'products:read', 'customers:read'],
    rateLimit: 100, // 100 req/min
  },
]

async function seedApiKeys() {
  try {
    console.log('🔑 Creando claves API de prueba...\n')

    for (const keyConfig of TEST_API_KEYS) {
      // Get user ID
      const [user] = await sql`SELECT id FROM users WHERE email = ${keyConfig.email} LIMIT 1`

      if (!user) {
        console.log(`⚠️  Usuario ${keyConfig.email} no encontrado (crea usuarios primero)`)
        continue
      }

      // Generate key
      const plainKey = ApiKeyService.generateKey(true) // test key
      const keyHash = ApiKeyService.hashKey(plainKey)

      // Insert
      const [inserted] = await sql`
        INSERT INTO api_keys (user_id, key_hash, name, scopes, rate_limit, is_active, metadata, created_at)
        VALUES (
          ${user.id},
          ${keyHash},
          ${keyConfig.name},
          ${keyConfig.scopes},
          ${keyConfig.rateLimit},
          true,
          jsonb_build_object('env', 'testing', 'created_via', 'seed-script'),
          NOW()
        )
        RETURNING id, name
      `

      console.log(`✅ ${inserted.name}`)
      console.log(`   Clave: ${plainKey}`)
      console.log(`   Scopes: ${keyConfig.scopes.join(', ')}\n`)
    }

    console.log('✅ Claves API creadas\n')

  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

seedApiKeys()
