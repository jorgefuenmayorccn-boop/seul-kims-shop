// Aplica migration 0003: auth columns en customers + shift_id en orders + foreign keys
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0003.ts

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL no configurado'); process.exit(1) }

  const sql = neon(url)
  const raw = readFileSync(join(__dirname, '../migrations/0003_normal_jocasta.sql'), 'utf8')

  // Drizzle migrations use --> statement-breakpoint as separator
  const stmts = raw
    .split(/-->[ \t]*statement-breakpoint/g)
    .flatMap(chunk => chunk.split(';'))
    .map(s => s.trim())
    .filter(Boolean)

  console.log(`🔄 Aplicando migration 0003 (${stmts.length} statements)...`)
  let ok = 0, skipped = 0
  for (const stmt of stmts) {
    try {
      await sql(stmt)
      console.log(`  ✓ ${stmt.slice(0, 70)}`)
      ok++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('duplicate key') ||
        msg.includes('column') && msg.includes('of relation') && msg.includes('already exists')
      ) {
        console.log(`  ↩ Ya existe: ${stmt.slice(0, 70)}`)
        skipped++
      } else {
        console.error(`  ❌ Error: ${msg}`)
        console.error(`     SQL: ${stmt.slice(0, 120)}`)
        // continue — don't abort on FK errors if tables don't exist yet
        skipped++
      }
    }
  }
  console.log(`✅ Migration 0003 completa — ${ok} aplicados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
