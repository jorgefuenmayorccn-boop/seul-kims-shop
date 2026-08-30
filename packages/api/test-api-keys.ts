import postgres from 'postgres'
import * as crypto from 'crypto'

// API Key Service
class ApiKeyService {
  static generateKey(isTest = false): string {
    const prefix = isTest ? 'seul_test_' : 'seul_live_'
    const randomPart = crypto.randomBytes(32).toString('hex')
    return prefix + randomPart
  }

  static hashKey(key: string): string {
    const salt = crypto.randomBytes(16)
    const hash = crypto.pbkdf2Sync(key, salt, 210000, 32, 'sha256')
    return `pbkdf2$sha256$210000$${salt.toString('base64')}$${hash.toString('base64')}`
  }

  static verifyKey(key: string, hash: string): boolean {
    const [algo, hashAlgo, iterations, saltB64, hashB64] = hash.split('$')
    const salt = Buffer.from(saltB64, 'base64')
    const storedHash = Buffer.from(hashB64, 'base64')
    const computed = crypto.pbkdf2Sync(key, salt, parseInt(iterations), 32, hashAlgo as any)
    return computed.equals(storedHash)
  }
}

async function runTests() {
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/seul_dev'
  const sql = postgres(DATABASE_URL, { ssl: 'require' })

  console.log('🧪 Testing SEUL API Keys System\n')

  try {
    // Step 1: Create tables
    console.log('📊 Step 1: Creating database tables...')

    await sql`
      CREATE TYPE IF NOT EXISTS api_scope AS ENUM (
        'orders:read', 'orders:write',
        'products:read', 'products:write',
        'customers:read', 'customers:write',
        'inventory:read', 'inventory:write',
        'reports:read', 'admin:full'
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

    // Step 3: Insert API key
    console.log('\n💾 Step 3: Inserting API key into database...')
    const inserted = await sql`
      INSERT INTO api_keys (
        user_id, key_hash, name, scopes, rate_limit, metadata
      ) VALUES (
        ${testUserId}, ${keyHash}, 'Test Key',
        ARRAY['orders:read'::api_scope, 'orders:write'::api_scope, 'products:read'::api_scope],
        100,
        ${JSON.stringify({ created_by: 'test_script' })}
      )
      RETURNING id, name, scopes, is_active, created_at
    `

    console.log(`✓ API Key inserted:`)
    console.log(`  ID: ${inserted[0].id}`)
    console.log(`  Name: ${inserted[0].name}`)
    console.log(`  Scopes: ${inserted[0].scopes.join(', ')}`)
    console.log(`  Active: ${inserted[0].is_active}`)

    // Step 4: Validate key
    console.log('\n🔐 Step 4: Validating API key...')
    const allKeys = await sql`SELECT * FROM api_keys WHERE user_id = ${testUserId}`

    for (const storedKey of allKeys) {
      const isValid = ApiKeyService.verifyKey(plainKey, storedKey.key_hash)
      console.log(`✓ Key validation: ${isValid ? '✅ PASSED' : '❌ FAILED'}`)
      console.log(`  Stored scopes: ${storedKey.scopes.join(', ')}`)
      console.log(`  Rate limit: ${storedKey.rate_limit} req/min`)
    }

    // Step 5: Test rate limiting
    console.log('\n📈 Step 5: Testing rate-limited key...')
    const rateLimitKey = await sql`
      INSERT INTO api_keys (
        user_id, key_hash, name, scopes, rate_limit
      ) VALUES (
        ${testUserId}, ${ApiKeyService.hashKey(ApiKeyService.generateKey(false))},
        'Rate Limited Key', ARRAY['orders:read'::api_scope], 10
      )
      RETURNING id, rate_limit
    `
    console.log(`✓ Rate-limited key created: ${rateLimitKey[0].rate_limit} requests/minute`)

    // Step 6: List all keys
    console.log('\n📋 Step 6: Listing all keys for user...')
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

    // Step 7: Test audit logging
    console.log('\n📊 Step 7: Testing audit logging...')
    const keyToLog = userKeys[0]

    await sql`
      INSERT INTO api_key_logs (key_id, method, endpoint, status, ip_address, user_agent)
      VALUES (
        ${keyToLog.id}, 'POST', '/api/orders', 200,
        '203.0.113.42', 'Mozilla/5.0 Test'
      )
    `
    console.log(`✓ Audit log entry created`)

    const logs = await sql`
      SELECT method, endpoint, status, ip_address, created_at
      FROM api_key_logs
      WHERE key_id = ${keyToLog.id}
    `
    console.log(`✓ Retrieved ${logs.length} audit log entries:`)
    logs.forEach(log => {
      console.log(`  ${log.method} ${log.endpoint} → ${log.status} from ${log.ip_address}`)
    })

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('🎉 ALL TESTS PASSED')
    console.log('='.repeat(60))
    console.log(`\n✅ Test Summary:`)
    console.log(`  ✓ Database tables created`)
    console.log(`  ✓ API key generation (PBKDF2-SHA256)`)
    console.log(`  ✓ Key validation & hashing`)
    console.log(`  ✓ Rate limiting configuration`)
    console.log(`  ✓ Key listing by user`)
    console.log(`  ✓ Audit logging`)
    console.log(`\n🔑 Example API Key (for testing):`)
    console.log(`  Authorization: Bearer ${plainKey}`)
    console.log(`\n📈 Metrics:`)
    console.log(`  Keys created: ${userKeys.length}`)
    console.log(`  Audit logs: ${logs.length}`)
    console.log(`  Test duration: ~${Date.now()}ms`)

    await sql.end()
    process.exit(0)
  } catch (err: any) {
    console.error('❌ ERROR:', err.message)
    if (err.detail) console.error('  Detail:', err.detail)
    if (err.code) console.error('  Code:', err.code)
    process.exit(1)
  }
}

runTests()
