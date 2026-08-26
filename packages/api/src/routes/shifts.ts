import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import type { Bindings } from '../index'
import { shifts, cashMovements, orders, orderPayments, returns, tillSessions, users } from '@seul/db/schema'
import type { ZReport, MasterZReport } from '@seul/db/schema'
import { buildTillZReport } from './till-sessions'

const router = new Hono<{ Bindings: Bindings }>()

const openShiftSchema = z.object({
  device_id:        z.string().min(1),
  opening_float_clp: z.number().int().min(0),
})

// POST /api/shifts/open
router.post('/open', requireAuth(['owner', 'admin', 'staff']), zValidator('json', openShiftSchema), async (c) => {
  const db = getDb(c.env)
  const { device_id, opening_float_clp } = c.req.valid('json')
  const user = c.get('user')

  // Check for active shift on this device
  const [active] = await db.select().from(shifts)
    .where(and(eq(shifts.deviceId, device_id), eq(shifts.status, 'open')))
    .limit(1)

  if (active) {
    return c.json({ error: 'Terminal ocupada', shift: active }, 409)
  }

  const [newShift] = await db.insert(shifts).values({
    openedBy:     user.id,
    deviceId:     device_id,
    openingFloat: opening_float_clp,
    status:       'open',
  }).returning()

  await db.insert(cashMovements).values({
    shiftId:   newShift.id,
    type:      'opening_float',
    amountClp: opening_float_clp,
    createdBy: user.id,
  })

  return c.json({ shift: newShift }, 201)
})

// GET /api/shifts/active?device_id=xxx
router.get('/active', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { device_id } = c.req.query()

  if (!device_id) return c.json({ error: 'device_id requerido' }, 400)

  const [active] = await db.select().from(shifts)
    .where(and(eq(shifts.deviceId, device_id), eq(shifts.status, 'open')))
    .limit(1)

  return c.json({ shift: active ?? null })
})

// POST /api/shifts/:id/close
router.post('/:id/close', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db   = getDb(c.env)
  const user = c.get('user')
  const { id } = c.req.param()

  const [shift] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1)
  if (!shift) return c.json({ error: 'Turno no encontrado' }, 404)
  if (shift.status === 'closed') return c.json({ error: 'Turno ya cerrado' }, 409)

  if (shift.openedBy !== user.id && !['owner', 'admin'].includes(user.role)) {
    return c.json({ error: 'Sin permisos para cerrar este turno' }, 403)
  }

  // Block if any till sessions are still open
  const openTills = await db.select({ id: tillSessions.id })
    .from(tillSessions)
    .where(and(eq(tillSessions.shiftId, id), eq(tillSessions.status, 'open')))

  if (openTills.length > 0) {
    return c.json({
      error: `Hay ${openTills.length} caja(s) abiertas. Ciérralas antes de cerrar el turno.`,
      openTillIds: openTills.map(t => t.id),
    }, 409)
  }

  const closedAt  = new Date()
  const masterReport = await buildMasterZReport(db, shift, closedAt)

  await db.update(shifts).set({
    status:         'closed',
    closedAt,
    closingSummary: masterReport,
  }).where(eq(shifts.id, id))

  return c.json({ masterReport })
})

// GET /api/shifts/:id/z-report (master — aggregates all tills)
router.get('/:id/z-report', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [shift] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1)
  if (!shift) return c.json({ error: 'Turno no encontrado' }, 404)

  if (shift.status === 'closed' && shift.closingSummary) {
    return c.json({ masterReport: shift.closingSummary })
  }

  const masterReport = await buildMasterZReport(db, shift, new Date())
  return c.json({ masterReport })
})

async function buildMasterZReport(
  db: ReturnType<typeof import('../lib/db').getDb>,
  shift: typeof shifts.$inferSelect,
  closedAt: Date,
): Promise<MasterZReport> {
  const allTills = await db.select().from(tillSessions)
    .where(eq(tillSessions.shiftId, shift.id))

  const tillReports = await Promise.all(
    allTills.map(till => buildTillZReport(db, till, '', closedAt))
  )

  const totalTickets = tillReports.reduce((s, r) => s + r.ticketCount, 0)
  const totalVoids   = tillReports.reduce((s, r) => s + r.voidCount, 0)
  const totalRefunds = tillReports.reduce((s, r) => s + r.refundCount, 0)
  const grossTotal   = tillReports.reduce((s, r) => s + r.grossTotal, 0)
  const refundTotal  = tillReports.reduce((s, r) => s + r.refundTotal, 0)
  const netTotal     = grossTotal - refundTotal

  const byMethod: MasterZReport['byMethod'] = {
    cash: 0, debit: 0, credit: 0, baes: 0, qr: 0, transfer: 0,
  }
  for (const r of tillReports) {
    for (const [method, amount] of Object.entries(r.byMethod)) {
      byMethod[method] = (byMethod[method] ?? 0) + (amount as number)
    }
  }

  return {
    shiftId:      shift.id,
    shiftNumber:  shift.shiftNumber,
    openedAt:     shift.openedAt.toISOString(),
    closedAt:     closedAt.toISOString(),
    tillCount:    allTills.length,
    totalTickets,
    totalVoids,
    totalRefunds,
    grossTotal,
    refundTotal,
    netTotal,
    byMethod,
    tills: tillReports.map(r => ({
      tillId:            r.tillId,
      tillSessionNumber: r.tillSessionNumber,
      cashierName:       r.cashierName,
      openedAt:          r.openedAt,
      closedAt:          r.closedAt,
      openingFloat:      r.openingFloat,
      ticketCount:       r.ticketCount,
      netTotal:          r.netTotal,
      byMethod:          r.byMethod,
    })),
  }
}

// GET /api/shifts/history?device_id=&limit=30 — historial de turnos (Master Shift Report)
router.get('/history', requireAuth(['owner', 'admin']), async (c) => {
  const db = getDb(c.env)
  const { device_id, limit } = c.req.query()

  const rows = await db.select({
    id:             shifts.id,
    shiftNumber:    shifts.shiftNumber,
    deviceId:       shifts.deviceId,
    status:         shifts.status,
    openedAt:       shifts.openedAt,
    closedAt:       shifts.closedAt,
    openingFloat:   shifts.openingFloat,
    closingSummary: shifts.closingSummary,
    cashierName:    users.name,
    cashierEmail:   users.email,
  })
    .from(shifts)
    .innerJoin(users, eq(users.id, shifts.openedBy))
    .where(device_id ? eq(shifts.deviceId, device_id) : undefined)
    .orderBy(desc(shifts.openedAt))
    .limit(limit ? Math.min(Number(limit), 100) : 30)

  return c.json({ shifts: rows, total: rows.length })
})

export { router as shiftsRouter }
