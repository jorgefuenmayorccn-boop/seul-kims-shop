// Aplica migration 0005: cashier_id, void columns, analytics indexes
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0005.ts

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL no configurado'); process.exit(1) }

  const sql = neon(url)
  const migration = readFileSync(join(__dirname, '../migrations/0005_orders_void_indexes.sql'), 'utf8')

  console.log('🔄 Aplicando migration 0005...')
  for (const stmt of migration.split(';').map(s => s.trim()).filter(Boolean)) {
    try {
      await sql(stmt)
      console.log(`  ✓ ${stmt.slice(0, 60)}...`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('already exists')) {
        console.log(`  ↩ Ya existe: ${stmt.slice(0, 60)}`)
      } else {
        throw e
      }
    }
  }
  console.log('✅ Migration 0005 completa')
}

main().catch(e => { console.error(e); process.exit(1) })
