// Migration 0008: IAM Corporate Metadata — users table extended
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0008.ts

import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL requerida'); process.exit(1) }

  const sql = neon(url)

  const stmts = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS cargo TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS departamento TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono_personal TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB`,
  ]

  console.log(`🔄 Aplicando migration 0008 — IAM Corporate Metadata (${stmts.length} statements)...`)
  let ok = 0; let skipped = 0

  for (const stmt of stmts) {
    try {
      await sql(stmt)
      console.log(`  ✓ ${stmt.slice(0, 80)}`)
      ok++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('already exists') || msg.includes('duplicate column')) {
        console.log(`  ↩ Ya existe: ${stmt.slice(0, 80)}`)
        skipped++
      } else {
        console.error(`  ❌ ${msg}`)
        skipped++
      }
    }
  }
  console.log(`\n✅ Migration 0008 completa — ${ok} aplicados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
