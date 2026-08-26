import { Hono } from 'hono'
import { eq, desc, sql, and, asc, inArray } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import type { Bindings } from '../index'
import { orders, orderItems, inventory, inventoryMovements, orderPayments, products, tiendaConfig, posVoidEvents, loyaltyLedger, deliveryAssignments } from '@seul/db/schema'
import { generatePDFToken } from '../lib/tokens'
import { publishOrderEvent } from './events'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/orders — lista de pedidos activos
router.get('/', async (c) => {
  const db = getDb(c.env)
  const { channel, status, limit } = c.req.query()

  const rows = await db.select().from(orders)
    .where(and(
      channel ? eq(orders.channel, channel as 'pos' | 'web' | 'b2b' | 'whatsapp') : undefined,
      status ? eq(orders.status, status as 'nueva' | 'preparando' | 'lista' | 'entregada' | 'cancelada') : undefined,
    ))
    .orderBy(desc(orders.createdAt))
    .limit(limit ? Number(limit) : 100)

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

// GET /api/orders/:id/comanda — kitchen/prep ticket payload (sin precios)
router.get('/:id/comanda', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [order] = await db.select().from(orders).where(eq(orders.id, id))
  if (!order) return c.json({ error: 'Not found' }, 404)

  const items = await db.select({
    qty:       orderItems.quantity,
    productId: orderItems.productId,
    name:      products.name,
  })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, id))

  return c.json({
    comanda: {
      orderId:      order.id,
      number:       order.number,
      channel:      order.channel,
      createdAt:    order.createdAt?.toISOString() ?? new Date().toISOString(),
      deliveryMode: order.deliveryMode,
      metroStation: order.metroStation ?? undefined,
      metroSlot:    order.metroSlot    ?? undefined,
      notes:        order.notes        ?? undefined,
      items: items.map(i => ({
        name:  i.name,
        qty:   Number(i.qty),
      })),
    },
  })
})

// PATCH /api/orders/:id/status — cambiar estado (Kanban drag & drop)
const statusSchema = z.object({
  status: z.enum(['nueva', 'preparando', 'lista', 'entregada', 'cancelada']),
})

router.patch('/:id/status', requireAuth(['owner', 'admin', 'staff']), zValidator('json', statusSchema), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()
  const { status } = c.req.valid('json')

  if (status === 'cancelada') {
    return c.json({ error: 'Usar POST /:id/void para anular pedidos' }, 400)
  }

  const [order] = await db.select({
    id:           orders.id,
    number:       orders.number,
    deliveryMode: orders.deliveryMode,
    total:        orders.total,
  }).from(orders).where(eq(orders.id, id))

  if (!order) return c.json({ error: 'Not found' }, 404)

  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id))

  // Cuando pasa a 'lista' con despacho → notificar en tiempo real a repartidores
  if (status === 'lista' && order.deliveryMode !== 'pickup') {
    const [assignment] = await db.select({
      id:              deliveryAssignments.id,
      driverId:        deliveryAssignments.driverId,
      amountToCollect: deliveryAssignments.amountToCollect,
      paymentAtDoor:   deliveryAssignments.paymentAtDoor,
    }).from(deliveryAssignments)
      .where(eq(deliveryAssignments.orderId, id))
      .limit(1)

    publishOrderEvent(c.env, {
      type:    'order.ready_for_dispatch',
      channel: 'internal',
      payload: {
        orderId:         order.id,
        orderNumber:     order.number,
        assignmentId:    assignment?.id         ?? null,
        driverId:        assignment?.driverId   ?? null,
        total:           order.total,
        amountToCollect: assignment?.amountToCollect ?? 0,
        paymentAtDoor:   assignment?.paymentAtDoor   ?? 'not_required',
        deliveryMode:    order.deliveryMode,
      },
    })
  }

  return c.json({ ok: true })
})

