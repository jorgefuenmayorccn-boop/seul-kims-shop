// Verifica que la migración 0007 aplicó correctamente y el schema Drizzle funciona
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { eq, sql } from 'drizzle-orm'

async function main() {
  const url = process.env.DATABASE_URL!
  const db  = drizzle(neon(url), { schema })
  let ok = 0; let fail = 0

  async function check(label: string, fn: () => Promise<void>) {
    try { await fn(); console.log(`  ✓ ${label}`); ok++ }
    catch (e) { console.error(`  ❌ ${label}: ${e instanceof Error ? e.message : e}`); fail++ }
  }

  console.log('🔍 Verificando migración 0007...\n')

  // 1. Columnas guest_* en orders
  await check('orders.guest_name existe', async () => {
    await db.select({ guestName: schema.orders.guestName }).from(schema.orders).limit(1)
  })
  await check('orders.guest_phone existe', async () => {
    await db.select({ guestPhone: schema.orders.guestPhone }).from(schema.orders).limit(1)
  })
  await check('orders.guest_email existe', async () => {
    await db.select({ guestEmail: schema.orders.guestEmail }).from(schema.orders).limit(1)
  })

  // 2. Columnas dispatch en delivery_assignments
  await check('delivery_assignments.dispatch_type existe', async () => {
    await db.select({ dispatchType: schema.deliveryAssignments.dispatchType }).from(schema.deliveryAssignments).limit(1)
  })
  await check('delivery_assignments.third_party_name existe', async () => {
    await db.select({ n: schema.deliveryAssignments.thirdPartyName }).from(schema.deliveryAssignments).limit(1)
  })
  await check('delivery_assignments.third_party_tracking existe', async () => {
    await db.select({ n: schema.deliveryAssignments.thirdPartyTracking }).from(schema.deliveryAssignments).limit(1)
  })

  // 3. Tabla email_queue_log
  await check('email_queue_log tabla existe y es consultable', async () => {
    await db.select({ id: schema.emailQueueLog.id, status: schema.emailQueueLog.status })
      .from(schema.emailQueueLog).limit(1)
  })

  // 4. Default de dispatch_type = 'internal'
  await check('dispatch_type DEFAULT = internal', async () => {
    const [row] = await db.execute(sql`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'delivery_assignments' AND column_name = 'dispatch_type'
    `)
    if (!String((row as Record<string,unknown>).column_default).includes('internal')) {
      throw new Error('DEFAULT incorrecto')
    }
  })

  // 5. Índices creados
  await check('Índices 0007 existen', async () => {
    const [rows] = await db.execute(sql`
      SELECT count(*) as cnt FROM pg_indexes
      WHERE indexname IN ('email_queue_log_order_idx', 'delivery_assignments_dispatch_type_idx')
    `)
    if (Number((rows as Record<string,unknown>).cnt) < 2) throw new Error('Faltan índices')
  })

  console.log(`\n${fail === 0 ? '✅' : '⚠️ '} ${ok} ok, ${fail} fallidos`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
