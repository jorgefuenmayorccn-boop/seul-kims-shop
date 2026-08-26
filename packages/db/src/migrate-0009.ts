// Migration 0009: Delivery Liquidation — assignment + payout fields
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/migrate-0009.ts

import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL requerida'); process.exit(1) }

  const sql = neon(url)

  const stmts = [
    // distancia y tarifa por km
    `ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS distancia_km NUMERIC(8,3)`,
    `ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS tarifa_km_clp INTEGER NOT NULL DEFAULT 1000`,
    `ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS monto_repartidor_clp INTEGER`,
    // campos de firma digital
    `ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS firma_r2_key TEXT`,
    `ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS firma_at TIMESTAMP`,
    `ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS firma_lat NUMERIC(9,6)`,
    `ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS firma_lng NUMERIC(9,6)`,

    // tabla de liquidaciones de repartidores
    `CREATE TABLE IF NOT EXISTS delivery_payouts (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id       UUID NOT NULL REFERENCES users(id),
      shift_id        UUID REFERENCES shifts(id),
      period_from     TIMESTAMP NOT NULL,
      period_to       TIMESTAMP NOT NULL,
      deliveries_count INTEGER NOT NULL DEFAULT 0,
      total_km        NUMERIC(10,3) NOT NULL DEFAULT 0,
      gross_clp       INTEGER NOT NULL DEFAULT 0,
      cash_collected  INTEGER NOT NULL DEFAULT 0,
      net_payable     INTEGER NOT NULL DEFAULT 0,
      paid_at         TIMESTAMP,
      paid_by         UUID REFERENCES users(id),
      pdf_r2_key      TEXT,
      notes           TEXT,
      created_at      TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS delivery_payouts_driver_idx ON delivery_payouts(driver_id)`,
    `CREATE INDEX IF NOT EXISTS delivery_payouts_shift_idx ON delivery_payouts(shift_id)`,

    // tabla de turnos de repartidores (para Z-report de conductores)
    `CREATE TABLE IF NOT EXISTS delivery_shifts (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id       UUID NOT NULL REFERENCES users(id),
      device_id       TEXT NOT NULL DEFAULT 'repartidor',
      status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
      opened_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      closed_at       TIMESTAMP,
      summary         JSONB,
      created_at      TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS delivery_shifts_driver_idx ON delivery_shifts(driver_id)`,
  ]

  console.log(`🔄 Aplicando migration 0009 — Delivery Liquidation (${stmts.length} statements)...`)
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
  console.log(`\n✅ Migration 0009 completa — ${ok} aplicados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
