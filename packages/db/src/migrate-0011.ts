// Migration 0011: SII Void fields on orders
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0011.ts

import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL requerida'); process.exit(1) }

  const sql = neon(url)

  const stmts = [
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_sii_folio TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_sii_status TEXT`,
  ]

  console.log(`🔄 Aplicando migration 0011 — SII Void fields (${stmts.length} statements)...`)
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
  console.log(`\n✅ Migration 0011 completa — ${ok} aplicados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
