import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const indexes = await sql`
    SELECT indexname FROM pg_indexes
    WHERE indexname IN ('email_queue_log_order_idx', 'delivery_assignments_dispatch_type_idx')
  `
  console.log('Índices encontrados:', indexes.map((r: Record<string,string>) => r.indexname))
  const def = await sql`
    SELECT column_default FROM information_schema.columns
    WHERE table_name = 'delivery_assignments' AND column_name = 'dispatch_type'
  `
  console.log('dispatch_type default:', def[0])
}

main().catch(e => { console.error(e.message); process.exit(1) })
