// Migration 0012: Nuevos valores de email_type para corregir type hardcodeado en enqueueEmail()
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0012.ts

import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL requerida'); process.exit(1) }

  const sql = neon(url)

  const values = [
    'quote-sent',
    'quote-accepted',
    'quote-rejected',
    'delivery-assigned',
    'delivery-failed',
    'large-order-alert',
    'user-created',
  ]

  console.log(`🔄 Aplicando migration 0012 — ${values.length} nuevos valores email_type...`)
  let ok = 0; let skipped = 0

  for (const v of values) {
    try {
      await sql(`ALTER TYPE email_type ADD VALUE IF NOT EXISTS '${v}'`)
      console.log(`  ✓ ${v}`)
      ok++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  ❌ ${v}: ${msg}`)
      skipped++
    }
  }
  console.log(`\n✅ Migration 0012 completa — ${ok} aplicados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
