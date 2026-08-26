import { Hono } from 'hono'
import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import type { Bindings } from '../index'
import { orders, orderPayments, tiendaConfig } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/analytics/sales?tillSessionId=&from=&to=
router.get('/sales', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { tillSessionId, from, to } = c.req.query()

  const conditions = []
  if (tillSessionId) conditions.push(eq(orders.tillSessionId, tillSessionId))
  if (from) conditions.push(gte(orders.createdAt, new Date(from)))
  if (to)   conditions.push(lte(orders.createdAt, new Date(to)))

  const rows = await db.select({
    id:         orders.id,
    number:     orders.number,
    total:      orders.total,
    subtotal:   orders.subtotal,
    baesAmount: orders.baesAmount,
    status:     orders.status,
    dteType:    orders.dteType,
    createdAt:  orders.createdAt,
    voidedAt:   orders.voidedAt,
    voidReason: orders.voidReason,
  }).from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(500)

  const orderIds = rows.map(r => r.id)

  const payments = orderIds.length
    ? await db.select({
        id:       orderPayments.id,
        orderId:  orderPayments.orderId,
        method:   orderPayments.method,
        amount:   orderPayments.amount,
      }).from(orderPayments).where(inArray(orderPayments.orderId, orderIds))
    : []

  const paymentsByOrder = new Map<string, typeof payments>()
  for (const p of payments) {
    if (!paymentsByOrder.has(p.orderId)) paymentsByOrder.set(p.orderId, [])
    paymentsByOrder.get(p.orderId)!.push(p)
  }

  const enriched = rows.map(r => ({
    ...r,
    payments: paymentsByOrder.get(r.id) ?? [],
  }))

  const valid = enriched.filter(o => o.status !== 'cancelada')
  const totalRevenue = valid.reduce((s, o) => s + Number(o.total), 0)
  const orderCount   = valid.length
  const avgTicket    = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0

  const byMethod: Record<string, number> = {}
  for (const o of valid) {
    for (const p of o.payments) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount)
    }
  }

  return c.json({
    kpis: { totalRevenue, orderCount, avgTicket, byMethod },
    orders: enriched,
  })
})

// POST /api/analytics/pin-check
router.post(
  '/pin-check',
  requireAuth(['owner', 'admin', 'staff']),
  zValidator('json', z.object({ pin: z.string().min(1).max(8) })),
  async (c) => {
    const db = getDb(c.env)
    const { pin } = c.req.valid('json')

    const [cfg] = await db.select({ value: tiendaConfig.value })
      .from(tiendaConfig)
      .where(eq(tiendaConfig.key, 'analytics_pin'))

    const correctPin = cfg?.value ?? '1234'
    return c.json({ ok: pin === correctPin })
  }
)

export { router as analyticsRouter }
