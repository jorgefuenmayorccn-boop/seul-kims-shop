import { Hono } from 'hono'
import { eq, desc, and } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import type { Bindings } from '../index'
import { returns, orders } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// POST /api/returns — solicitud de devolución (cliente)
const createSchema = z.object({
  orderId:  z.string().uuid(),
  type:     z.enum(['defective', 'wrong_item', 'changed_mind', 'other']),
  reason:   z.string().min(10).max(500),
})

router.post('/', zValidator('json', createSchema), async (c) => {
  const db   = getDb(c.env)
  const body = c.req.valid('json')

  const [order] = await db.select({ id: orders.id, customerId: orders.customerId, createdAt: orders.createdAt })
    .from(orders)
    .where(eq(orders.id, body.orderId))

  if (!order) return c.json({ error: 'Pedido no encontrado' }, 404)

  // Ley del Consumidor — plazo 10 días hábiles para arrepentimiento en compra web
  const diasDesdeCompra = Math.floor((Date.now() - new Date(order.createdAt ?? Date.now()).getTime()) / (1000 * 60 * 60 * 24))
  if (body.type === 'changed_mind' && diasDesdeCompra > 14) {
    return c.json({ error: 'El plazo de retracto de 10 días hábiles ha expirado.' }, 400)
  }

  const [newReturn] = await db.insert(returns).values({
    orderId:    body.orderId,
    customerId: order.customerId ?? undefined,
    type:       body.type,
    reason:     body.reason,
    status:     'pending',
  }).returning()

  console.info('[DEVOLUCION_NUEVA]', { returnId: newReturn.id, orderId: body.orderId, type: body.type })

  return c.json({ ok: true, returnId: newReturn.id }, 201)
})

// GET /api/returns — listado admin
router.get('/', async (c) => {
  const db     = getDb(c.env)
  const { status } = c.req.query()

  const rows = await db.select().from(returns)
    .where(status ? eq(returns.status, status as 'pending' | 'approved' | 'rejected' | 'processed') : undefined)
    .orderBy(desc(returns.createdAt))
    .limit(50)

  return c.json({ returns: rows })
})

// GET /api/returns/:id
router.get('/:id', async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [row] = await db.select().from(returns).where(eq(returns.id, id))
  if (!row) return c.json({ error: 'No encontrado' }, 404)

  return c.json(row)
})

// PATCH /api/returns/:id — admin aprueba/rechaza/procesa
const patchSchema = z.object({
  status:          z.enum(['approved', 'rejected', 'processed']),
  refundAmountClp: z.number().int().optional(),
  resolution:      z.string().optional(),
  notes:           z.string().optional(),
})

router.patch('/:id', zValidator('json', patchSchema), async (c) => {
  const db   = getDb(c.env)
  const { id } = c.req.param()
  const body = c.req.valid('json')

  await db.update(returns)
    .set({
      status:          body.status,
      ...(body.refundAmountClp !== undefined && { refundAmountClp: body.refundAmountClp }),
      ...(body.resolution && { resolution: body.resolution }),
      ...(body.notes && { notes: body.notes }),
      ...(['processed', 'rejected'].includes(body.status) && { resolvedAt: new Date() }),
    })
    .where(eq(returns.id, id))

  return c.json({ ok: true })
})

export { router as returnsRouter }