// POST /api/orders — crear pedido (desde POS)
const createOrderSchema = z.object({
  channel:      z.enum(['pos', 'web', 'b2b', 'whatsapp']),
  deliveryMode: z.enum(['rappi', 'metro', 'pickup', 'shipping', 'delivery']),
  dteType:      z.enum(['nota_venta', 'boleta', 'factura']).default('nota_venta'),
  customerId:      z.string().uuid().optional(),
  shiftId:         z.string().uuid().optional(),
  tillSessionId:   z.string().uuid().optional(),
  metroStation:    z.string().optional(),
  metroSlot:       z.string().optional(),
  deliveryAddress: z.string().optional(),
  notes:           z.string().optional(),
  // Delivery manual sin cuenta registrada (WhatsApp/teléfono/POS)
  guestName:       z.string().max(120).optional(),
  guestPhone:      z.string().max(20).optional(),
  guestEmail:      z.string().email().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity:  z.number().positive(),
    unitPrice: z.number().int().positive(),
    isBaes:    z.boolean().default(false),
  })),
  payments: z.array(z.object({
    method: z.string(),
    amount: z.number().int().positive(),
  })).optional(),
  receiver: z.object({
    rut:         z.string(),
    razonSocial: z.string(),
    giro:        z.string(),
    direccion:   z.string(),
    comuna:      z.string(),
  }).optional(),
})

