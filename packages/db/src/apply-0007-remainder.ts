// Aplica los statements que fallaron en migrate-0007 por el parser DO $$ blocks
import { neon } from '@neondatabase/serverless'

async function run(sql: ReturnType<typeof neon>, stmt: string, label: string) {
  try {
    await sql(stmt)
    console.log(`  ✓ ${label}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`  ↩ Ya existe: ${label}`)
    } else {
      console.error(`  ❌ ${label}: ${msg.slice(0, 100)}`)
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('❌ DATABASE_URL requerida'); process.exit(1) }
  const sql = neon(url)

  console.log('🔄 Aplicando remainder de migration 0007...')

  await run(sql,
    `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guest_name" text`,
    'orders.guest_name'
  )

  await run(sql,
    `ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "dispatch_type" text NOT NULL DEFAULT 'internal'`,
    'delivery_assignments.dispatch_type'
  )

  await run(sql, `
    CREATE TABLE IF NOT EXISTS "email_queue_log" (
      "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "order_id"        uuid NOT NULL,
      "trigger_type"    text NOT NULL,
      "status"          text NOT NULL DEFAULT 'queued',
      "attempt"         integer NOT NULL DEFAULT 1,
      "recipient_email" text,
      "resend_id"       text,
      "error_detail"    text,
      "queued_at"       timestamp DEFAULT now() NOT NULL,
      "processed_at"    timestamp
    )`,
    'CREATE TABLE email_queue_log'
  )

  await run(sql,
    `ALTER TABLE "email_queue_log" ADD CONSTRAINT "email_queue_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    'FK email_queue_log → orders'
  )

  await run(sql,
    `ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_third_party_saved_by_users_id_fk" FOREIGN KEY ("third_party_saved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    'FK delivery_assignments.third_party_saved_by → users'
  )

  await run(sql,
    `CREATE INDEX IF NOT EXISTS "email_queue_log_order_idx" ON "email_queue_log" ("order_id", "queued_at")`,
    'INDEX email_queue_log_order_idx'
  )

  await run(sql,
    `CREATE INDEX IF NOT EXISTS "delivery_assignments_dispatch_type_idx" ON "delivery_assignments" ("dispatch_type")`,
    'INDEX delivery_assignments_dispatch_type_idx'
  )

  console.log('\n✅ Remainder completo')
}

main().catch(e => { console.error(e); process.exit(1) })
