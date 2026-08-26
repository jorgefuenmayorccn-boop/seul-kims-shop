// Aplica migration 0006: multi-tier pricing, delivery, loyalty, pos_void_events, customer 360
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0006.ts

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL requerida'); process.exit(1) }

  const sql = neon(url)

  // Leer la migración generada por drizzle-kit
  const raw = readFileSync(join(__dirname, '../migrations/0005_lyrical_nehzno.sql'), 'utf8')

  const stmts = raw
    .split(/-->[ \t]*statement-breakpoint/g)
    .flatMap(chunk => chunk.split(/;\s*\n/))
    .map(s => s.trim())
    .filter(s => s.length > 3)

  console.log(`🔄 Aplicando migration schema v2 (${stmts.length} statements)...`)
  let ok = 0; let skipped = 0

  for (const stmt of stmts) {
    try {
      await sql(stmt)
      console.log(`  ✓ ${stmt.slice(0, 72).replace(/\n/g, ' ')}`)
      ok++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const isExpected =
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('duplicate key value') ||
        msg.includes('relation') && msg.includes('already exists') ||
        msg.includes('type') && msg.includes('already exists')
      if (isExpected) {
        console.log(`  ↩ Ya existe: ${stmt.slice(0, 72).replace(/\n/g, ' ')}`)
        skipped++
      } else {
        console.error(`  ❌ ${msg.slice(0, 120)}`)
        console.error(`     SQL: ${stmt.slice(0, 100)}`)
        skipped++
      }
    }
  }
  console.log(`\n✅ Migration completa — ${ok} aplicados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
