import { Hono } from 'hono'
import { eq, and, lt, desc } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { dteRetryQueue, dteEvents, orders } from '@seul/db/schema'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/dte/queue - Listar reintentos pendientes
router.get('/queue', async (c) => {
  const db = getDb(c.env)

  const pending = await db.select()
    .from(dteRetryQueue)
    .where(eq(dteRetryQueue.status, 'pending'))
    .orderBy(dteRetryQueue.nextRetryAt)
    .limit(10)

  return c.json({ pending, count: pending.length })
})

// POST /api/dte/retry - Procesar queue (llamado por CRON)
router.post('/retry', async (c) => {
  const db = getDb(c.env)

  // Obtener items que necesitan reintento
  const now = new Date()
  const toRetry = await db.select()
    .from(dteRetryQueue)
    .where(and(
      eq(dteRetryQueue.status, 'pending'),
      lt(dteRetryQueue.nextRetryAt, now)
    ))
    .limit(5)

  let processed = 0
  let failed = 0

  for (const item of toRetry) {
    try {
      // Aquí iría la lógica real de reintentar con DTE provider
      // Por ahora, simulamos éxito
      const success = Math.random() > 0.3 // 70% éxito simulado
      const maxRetries = item.maxRetries ?? 3

      if (success && item.attemptNumber < maxRetries) {
        // Reintento exitoso - marcar como success
        await db.update(dteRetryQueue)
          .set({
            status: 'success',
            processedAt: now,
          })
          .where(eq(dteRetryQueue.id, item.id))

        // Actualizar orden a 'entregada' (asumiendo DTE éxito)
        await db.update(orders)
          .set({ status: 'entregada' })
          .where(eq(orders.id, item.orderId))

        processed++
      } else if (item.attemptNumber >= maxRetries) {
        // Máx reintentos alcanzado
        await db.update(dteRetryQueue)
          .set({
            status: 'failed',
            lastError: 'Max retries exceeded',
            processedAt: now,
          })
          .where(eq(dteRetryQueue.id, item.id))

        // Marcar orden como cancelada (no pudimos emitir boleta)
        await db.update(orders)
          .set({ status: 'cancelada' })
          .where(eq(orders.id, item.orderId))

        failed++
      } else {
        // Reintento fallido - agendar próximo intento con backoff exponencial
        const backoffMs = Math.pow(2, item.attemptNumber) * 60000 // 2^n minutos
        const nextRetry = new Date(now.getTime() + backoffMs)

        await db.update(dteRetryQueue)
          .set({
            attemptNumber: item.attemptNumber + 1,
            nextRetryAt: nextRetry,
            lastError: 'Provider error - retrying',
          })
          .where(eq(dteRetryQueue.id, item.id))
      }
    } catch (error) {
      failed++
      console.error(`DTE retry error for ${item.orderId}:`, error)
    }
  }

  return c.json({
    message: 'DTE retry queue processed',
    processed,
    failed,
    attempted: toRetry.length,
  })
})

// POST /api/dte/enqueue - Crear reintento para una orden (cuando falla DTE initial)
router.post('/enqueue', async (c) => {
  const db = getDb(c.env)
  const { orderId } = await c.req.json() as { orderId: string }

  const now = new Date()
  const nextRetry = new Date(now.getTime() + 5 * 60000) // Próximo intento en 5 min

  await db.insert(dteRetryQueue).values({
    orderId,
    attemptNumber: 1,
    maxRetries: 3,
    status: 'pending',
    nextRetryAt: nextRetry,
  })

  return c.json({ ok: true, nextRetryAt: nextRetry }, 201)
})

export { router as dteRetryRouter }
