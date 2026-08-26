import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import type { Bindings } from '../index'
import { tillSessions, shifts, orders, orderPayments, returns, users } from '@seul/db/schema'
import type { TillZReport } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

const openTillSchema = z.object({
  shift_id:          z.string().uuid(),
  device_id:         z.string().min(1),
  opening_float_clp: z.number().int().min(0),
})

// POST /api/till-sessions/open
router.post('/open', requireAuth(['owner', 'admin', 'staff']), zValidator('json', openTillSchema), async (c) => {
  const db = getDb(c.env)
  const { shift_id, device_id, opening_float_clp } = c.req.valid('json')
  const user = c.get('user')

  // Verify parent shift is open
  const [shift] = await db.select().from(shifts)
    .where(and(eq(shifts.id, shift_id), eq(shifts.status, 'open')))
    .limit(1)

  if (!shift) return c.json({ error: 'Turno no encontrado o ya cerrado' }, 404)

  // One active till per device
  const [activeTill] = await db.select().from(tillSessions)
    .where(and(eq(tillSessions.deviceId, device_id), eq(tillSessions.status, 'open')))
    .limit(1)

  if (activeTill) return c.json({ error: 'Caja ya abierta en este terminal', tillSession: activeTill }, 409)

  const [newTill] = await db.insert(tillSessions).values({
    shiftId:      shift_id,
    openedBy:     user.id,
    deviceId:     device_id,
    openingFloat: opening_float_clp,
    status:       'open',
  }).returning()

  return c.json({ tillSession: newTill }, 201)
})

// GET /api/till-sessions/active?device_id=xxx
router.get('/active', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { device_id } = c.req.query()

  if (!device_id) return c.json({ error: 'device_id requerido' }, 400)

  const [active] = await db.select({
    id:             tillSessions.id,
    sessionNumber:  tillSessions.sessionNumber,
    shiftId:        tillSessions.shiftId,
    openedBy:       tillSessions.openedBy,
    deviceId:       tillSessions.deviceId,
    openingFloat:   tillSessions.openingFloat,
    status:         tillSessions.status,
    openedAt:       tillSessions.openedAt,
    closedAt:       tillSessions.closedAt,
    openedByName:   users.name,
  })
    .from(tillSessions)
    .leftJoin(users, eq(users.id, tillSessions.openedBy))
    .where(and(eq(tillSessions.deviceId, device_id), eq(tillSessions.status, 'open')))
    .limit(1)

  return c.json({ tillSession: active ?? null })
})

// POST /api/till-sessions/:id/close
router.post('/:id/close', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db   = getDb(c.env)
  const user = c.get('user')
  const { id } = c.req.param()

  const [till] = await db.select().from(tillSessions).where(eq(tillSessions.id, id)).limit(1)
  if (!till) return c.json({ error: 'Caja no encontrada' }, 404)
  if (till.status === 'closed') return c.json({ error: 'Caja ya cerrada' }, 409)

  if (till.openedBy !== user.id && !['owner', 'admin'].includes(user.role)) {
    return c.json({ error: 'Sin permisos para cerrar esta caja' }, 403)
  }

  const closedAt  = new Date()
  const zReport   = await buildTillZReport(db, till, user.name, closedAt)

  await db.update(tillSessions).set({
    status:         'closed',
    closedAt,
    closingSummary: zReport,
  }).where(eq(tillSessions.id, id))

  return c.json({ zReport })
})

// GET /api/till-sessions/:id/orders
router.get('/:id/orders', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const rows = await db.select({
    id:        orders.id,
    number:    orders.number,
    total:     orders.total,
    status:    orders.status,
    channel:   orders.channel,
    createdAt: orders.createdAt,
  })
    .from(orders)
    .where(eq(orders.tillSessionId, id))
    .orderBy(desc(orders.createdAt))

  return c.json({ orders: rows })
})

// GET /api/till-sessions/:id/z-report
router.get('/:id/z-report', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [till] = await db.select().from(tillSessions).where(eq(tillSessions.id, id)).limit(1)
  if (!till) return c.json({ error: 'Caja no encontrada' }, 404)

  if (till.status === 'closed' && till.closingSummary) {
    return c.json({ zReport: till.closingSummary })
  }

  const user = c.get('user')
  const zReport = await buildTillZReport(db, till, user.name, new Date())
  return c.json({ zReport })
})

async function buildTillZReport(
  db: ReturnType<typeof import('../lib/db').getDb>,
  till: typeof tillSessions.$inferSelect,
  cashierName: string,
  closedAt: Date,
): Promise<TillZReport> {
  // Fetch parent shift for shiftNumber
  const [shift] = await db.select({ shiftNumber: shifts.shiftNumber })
    .from(shifts).where(eq(shifts.id, till.shiftId)).limit(1)

  const tillOrders = await db.select({
    id:     orders.id,
    total:  orders.total,
    status: orders.status,
  }).from(orders).where(eq(orders.tillSessionId, till.id))

  const validOrders = tillOrders.filter(o => o.status !== 'cancelada')
  const voidCount   = tillOrders.filter(o => o.status === 'cancelada').length

  const ticketCount = validOrders.length
  const grossTotal  = validOrders.reduce((s, o) => s + Number(o.total), 0)

  const byMethod: TillZReport['byMethod'] = {
    cash: 0, debit: 0, credit: 0, baes: 0, qr: 0, transfer: 0,
  }

  let refundTotal = 0
  let refundCount = 0

  if (validOrders.length > 0) {
    const validIds = validOrders.map(o => o.id)

    const payments = await db.select().from(orderPayments)
      .where(inArray(orderPayments.orderId, validIds))

    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount)
    }

    const refundRows = await db.select({ refundAmountClp: returns.refundAmountClp })
      .from(returns)
      .where(and(
        inArray(returns.orderId, validIds),
        eq(returns.status, 'processed'),
      ))

    refundTotal = refundRows.reduce((s, r) => s + (r.refundAmountClp ?? 0), 0)
    refundCount = refundRows.length
  }

  const netTotal     = grossTotal - refundTotal
  const expectedCash = till.openingFloat + byMethod.cash

  return {
    tillId:            till.id,
    tillSessionNumber: till.sessionNumber,
    shiftId:           till.shiftId,
    shiftNumber:       shift?.shiftNumber ?? 0,
    cashierName,
    openedAt:          till.openedAt.toISOString(),
    closedAt:          closedAt.toISOString(),
    openingFloat:      till.openingFloat,
    ticketCount,
    voidCount,
    refundCount,
    grossTotal,
    refundTotal,
    netTotal,
    byMethod,
    expectedCash,
  }
}

export { router as tillSessionsRouter }
export { buildTillZReport }