router.post('/', requireAuth(['owner', 'admin', 'staff']), zValidator('json', createOrderSchema), async (c) => {
  const db   = getDb(c.env)
  const body = c.req.valid('json')
  const user = c.get('user') as { id: string } | undefined

  if (body.channel === 'pos' && !body.shiftId) {
    return c.json({ error: 'POS orders require an active shift_id' }, 400)
  }
  if (body.channel === 'pos' && !body.tillSessionId) {
    return c.json({ error: 'POS orders require an active till_session_id' }, 400)
  }

  // Resolver precio efectivo por canal desde la base de datos (server-authoritative)
  const productIds = [...new Set(body.items.map(i => i.productId))]
  const priceRows  = await db
    .select({
      id:             products.id,
      priceRetail:    products.priceRetail,
      priceWeb:       products.priceWeb,
      pricePOS:       products.pricePOS,
      priceB2B:       products.priceB2B,
      discountWebPct: products.discountWebPct,
      discountPOSPct: products.discountPOSPct,
      discountB2BPct: products.discountB2BPct,
    })
    .from(products)
    .where(inArray(products.id, productIds))

  const priceMap = new Map(priceRows.map(p => [p.id, p]))

  function resolvePrice(productId: string, channel: string): number {
    const p = priceMap.get(productId)
    if (!p) return 0
    const retail = Number(p.priceRetail)
    if (channel === 'pos') {
      const base = p.pricePOS ? Number(p.pricePOS) : retail
      const disc = p.discountPOSPct ?? 0
      return disc > 0 ? Math.round(base * (1 - disc / 100)) : base
    }
    if (channel === 'web') {
      const base = p.priceWeb ? Number(p.priceWeb) : retail
      const disc = p.discountWebPct ?? 0
      return disc > 0 ? Math.round(base * (1 - disc / 100)) : base
    }
    if (channel === 'b2b') {
      const base = p.priceB2B ? Number(p.priceB2B) : retail
      const disc = p.discountB2BPct ?? 0
      return disc > 0 ? Math.round(base * (1 - disc / 100)) : base
    }
    return retail
  }

  // Reemplazar unitPrice del cliente con el precio resuelto server-side
  const resolvedItems = body.items.map(i => ({
    ...i,
    unitPrice: resolvePrice(i.productId, body.channel),
  }))

  // Rechazar si algún producto no tiene precio válido
  const zeroPriceItem = resolvedItems.find(i => i.unitPrice <= 0)
  if (zeroPriceItem) {
    return c.json({ error: 'invalid_price', productId: zeroPriceItem.productId }, 400)
  }

  const subtotal = resolvedItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const baesAmount = resolvedItems
    .filter(i => i.isBaes)
    .reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const total = subtotal - baesAmount

  // Pre-verificar stock antes de abrir transacción (fail fast, evita over-sell)
  for (const item of resolvedItems) {
    const [{ available }] = await db.select({
      available: sql<number>`coalesce(sum(${inventory.quantity}), 0)`,
    }).from(inventory).where(and(
      eq(inventory.productId, item.productId),
      sql`${inventory.quantity} > 0`,
    ))
    if (Number(available) < item.quantity) {
      return c.json({ error: 'insufficient_stock', productId: item.productId }, 409)
    }
  }

  const pdfToken     = generatePDFToken()
  const pdfExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  // Transacción atómica: número de pedido + INSERT order + items + stock deduction
  let newOrder: typeof orders.$inferSelect
  try {
    newOrder = await db.transaction(async (tx) => {
      const [{ maxNum }] = await tx.select({
        maxNum: sql<number>`coalesce(max(${orders.number}), 0)`,
      }).from(orders)

      const [order] = await tx.insert(orders).values({
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
        dteType:         body.dteType ?? 'nota_venta',
        dteStatus:       'pending',
        shiftId:         body.shiftId ?? null,
        tillSessionId:   body.tillSessionId ?? null,
        cashierId:       user?.id ?? null,
        receiverRut:     body.receiver?.rut ?? null,
        receiverName:    body.receiver?.razonSocial ?? null,
        receiverGiro:    body.receiver?.giro ?? null,
        receiverAddress: body.receiver?.direccion ?? null,
        receiverComuna:  body.receiver?.comuna ?? null,
        pdfToken,
        pdfExpiresAt,
        notes:           body.notes ?? null,
        guestName:       body.guestName  ?? null,
        guestPhone:      body.guestPhone ?? null,
        guestEmail:      body.guestEmail ?? null,
      }).returning()

      await tx.insert(orderItems).values(
        resolvedItems.map(i => ({
          orderId:   order.id,
          productId: i.productId,
          quantity:  i.quantity.toString(),
          unitPrice: i.unitPrice.toString(),
          isBaes:    i.isBaes,
          subtotal:  (i.unitPrice * i.quantity).toString(),
        }))
      )

      // Descontar stock FIFO — lote más próximo a vencer primero
      for (const item of resolvedItems) {
        const lots = await tx.select()
          .from(inventory)
          .where(and(
            eq(inventory.productId, item.productId),
            sql`${inventory.quantity} > 0`,
          ))
          .orderBy(asc(inventory.expiresAt))

        let remaining = Math.round(item.quantity)
        for (const lot of lots) {
          if (remaining <= 0) break
          const take = Math.min(remaining, lot.quantity)
          await tx.update(inventory)
            .set({ quantity: sql`${inventory.quantity} - ${take}` })
            .where(eq(inventory.id, lot.id))
          await tx.insert(inventoryMovements).values({
            productId:   item.productId,
            inventoryId: lot.id,
            type:        'sale',
            quantity:    -take,
            referenceId: order.id,
          })
          remaining -= take
        }
      }

      // Guardar pagos (tenders) — dentro de la transacción para atomicidad
      if (body.payments && body.payments.length > 0) {
        await tx.insert(orderPayments).values(
          body.payments.map(p => ({
            orderId: order.id,
            method:  p.method,
            amount:  p.amount.toString(),
          }))
        )
      }

      return order
    })
  } catch (err) {
    console.error('[orders] transaction failed:', err)
    return c.json({ error: 'transaction_failed', detail: err instanceof Error ? err.message : String(err) }, 500)
  }

  // Delivery assignment — sincrónico para devolver assignmentId en la respuesta
  let assignmentId: string | null = null
  if (body.deliveryMode !== 'pickup') {
    const needsPaymentAtDoor = body.payments?.some(p => p.method === 'cash' || p.method === 'debit' || p.method === 'cod')
    try {
      const [assignment] = await db.insert(deliveryAssignments).values({
        orderId:         newOrder.id,
        status:          'pending',
        paymentAtDoor:   needsPaymentAtDoor ? 'pending' : 'not_required',
        amountToCollect: needsPaymentAtDoor ? total : 0,
      }).returning({ id: deliveryAssignments.id })
      assignmentId = assignment?.id ?? null
    } catch (err) {
      console.error('[orders] delivery assignment insert failed:', err)
    }
  }

  // Loyalty: acumular puntos — 1 punto por CLP 1.000 gastado
  if (body.customerId && total > 0) {
    const earnPoints = Math.floor(total / 1000)
    if (earnPoints > 0) {
      c.executionCtx.waitUntil(
        db.insert(loyaltyLedger).values({
          customerId: body.customerId,
          orderId:    newOrder.id,
          type:       'earn',
          points:     earnPoints,
          reason:     `Pedido #${newOrder.number}`,
          createdBy:  user?.id ?? null,
        })
      )
    }
  }

  // Encolar DTE — nunca abortar el pedido si la cola falla
  try {
    await c.env.DTE_QUEUE.send({ orderId: newOrder.id, attempt: 1 })
  } catch (err) {
    console.error('[orders] DTE_QUEUE.send failed:', err)
    await db.update(orders).set({ dteStatus: 'failed', updatedAt: new Date() }).where(eq(orders.id, newOrder.id))
  }

  // Encolar email transaccional "Pedido en preparación" (no bloquea)
  c.executionCtx.waitUntil(
    c.env.EMAIL_QUEUE.send({ orderId: newOrder.id, trigger: 'order_created', attempt: 1 })
      .catch((err: unknown) => console.error('[orders] EMAIL_QUEUE.send failed:', err))
  )

  // Emitir evento realtime al POS cuando el pedido viene del canal web/whatsapp/b2b
  if (body.channel !== 'pos') {
    publishOrderEvent(c.env, {
      type:    'order.created',
      channel: body.channel,
      payload: {
        orderId:      newOrder.id,
        number:       newOrder.number,
        channel:      newOrder.channel,
        total,
        deliveryMode: newOrder.deliveryMode,
        metroStation: newOrder.metroStation ?? undefined,
        metroSlot:    newOrder.metroSlot    ?? undefined,
        notes:        newOrder.notes        ?? undefined,
        itemCount:    body.items.length,
        createdAt:    newOrder.createdAt?.toISOString() ?? new Date().toISOString(),
      },
    })
  }

  return c.json({
    ok:           true,
    orderId:      newOrder.id,
    number:       newOrder.number,
    dteType:      newOrder.dteType,
    dteStatus:    newOrder.dteStatus,
    pdfToken,
    total,
    assignmentId,
  }, 201)
})

