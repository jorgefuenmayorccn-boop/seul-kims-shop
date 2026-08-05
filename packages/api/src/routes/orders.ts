import { Hono } from 'hono'
import { eq, desc, sql, and } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import type { Bindings } from '../index'
import { orders, orderItems, inventory, inventoryMovements } from '@seul/db/schema'
import { generatePDFToken } from '../lib/tokens'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/orders — lista de pedidos activos
router.get('/', async (c) => {
  const db = getDb(c.env)
  const { channel, status } = c.req.query()

  const rows = await db.select().from(orders)
    .where(and(
      channel ? eq(orders.channel, channel as 'pos' | 'web' | 'b2b' | 'whatsapp') : undefined,
      status ? eq(orders.status, status as 'nueva' | 'preparando' | 'lista' | 'entregada' | 'cancelada') : undefined,
    ))
    .orderBy(desc(orders.createdAt))
    .limit(100)

  return c.json({ orders: rows })
})

// GET /api/orders/comandas — pedidos activos agrupados por canal (para Kanban)
router.get('/comandas', async (c) => {
  const db = getDb(c.env)

  const active = await db.select({
    id:           orders.id,
    number:       orders.number,
    channel:      orders.channel,
    status:       orders.status,
    deliveryMode: orders.deliveryMode,
    metroStation: orders.metroStation,
    metroSlot:    orders.metroSlot,
    total:        orders.total,
    dteStatus:    orders.dteStatus,
    createdAt:    orders.createdAt,
    itemCount:    sql<number>`count(${orderItems.id})`,
  })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(sql`${orders.status} in ('nueva', 'preparando', 'lista')`)
    .groupBy(orders.id)
    .orderBy(orders.createdAt)

  return c.json({
    nueva:      active.filter(o => o.status === 'nueva'),
    preparando: active.filter(o => o.status === 'preparando'),
    lista:      active.filter(o => o.status === 'lista'),
  })
})

// GET /api/orders/:id
router.get('/:id', async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [order] = await db.select().from(orders).where(eq(orders.id, id))
  if (!order) return c.json({ error: 'Not found' }, 404)

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id))
  return c.json({ ...order, items })
})

// PATCH /api/orders/:id/status — cambiar estado (Kanban drag & drop)
const statusSchema = z.object({
  status: z.enum(['nueva', 'preparando', 'lista', 'entregada', 'cancelada']),
})

router.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()
  const { status } = c.req.valid('json')

  await db.update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, id))

  return c.json({ ok: true })
})

// POST /api/orders — crear pedido (desde POS)
const createOrderSchema = z.object({
  channel: z.enum(['pos', 'web', 'b2b', 'whatsapp']),
  deliveryMode: z.enum(['rappi', 'metro', 'pickup', 'shipping']),
  customerId: z.string().uuid().optional(),
  metroStation: z.string().optional(),
  metroSlot: z.string().optional(),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId:  z.string().uuid(),
    quantity:   z.number().positive(),
    unitPrice:  z.number().int().positive(),
    isBaes:     z.boolean().default(false),
  })),
})

router.post('/', zValidator('json', createOrderSchema), async (c) => {
  const db = getDb(c.env)
  const body = c.req.valid('json')

  const subtotal = body.items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const baesAmount = body.items
    .filter(i => i.isBaes)
    .reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const total = subtotal - baesAmount

  // Número de pedido autoincremental
  const [{ maxNum }] = await db.select({
    maxNum: sql<number>`coalesce(max(${orders.number}), 0)`,
  }).from(orders)

  const pdfToken = generatePDFToken()
  const pdfExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const [newOrder] = await db.insert(orders).values({
    number:          (maxNum ?? 0) + 1,
    channel:         body.channel,
    customerId:      body.customerId ?? null,
    deliveryMode:    body.deliveryMode,
    metroStation:    body.metroStation ?? null,
    metroSlot:       body.metroSlot ?? null,
    deliveryAddress: body.deliveryAddress ?? null,
    subtotal:        subtotal.toString(),
    baesAmount:      baesAmount.toString(),
    total:           total.toString(),
    pdfToken,
    pdfExpiresAt,
    notes:           body.notes ?? null,
    dteStatus:       'pending',
  }).returning()

  await db.insert(orderItems).values(
    body.items.map(i => ({
      orderId:   newOrder.id,
      productId: i.productId,
      quantity:  i.quantity.toString(),
      unitPrice: i.unitPrice.toString(),
      isBaes:    i.isBaes,
      subtotal:  (i.unitPrice * i.quantity).toString(),
    }))
  )

  // Descontar stock
  for (const item of body.items) {
    await db.insert(inventoryMovements).values({
      productId:   item.productId,
      type:        'sale',
      quantity:    -Math.round(item.quantity),
      referenceId: newOrder.id,
    })
  }

  // Encolar DTE en Cloudflare Queue
  await c.env.DTE_QUEUE.send({ orderId: newOrder.id, attempt: 1 })

  return c.json({
    ok: true,
    orderId:   newOrder.id,
    number:    newOrder.number,
    pdfToken,
    total,
  }, 201)
})

export { router as ordersRouter }
