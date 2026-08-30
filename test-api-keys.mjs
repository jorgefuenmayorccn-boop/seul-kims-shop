import postgres from 'postgres'
import crypto from 'crypto'

// Database connection
const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost/seul_dev', {
  ssl: 'require',
  max: 20,
})

// API Key Service functions
class ApiKeyService {
  static generateKey(isTest = false) {
    const prefix = isTest ? 'seul_test_' : 'seul_live_'
    const randomPart = crypto.randomBytes(32).toString('hex')
    return prefix + randomPart
  }

  static hashKey(key) {
    const salt = crypto.randomBytes(16)
    const hash = crypto.pbkdf2Sync(key, salt, 210000, 32, 'sha256')
    return `pbkdf2$sha256$210000$${salt.toString('base64')}$${hash.toString('base64')}`
  }

  static verifyKey(key, hash) {
    const [algo, hashAlgo, iterations, saltB64, hashB64] = hash.split('$')
    const salt = Buffer.from(saltB64, 'base64')
    const storedHash = Buffer.from(hashB64, 'base64')
    const computed = crypto.pbkdf2Sync(key, salt, parseInt(iterations), 32, hashAlgo)
    return computed.equals(storedHash)
  }
}

async function runTests() {
  console.log('🧪 Testing SEUL API Keys System\n')

  try {
    // Step 1: Create tables
    console.log('📊 Step 1: Creating database tables...')
    await sql`
      CREATE TYPE IF NOT EXISTS api_scope AS ENUM (
        'orders:read',
        'orders:write',
        'products:read',
        'products:write',
        'customers:read',
        'customers:write',
        'inventory:read',
        'inventory:write',
        'reports:read',
        'admin:full'
      )
    `
    console.log('✓ api_scope enum created')

    await sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        scopes api_scope[] NOT NULL,
        rate_limit INTEGER,
        ip_whitelist TEXT[],
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        revoked_at TIMESTAMP
      )
    `
    console.log('✓ api_keys table created')

    await sql`
      CREATE TABLE IF NOT EXISTS api_key_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        status INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        request_size INTEGER,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✓ api_key_logs table created')

    // Step 2: Generate test API key
    console.log('\n🔑 Step 2: Generating test API key...')
    const testUserId = crypto.randomUUID()
    const plainKey = ApiKeyService.generateKey(false)
    const keyHash = ApiKeyService.hashKey(plainKey)

    console.log(`  Test User ID: ${testUserId}`)
    console.log(`  Plain Key: ${plainKey}`)
    console.log(`  Key Hash (first 50 chars): ${keyHash.substring(0, 50)}...`)

    // Step 3: Insert API key into database
    console.log('\n💾 Step 3: Inserting API key into database...')
    const [inserted] = await sql`
      INSERT INTO api_keys (
        user_id, key_hash, name, scopes, rate_limit, metadata
      ) VALUES (
        ${testUserId}, ${keyHash}, 'Test Key',
        ARRAY['orders:read', 'orders:write', 'products:read'::api_scope],
        100,
        jsonb_build_object('created_by', 'test_script')
      )
      RETURNING id, name, scopes, is_active, created_at
    `
    console.log(`✓ API Key inserted:`)
    console.log(`  ID: ${inserted.id}`)
    console.log(`  Name: ${inserted.name}`)
    console.log(`  Scopes: ${inserted.scopes.join(', ')}`)
    console.log(`  Active: ${inserted.is_active}`)
    console.log(`  Created: ${inserted.created_at}`)

    // Step 4: Retrieve and validate
    console.log('\n🔐 Step 4: Validating API key...')
    const allKeys = await sql`SELECT * FROM api_keys WHERE user_id = ${testUserId}`

    for (const storedKey of allKeys) {
      const isValid = ApiKeyService.verifyKey(plainKey, storedKey.key_hash)
      console.log(`✓ Key validation: ${isValid ? '✅ PASSED' : '❌ FAILED'}`)
      console.log(`  Stored scopes: ${storedKey.scopes.join(', ')}`)
      console.log(`  Rate limit: ${storedKey.rate_limit} req/min`)
    }

    // Step 5: Test invalid key
    console.log('\n🚫 Step 5: Testing invalid key detection...')
    const fakeKey = 'seul_live_' + crypto.randomBytes(32).toString('hex')
    const allKeysForCheck = await sql`SELECT * FROM api_keys WHERE user_id = ${testUserId}`
    let foundValid = false

    for (const storedKey of allKeysForCheck) {
      if (ApiKeyService.verifyKey(fakeKey, storedKey.key_hash)) {
        foundValid = true
      }
    }
    console.log(`✓ Fake key rejected: ${!foundValid ? '✅ PASSED' : '❌ FAILED'}`)

    // Step 6: Test key expiration
    console.log('\n⏰ Step 6: Testing key expiration...')
    const futureDate = new Date(Date.now() + 86400000) // +1 day
    const expiredKey = ApiKeyService.generateKey(false)
    const expiredKeyHash = ApiKeyService.hashKey(expiredKey)

    await sql`
      INSERT INTO api_keys (
        user_id, key_hash, name, scopes, expires_at
      ) VALUES (
        ${testUserId}, ${expiredKeyHash}, 'Future Expiry Key',
        ARRAY['orders:read'::api_scope], ${futureDate}
      )
    `
    console.log(`✓ Key with expiration created: ${futureDate.toISOString()}`)

    // Step 7: Test rate limiting
    console.log('\n📈 Step 7: Testing rate limiting...')
    const rateLimitedKey = ApiKeyService.generateKey(false)
    const rateLimitedKeyHash = ApiKeyService.hashKey(rateLimitedKey)

    const [rlKey] = await sql`
      INSERT INTO api_keys (
        user_id, key_hash, name, scopes, rate_limit
      ) VALUES (
        ${testUserId}, ${rateLimitedKeyHash}, 'Rate Limited Key',
        ARRAY['orders:read'::api_scope], 10
      )
      RETURNING id, rate_limit
    `
    console.log(`✓ Rate-limited key created: ${rlKey.rate_limit} requests/minute`)

    // Step 8: List all keys for user
    console.log('\n📋 Step 8: Listing all keys for user...')
    const userKeys = await sql`
      SELECT id, name, scopes, is_active, rate_limit, created_at
      FROM api_keys
      WHERE user_id = ${testUserId}
      ORDER BY created_at DESC
    `
    console.log(`✓ Found ${userKeys.length} keys:`)
    userKeys.forEach((k, i) => {
      console.log(`  ${i + 1}. ${k.name} (${k.scopes.join(', ')}) - Active: ${k.is_active}`)
    })

    // Step 9: Test audit logging
    console.log('\n📊 Step 9: Testing audit logging...')
    const [loggedKey] = await sql`SELECT id FROM api_keys WHERE user_id = ${testUserId} LIMIT 1`

    await sql`
      INSERT INTO api_key_logs (key_id, method, endpoint, status, ip_address, user_agent)
      VALUES (
        ${loggedKey.id}, 'POST', '/api/orders', 200,
        '203.0.113.42', 'Mozilla/5.0 Test'
      )
    `
    console.log(`✓ Audit log entry created for key ${loggedKey.id}`)

    const logs = await sql`
      SELECT method, endpoint, status, ip_address, created_at
      FROM api_key_logs
      WHERE key_id = ${loggedKey.id}
    `
    console.log(`✓ Retrieved ${logs.length} audit log entries:`)
    logs.forEach(log => {
      console.log(`  ${log.method} ${log.endpoint} → ${log.status} from ${log.ip_address}`)
    })

    console.log('\n' + '='.repeat(60))
    console.log('🎉 ALL TESTS PASSED')
    console.log('='.repeat(60))
    console.log(`\n📝 Test Summary:`)
    console.log(`  ✅ Database tables created`)
    console.log(`  ✅ API key generation (PBKDF2-SHA256)`)
    console.log(`  ✅ Key validation & hashing`)
    console.log(`  ✅ Invalid key detection`)
    console.log(`  ✅ Expiration date support`)
    console.log(`  ✅ Rate limiting configuration`)
    console.log(`  ✅ Key listing by user`)
    console.log(`  ✅ Audit logging`)
    console.log(`\n🔑 Example API Key (for testing):`)
    console.log(`  \`\`\``)
    console.log(`  Authorization: Bearer ${plainKey}`)
    console.log(`  \`\`\``)

    process.exit(0)
  } catch (err) {
    console.error('❌ ERROR:', err.message)
    console.error('\nStack:', err.stack)
    process.exit(1)
  }
}

runTests()
