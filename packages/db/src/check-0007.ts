import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  const cols = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name IN ('orders', 'delivery_assignments', 'email_queue_log')
    AND column_name IN ('guest_name','guest_phone','guest_email','dispatch_type','third_party_name','third_party_tracking','third_party_saved_at','third_party_saved_by')
    ORDER BY table_name, column_name
  `
  console.log('Columnas presentes:')
  cols.forEach((c: Record<string, string>) => console.log(`  ${c.table_name}.${c.column_name}`))

  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_queue_log'`
  console.log('email_queue_log existe:', tables.length > 0)
}

main().catch(e => { console.error(e.message); process.exit(1) })
