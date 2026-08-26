// Migration 0010: B2B Credit Wallet
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0010.ts

import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL requerida'); process.exit(1) }

  const sql = neon(url)

  const stmts = [
    // wallet balance en b2b_companies
    `ALTER TABLE b2b_companies ADD COLUMN IF NOT EXISTS wallet_balance_clp INTEGER NOT NULL DEFAULT 0`,

    // solicitudes de crédito
    `CREATE TABLE IF NOT EXISTS b2b_credit_requests (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id    UUID NOT NULL REFERENCES b2b_companies(id),
      amount_clp    INTEGER NOT NULL,
      reason        TEXT,
      status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      reviewed_by   UUID REFERENCES users(id),
      reviewed_at   TIMESTAMP,
      reviewer_note TEXT,
      doc_r2_key    TEXT,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS b2b_credit_req_company_idx ON b2b_credit_requests(company_id)`,
    `CREATE INDEX IF NOT EXISTS b2b_credit_req_status_idx ON b2b_credit_requests(status)`,

    // ledger de movimientos de wallet
    `CREATE TABLE IF NOT EXISTS b2b_wallet_ledger (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id    UUID NOT NULL REFERENCES b2b_companies(id),
      type          TEXT NOT NULL CHECK (type IN ('credit','debit','adjustment')),
      amount_clp    INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_id  UUID,
      reference_type TEXT,
      notes         TEXT,
      created_by    UUID REFERENCES users(id),
      created_at    TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS b2b_wallet_ledger_company_idx ON b2b_wallet_ledger(company_id)`,
    `CREATE INDEX IF NOT EXISTS b2b_wallet_ledger_created_idx ON b2b_wallet_ledger(created_at DESC)`,
  ]

  console.log(`🔄 Aplicando migration 0010 — B2B Credit Wallet (${stmts.length} statements)...`)
  let ok = 0; let skipped = 0

  for (const stmt of stmts) {
    try {
      await sql(stmt)
      console.log(`  ✓ ${stmt.slice(0, 80).replace(/\n/g, ' ')}`)
      ok++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const isExpected = msg.includes('already exists') || msg.includes('duplicate column')
      if (isExpected) {
        console.log(`  ↩ Ya existe: ${stmt.slice(0, 80).replace(/\n/g, ' ')}`)
        skipped++
      } else {
        console.error(`  ❌ ${msg}`)
        skipped++
      }
    }
  }
  console.log(`\n✅ Migration 0010 completa — ${ok} aplicados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
