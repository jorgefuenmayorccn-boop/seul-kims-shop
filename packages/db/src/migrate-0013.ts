// Migration 0013: Fix — b2b_quotes.id no tenía DEFAULT gen_random_uuid()
// Bug real descubierto en SESSION 20: la tabla viva en Neon no coincidía con
// el schema Drizzle (.defaultRandom()). El INSERT de POST /api/b2b/quotes
// nunca especifica `id`, así que fallaba con "null value in column id" desde
// que la tabla existe — el canal de cotizaciones B2B nunca había funcionado.
//
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0013.ts

import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL requerida'); process.exit(1) }

  const sql = neon(url)

  const stmts = [
    `ALTER TABLE b2b_quotes ALTER COLUMN id SET DEFAULT gen_random_uuid()`,
  ]

  console.log(`🔄 Aplicando migration 0013 — fix b2b_quotes.id default (${stmts.length} statements)...`)
  let ok = 0; let skipped = 0

  for (const stmt of stmts) {
    try {
      await sql(stmt)
      console.log(`  ✓ ${stmt}`)
      ok++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  ❌ ${msg}`)
      skipped++
    }
  }
  console.log(`\n✅ Migration 0013 completa — ${ok} aplicados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