// GET /api/orders/:id/dte-status — polling del badge DTE en el POS
router.get('/:id/dte-status', async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [order] = await db.select({
    dteStatus: orders.dteStatus,
    dteType:   orders.dteType,
    dteFolio:  orders.dteFolio,
    pdfToken:  orders.pdfToken,
    pdfUrl:    orders.pdfUrl,
    number:    orders.number,
  }).from(orders).where(eq(orders.id, id))

  if (!order) return c.json({ error: 'Not found' }, 404)

  return c.json({
    status:   order.dteStatus,
    dteType:  order.dteType,
    folio:    order.dteFolio,
    pdfToken: order.pdfToken,
    pdfUrl:   order.pdfUrl,
    number:   order.number,
  })
})

// POST /api/orders/:id/void — anular pedido con PIN de autorización
const voidSchema = z.object({
  pin:    z.string().min(1).max(8),
  reason: z.string().min(1).max(255),
})

router.post('/:id/void', requireAuth(['owner', 'admin', 'staff']), zValidator('json', voidSchema), async (c) => {
  const db   = getDb(c.env)
  const { id } = c.req.param()
  const { pin, reason } = c.req.valid('json')
  const user = c.get('user') as { id: string } | undefined

  // Validar PIN desde tiendaConfig
  const [cfg] = await db.select({ value: tiendaConfig.value })
    .from(tiendaConfig)
    .where(eq(tiendaConfig.key, 'void_pin'))

  const voidPin = cfg?.value ?? 'abcd'
  if (pin !== voidPin) {
    return c.json({ error: 'PIN incorrecto' }, 403)
  }

  const [order] = await db.select({
    id:     orders.id,
    status: orders.status,
    number: orders.number,
    total:  orders.total,
  }).from(orders).where(eq(orders.id, id))

  if (!order) return c.json({ error: 'Not found' }, 404)
  if (order.status === 'cancelada') return c.json({ error: 'El pedido ya está anulado' }, 409)

  const now = new Date()

  // Obtener items para revertir stock
  const items = await db.select({
    productId: orderItems.productId,
    quantity:  orderItems.quantity,
  }).from(orderItems).where(eq(orderItems.orderId, id))

  await db.transaction(async (tx) => {
    await tx.update(orders).set({
      status:     'cancelada',
      voidedBy:   user?.id ?? null,
      voidedAt:   now,
      voidReason: reason,
      updatedAt:  now,
    }).where(eq(orders.id, id))

    // Revertir stock — devolver unidades al lote más reciente (inverso FIFO)
    for (const item of items) {
      const qty = Math.round(Number(item.quantity))
      // Buscar el lote que fue descontado (el mismo FIFO — actualizamos el primero disponible)
      const [lot] = await tx.select({ id: inventory.id })
        .from(inventory)
        .where(eq(inventory.productId, item.productId))
        .orderBy(asc(inventory.expiresAt))
        .limit(1)

      if (lot) {
        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} + ${qty}` })
          .where(eq(inventory.id, lot.id))
      }

      await tx.insert(inventoryMovements).values({
        productId:   item.productId,
        inventoryId: lot?.id ?? null,
        type:        'return',
        quantity:    qty,
        referenceId: id,
      })
    }

    if (user?.id) {
      await tx.insert(posVoidEvents).values({
        orderId:   id,
        voidedBy:  user.id,
        reason,
        amountClp: Number(order.total),
      })
    }
  })

  // Encolar anulación DTE si el pedido tenía boleta/factura emitida
  const [voidedOrder] = await db.select({
    dteType: orders.dteType, dteStatus: orders.dteStatus, dteFolio: orders.dteFolio,
  }).from(orders).where(eq(orders.id, id))

  if (
    voidedOrder &&
    (voidedOrder.dteType === 'boleta' || voidedOrder.dteType === 'factura') &&
    voidedOrder.dteStatus === 'issued' &&
    voidedOrder.dteFolio
  ) {
    await db.update(orders)
      .set({ voidSiiStatus: 'pending' })
      .where(eq(orders.id, id))
    c.executionCtx.waitUntil(
      c.env.DTE_QUEUE.send({ orderId: id, type: 'void', attempt: 1 })
        .catch((err: unknown) => console.error('[orders] DTE void queue failed:', err))
    )
  }

  return c.json({ ok: true, orderId: id, number: order.number })
})

// POST /api/orders/public — checkout web sin autenticación (guest + logged-in customers)
const createPublicOrderSchema = z.object({
  deliveryMode:    z.enum(['rappi', 'metro', 'pickup', 'shipping']),
  dteType:         z.enum(['nota_venta', 'boleta', 'factura']).default('nota_venta'),
  customerId:      z.string().uuid().optional(),
  metroStation:    z.string().optional(),
  metroSlot:       z.string().optional(),
  deliveryAddress: z.string().optional(),
  notes:           z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity:  z.number().positive(),
    unitPrice: z.number().int().positive(),
    isBaes:    z.boolean().default(false),
  })),
  payments: z.array(z.object({
    method: z.string(),
    amount: z.number().int().positive(),
  })).optional(),
  receiver: z.object({
    rut:         z.string(),
    razonSocial: z.string(),
    giro:        z.string(),
    direccion:   z.string(),
    comuna:      z.string(),
  }).optional(),
})

router.post('/public', zValidator('json', createPublicOrderSchema), async (c) => {
  const db   = getDb(c.env)
  const body = c.req.valid('json')

  const productIds = [...new Set(body.items.map(i => i.productId))]
  const priceRows  = await db
    .select({
      id:             products.id,
      priceRetail:    products.priceRetail,
      priceWeb:       products.priceWeb,
      discountWebPct: products.discountWebPct,
    })
    .from(products)
    .where(inArray(products.id, productIds))

  const priceMap = new Map(priceRows.map(p => [p.id, p]))

  const resolvedItems = body.items.map(i => {
    const p = priceMap.get(i.productId)
    if (!p) return { ...i, unitPrice: 0 }
    const retail    = Number(p.priceRetail)
    const base      = p.priceWeb ? Number(p.priceWeb) : retail
    const disc      = p.discountWebPct ?? 0
    const unitPrice = disc > 0 ? Math.round(base * (1 - disc / 100)) : base
    return { ...i, unitPrice }
  })

  const subtotal   = resolvedItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const baesAmount = resolvedItems.filter(i => i.isBaes).reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const total      = subtotal - baesAmount

  for (const item of resolvedItems) {
    const [{ available }] = await db.select({
      available: sql<number>`coalesce(sum(${inventory.quantity}), 0)`,
    }).from(inventory).where(and(
      eq(inventory.productId, item.productId),
      sql`${inventory.quantity} > 0`,
    ))
    if (Number(available) < item.quantity) {
      return c.json({ error: 'insufficient_stock', productId: item.productId }, 409)
    }
  }

  const pdfToken     = generatePDFToken()
  const pdfExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  let newOrder: typeof orders.$inferSelect
  try {
    newOrder = await db.transaction(async (tx) => {
      const [{ maxNum }] = await tx.select({
        maxNum: sql<number>`coalesce(max(${orders.number}), 0)`,
      }).from(orders)

      const [order] = await tx.insert(orders).values({
        number:          (maxNum ?? 0) + 1,
        channel:         'web',
        customerId:      body.customerId ?? null,
        deliveryMode:    body.deliveryMode,
        metroStation:    body.metroStation ?? null,
        metroSlot:       body.metroSlot ?? null,
        deliveryAddress: body.deliveryAddress ?? null,
        subtotal:        subtotal.toString(),
        baesAmount:      baesAmount.toString(),
        total:           total.toString(),
        dteType:         body.dteType ?? 'nota_venta',
        dteStatus:       'pending',
        receiverRut:     body.receiver?.rut ?? null,
        receiverName:    body.receiver?.razonSocial ?? null,
        receiverGiro:    body.receiver?.giro ?? null,
        receiverAddress: body.receiver?.direccion ?? null,
        receiverComuna:  body.receiver?.comuna ?? null,
        pdfToken,
        pdfExpiresAt,
        notes:           body.notes ?? null,
      }).returning()

      await tx.insert(orderItems).values(
        resolvedItems.map(i => ({
          orderId:   order.id,
          productId: i.productId,
          quantity:  i.quantity.toString(),
          unitPrice: i.unitPrice.toString(),
          isBaes:    i.isBaes,
          subtotal:  (i.unitPrice * i.quantity).toString(),
        }))
      )

      for (const item of resolvedItems) {
        const lots = await tx.select()
          .from(inventory)
          .where(and(
            eq(inventory.productId, item.productId),
            sql`${inventory.quantity} > 0`,
          ))
          .orderBy(asc(inventory.expiresAt))

        let remaining = Math.round(item.quantity)
        for (const lot of lots) {
          if (remaining <= 0) break
          const take = Math.min(remaining, lot.quantity)
          await tx.update(inventory)
            .set({ quantity: sql`${inventory.quantity} - ${take}` })
            .where(eq(inventory.id, lot.id))
          await tx.insert(inventoryMovements).values({
            productId:   item.productId,
            inventoryId: lot.id,
            type:        'sale',
            quantity:    -take,
            referenceId: order.id,
          })
          remaining -= take
        }
      }

      if (body.payments?.length) {
        await tx.insert(orderPayments).values(
          body.payments.map(p => ({
            orderId: order.id,
            method:  p.method,
            amount:  p.amount.toString(),
          }))
        )
      }

      return order
    })
  } catch (err) {
    console.error('[orders/public] transaction failed:', err)
    return c.json({ error: 'transaction_failed', detail: err instanceof Error ? err.message : String(err) }, 500)
  }

  if (body.deliveryMode !== 'pickup') {
    const needsPaymentAtDoor = body.payments?.some(p => p.method === 'cash' || p.method === 'debit')
    c.executionCtx.waitUntil(
      db.insert(deliveryAssignments).values({
        orderId:         newOrder.id,
        status:          'pending',
        paymentAtDoor:   needsPaymentAtDoor ? 'pending' : 'not_required',
        amountToCollect: needsPaymentAtDoor ? total : 0,
      })
    )
  }

  if (body.customerId && total > 0) {
    const earnPoints = Math.floor(total / 1000)
    if (earnPoints > 0) {
      c.executionCtx.waitUntil(
        db.insert(loyaltyLedger).values({
          customerId: body.customerId,
          orderId:    newOrder.id,
          type:       'earn',
          points:     earnPoints,
          reason:     `Pedido #${newOrder.number}`,
          createdBy:  null,
        })
      )
    }
  }

  try {
    await c.env.DTE_QUEUE.send({ orderId: newOrder.id, attempt: 1 })
  } catch (err) {
    console.error('[orders/public] DTE_QUEUE.send failed:', err)
    await db.update(orders).set({ dteStatus: 'failed', updatedAt: new Date() }).where(eq(orders.id, newOrder.id))
  }

  publishOrderEvent(c.env, {
    type:    'order.created',
    channel: 'web',
    payload: {
      orderId:      newOrder.id,
      number:       newOrder.number,
      channel:      'web',
      total,
      deliveryMode: newOrder.deliveryMode,
      metroStation: newOrder.metroStation ?? undefined,
      metroSlot:    newOrder.metroSlot    ?? undefined,
      notes:        newOrder.notes        ?? undefined,
      itemCount:    body.items.length,
      createdAt:    newOrder.createdAt?.toISOString() ?? new Date().toISOString(),
    },
  })

  c.executionCtx.waitUntil(
    c.env.EMAIL_QUEUE.send({ orderId: newOrder.id, trigger: 'order_created', attempt: 1 })
      .catch((err: unknown) => console.error('[orders/public] EMAIL_QUEUE.send failed:', err))
  )

  return c.json({
    ok:        true,
    orderId:   newOrder.id,
    number:    newOrder.number,
    dteType:   newOrder.dteType,
    dteStatus: newOrder.dteStatus,
    pdfToken,
    total,
  }, 201)
})

export { router as ordersRouter }
