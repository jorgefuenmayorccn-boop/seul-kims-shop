import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, desc, or, sql, gte, lte, sum } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import type { Bindings } from '../index'
import { deliveryAssignments, deliveryPods, deliveryLocationPings, deliveryPayouts, orders, customers, users } from '@seul/db/schema'
import { publishOrderEvent } from './events'

const router = new Hono<{ Bindings: Bindings }>()

// ── GET /api/delivery/drivers — repartidores activos (isActive) para el dispatch panel ──

router.get('/drivers', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)

  const drivers = await db.select({
    id:        users.id,
    name:      users.name,
    email:     users.email,
    isActive:  users.isActive,
    activeJobs: sql<number>`count(${deliveryAssignments.id}) filter (where ${deliveryAssignments.status} in ('assigned','accepted','in_transit'))`,
  })
    .from(users)
    .leftJoin(deliveryAssignments, eq(deliveryAssignments.driverId, users.id))
    .where(and(eq(users.role, 'delivery'), eq(users.isActive, true)))
    .groupBy(users.id)
    .orderBy(users.name)

  return c.json({ drivers })
})

// ── GET /api/delivery/assignments — todos (admin/staff) ──────────────────────

router.get('/assignments', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { status, driver_id } = c.req.query()

  const rows = await db.select({
    id:              deliveryAssignments.id,
    orderId:         deliveryAssignments.orderId,
    driverId:        deliveryAssignments.driverId,
    status:          deliveryAssignments.status,
    paymentAtDoor:   deliveryAssignments.paymentAtDoor,
    amountToCollect: deliveryAssignments.amountToCollect,
    routeIndex:      deliveryAssignments.routeIndex,
    notes:           deliveryAssignments.notes,
    assignedAt:      deliveryAssignments.assignedAt,
    deliveredAt:     deliveryAssignments.deliveredAt,
    createdAt:       deliveryAssignments.createdAt,
    orderNumber:     orders.number,
    orderTotal:      orders.total,
    deliveryMode:    orders.deliveryMode,
    deliveryAddress: orders.deliveryAddress,
    metroStation:    orders.metroStation,
    metroSlot:       orders.metroSlot,
    customerName:    customers.name,
    customerPhone:   customers.phone,
  })
    .from(deliveryAssignments)
    .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(
      status    ? eq(deliveryAssignments.status,   status as typeof deliveryAssignments.$inferSelect['status'])  : undefined,
      driver_id ? eq(deliveryAssignments.driverId, driver_id) : undefined,
    ))
    .orderBy(deliveryAssignments.routeIndex, desc(deliveryAssignments.createdAt))

  return c.json({ assignments: rows })
})

// ── GET /api/delivery/assignments/mine — repartidor autenticado ───────────────

router.get('/assignments/mine', requireAuth(['owner', 'admin', 'staff', 'delivery']), async (c) => {
  const db   = getDb(c.env)
  const user = c.get('user')

  const rows = await db.select({
    id:              deliveryAssignments.id,
    orderId:         deliveryAssignments.orderId,
    status:          deliveryAssignments.status,
    paymentAtDoor:   deliveryAssignments.paymentAtDoor,
    amountToCollect: deliveryAssignments.amountToCollect,
    routeIndex:      deliveryAssignments.routeIndex,
    notes:           deliveryAssignments.notes,
    assignedAt:      deliveryAssignments.assignedAt,
    createdAt:       deliveryAssignments.createdAt,
    orderNumber:     orders.number,
    orderTotal:      orders.total,
    deliveryMode:    orders.deliveryMode,
    deliveryAddress: orders.deliveryAddress,
    metroStation:    orders.metroStation,
    metroSlot:       orders.metroSlot,
    customerName:    customers.name,
    customerPhone:   customers.phone,
    guestName:       orders.guestName,
    guestPhone:      orders.guestPhone,
  })
    .from(deliveryAssignments)
    .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(
      eq(deliveryAssignments.driverId, user.id),
      or(
        eq(deliveryAssignments.status, 'assigned'),
        eq(deliveryAssignments.status, 'accepted'),
        eq(deliveryAssignments.status, 'in_transit'),
      ),
    ))
    .orderBy(deliveryAssignments.routeIndex)

  return c.json({ assignments: rows })
})

// ── GET /api/delivery/assignments/:id ────────────────────────────────────────

router.get('/assignments/:id', requireAuth(['owner', 'admin', 'staff', 'delivery']), async (c) => {
  const db     = getDb(c.env)
  const { id } = c.req.param()

  const [row] = await db.select({
    id:              deliveryAssignments.id,
    orderId:         deliveryAssignments.orderId,
    driverId:        deliveryAssignments.driverId,
    status:          deliveryAssignments.status,
    paymentAtDoor:   deliveryAssignments.paymentAtDoor,
    amountToCollect: deliveryAssignments.amountToCollect,
    paymentMethod:   deliveryAssignments.paymentMethod,
    routeIndex:      deliveryAssignments.routeIndex,
    notes:           deliveryAssignments.notes,
    assignedAt:      deliveryAssignments.assignedAt,
    acceptedAt:      deliveryAssignments.acceptedAt,
    pickedUpAt:      deliveryAssignments.pickedUpAt,
    deliveredAt:     deliveryAssignments.deliveredAt,
    failedAt:        deliveryAssignments.failedAt,
    failureReason:   deliveryAssignments.failureReason,
    createdAt:       deliveryAssignments.createdAt,
    orderNumber:     orders.number,
    orderTotal:      orders.total,
    deliveryMode:    orders.deliveryMode,
    deliveryAddress: orders.deliveryAddress,
    metroStation:    orders.metroStation,
    metroSlot:       orders.metroSlot,
    customerName:    customers.name,
    customerPhone:   customers.phone,
  })
    .from(deliveryAssignments)
    .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(eq(deliveryAssignments.id, id))

  if (!row) return c.json({ error: 'Not found' }, 404)

  const pods = await db.select().from(deliveryPods).where(eq(deliveryPods.assignmentId, id))

  return c.json({ assignment: { ...row, pods } })
})

// ── PUT /api/delivery/assignments/:id/assign — asignar repartidor ─────────────

router.put('/assignments/:id/assign', requireAuth(['owner', 'admin', 'staff']), zValidator('json', z.object({
  driverId:    z.string().uuid(),
  routeIndex:  z.number().int().optional(),
  notes:       z.string().optional(),
})), async (c) => {
  const db     = getDb(c.env)
  const { id } = c.req.param()
  const { driverId, routeIndex, notes } = c.req.valid('json')

  const [updated] = await db.update(deliveryAssignments)
    .set({ driverId, routeIndex: routeIndex ?? null, notes: notes ?? null, status: 'assigned', assignedAt: new Date(), updatedAt: new Date() })
    .where(eq(deliveryAssignments.id, id))
    .returning({ id: deliveryAssignments.id })

  if (!updated) return c.json({ error: 'Not found' }, 404)

  // Notificar al repartidor asignado en tiempo real
  const [assignment] = await db.select({
    orderId:         deliveryAssignments.orderId,
    amountToCollect: deliveryAssignments.amountToCollect,
    paymentAtDoor:   deliveryAssignments.paymentAtDoor,
  }).from(deliveryAssignments).where(eq(deliveryAssignments.id, id))

  if (assignment) {
    const [order] = await db.select({
      number:          orders.number,
      total:           orders.total,
      deliveryMode:    orders.deliveryMode,
      deliveryAddress: orders.deliveryAddress,
      metroStation:    orders.metroStation,
      metroSlot:       orders.metroSlot,
      customerName:    customers.name,
      customerPhone:   customers.phone,
      customerAddress: customers.address,
      customerCommune: customers.commune,
    }).from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(eq(orders.id, assignment.orderId))

    if (order) {
      publishOrderEvent(c.env, {
        type:    'order.driver_assigned',
        channel: 'internal',
        payload: {
          assignmentId:    id,
          driverId,
          orderId:         assignment.orderId,
          orderNumber:     order.number,
          total:           order.total,
          deliveryMode:    order.deliveryMode,
          deliveryAddress: order.deliveryAddress ?? order.customerAddress ?? null,
          commune:         order.customerCommune ?? null,
          metroStation:    order.metroStation ?? null,
          metroSlot:       order.metroSlot ?? null,
          customerName:    order.customerName ?? null,
          customerPhone:   order.customerPhone ?? null,
          amountToCollect: assignment.amountToCollect ?? 0,
          paymentAtDoor:   assignment.paymentAtDoor ?? 'not_required',
        },
      })
    }
  }

  return c.json({ ok: true })
})

// ── PUT /api/delivery/assignments/:id/status — avanzar estado ────────────────

const statusTransitions: Record<string, string[]> = {
  pending:    ['assigned', 'accepted'],  // 'accepted' = auto-claim por repartidor
  assigned:   ['accepted', 'failed'],
  accepted:   ['in_transit', 'failed'],
  in_transit: ['delivered', 'failed'],
}

router.put('/assignments/:id/status', requireAuth(['owner', 'admin', 'staff', 'delivery']), zValidator('json', z.object({
  status:        z.enum(['accepted', 'in_transit', 'delivered', 'failed']),
  failureReason: z.string().optional(),
  paymentMethod: z.string().optional(),
  amountCollected: z.number().int().optional(),
})), async (c) => {
  const db     = getDb(c.env)
  const { id } = c.req.param()
  const body   = c.req.valid('json')

  const [assignment] = await db.select({
    status:  deliveryAssignments.status,
    orderId: deliveryAssignments.orderId,
  })
    .from(deliveryAssignments).where(eq(deliveryAssignments.id, id))

  if (!assignment) return c.json({ error: 'Not found' }, 404)

  const allowed = statusTransitions[assignment.status] ?? []
  if (!allowed.includes(body.status)) {
    return c.json({ error: `Transición inválida: ${assignment.status} → ${body.status}` }, 400)
  }

  const user = c.get('user') as { id: string } | undefined
  const now  = new Date()
  const patch: Record<string, unknown> = { status: body.status, updatedAt: now }
  // Auto-asignación: repartidor reclama una entrega sin dueño
  if (body.status === 'accepted' && assignment.status === 'pending' && user?.id) {
    patch.driverId    = user.id
    patch.assignedAt  = now
  }
  if (body.status === 'accepted')   patch.acceptedAt  = now
  if (body.status === 'in_transit') patch.pickedUpAt  = now
  if (body.status === 'delivered')  { patch.deliveredAt = now; patch.paymentAtDoor = body.amountCollected ? 'collected' : 'not_required'; if (body.paymentMethod) patch.paymentMethod = body.paymentMethod }
  if (body.status === 'failed')     { patch.failedAt = now; patch.failureReason = body.failureReason ?? null }

  await db.update(deliveryAssignments).set(patch).where(eq(deliveryAssignments.id, id))

  if (body.status === 'accepted' && assignment.orderId) {
    // Repartidor interno acepta — el pedido va en camino
    publishOrderEvent(c.env, {
      type: 'order.dispatched', channel: 'internal',
      payload: { orderId: assignment.orderId, assignmentId: id, dispatchType: 'internal' },
    })
    c.executionCtx.waitUntil(
      c.env.EMAIL_QUEUE.send({ orderId: assignment.orderId, trigger: 'order_dispatched', attempt: 1 })
    )
  }

  if (body.status === 'delivered' && assignment.orderId) {
    await db.update(orders).set({ status: 'entregada', updatedAt: now }).where(eq(orders.id, assignment.orderId))
    publishOrderEvent(c.env, {
      type: 'order.delivered', channel: 'internal',
      payload: { orderId: assignment.orderId, assignmentId: id },
    })
    c.executionCtx.waitUntil(
      c.env.EMAIL_QUEUE.send({ orderId: assignment.orderId, trigger: 'order_delivered', attempt: 1 })
    )
  }

  return c.json({ ok: true })
})

// ── POST /api/delivery/assignments/:id/pod — foto PoD ────────────────────────

router.post('/assignments/:id/pod', requireAuth(['owner', 'admin', 'staff', 'delivery']), async (c) => {
  const { id } = c.req.param()
  const db     = getDb(c.env)

  const [assignment] = await db.select({ orderId: deliveryAssignments.orderId })
    .from(deliveryAssignments).where(eq(deliveryAssignments.id, id))
  if (!assignment) return c.json({ error: 'Not found' }, 404)

  const formData      = await c.req.formData()
  const file          = formData.get('file') as File | null
  const recipientName = formData.get('recipientName') as string | null
  const recipientRut  = formData.get('recipientRut')  as string | null
  const lat           = formData.get('lat') as string | null
  const lng           = formData.get('lng') as string | null

  if (!file) return c.json({ error: 'No file' }, 400)
  if (file.size > 8 * 1024 * 1024) return c.json({ error: 'Máximo 8MB' }, 400)

  const ext    = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const r2Key  = `pods/${assignment.orderId}/${crypto.randomUUID()}.${ext}`
  const buffer = await file.arrayBuffer()

  await c.env.PDF_BUCKET.put(r2Key, buffer, {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  })

  const [pod] = await db.insert(deliveryPods).values({
    assignmentId:  id,
    r2Key,
    recipientName: recipientName ?? null,
    recipientRut:  recipientRut  ?? null,
    latitude:      lat ? lat : null,
    longitude:     lng ? lng : null,
  }).returning({ id: deliveryPods.id })

  const apiBase = c.env.PUBLIC_API_URL ?? 'http://localhost:8787'
  return c.json({ ok: true, podId: pod.id, url: `${apiBase}/api/images/${r2Key}` }, 201)
})

// ── POST /api/delivery/dispatch-rappi — despacho vía terceros (Rappi) ────────

router.post('/dispatch-rappi', requireAuth(['owner', 'admin', 'staff']), zValidator('json', z.object({
  orderId:            z.string().uuid(),
  thirdPartyName:     z.string().min(2).max(120),
  thirdPartyTracking: z.string().min(1).max(100).optional(),
  amountToCollect:    z.number().int().min(0).optional(),
  paymentAtDoor:      z.enum(['not_required', 'pending']).optional(),
})), async (c) => {
  const db   = getDb(c.env)
  const user = c.get('user')
  const body = c.req.valid('json')
  const now  = new Date()

  // Verificar que el pedido existe y está en estado válido para despachar
  const [order] = await db.select({ id: orders.id, status: orders.status })
    .from(orders).where(eq(orders.id, body.orderId))
  if (!order) return c.json({ error: 'Pedido no encontrado' }, 404)
  if (!['lista', 'preparando', 'nueva'].includes(order.status ?? '')) {
    return c.json({ error: `Estado inválido para despachar: ${order.status}` }, 400)
  }

  // Crear o actualizar la asignación de delivery con datos de Rappi
  const existing = await db.select({ id: deliveryAssignments.id })
    .from(deliveryAssignments).where(eq(deliveryAssignments.orderId, body.orderId)).limit(1)

  if (existing.length > 0) {
    await db.update(deliveryAssignments).set({
      dispatchType:       'rappi',
      thirdPartyName:     body.thirdPartyName,
      thirdPartyTracking: body.thirdPartyTracking ?? null,
      thirdPartySavedAt:  now,
      thirdPartySavedBy:  user.id,
      status:             'in_transit',
      paymentAtDoor:      body.paymentAtDoor ?? 'not_required',
      amountToCollect:    body.amountToCollect ?? 0,
      updatedAt:          now,
    }).where(eq(deliveryAssignments.orderId, body.orderId))
  } else {
    await db.insert(deliveryAssignments).values({
      orderId:            body.orderId,
      dispatchType:       'rappi',
      thirdPartyName:     body.thirdPartyName,
      thirdPartyTracking: body.thirdPartyTracking ?? null,
      thirdPartySavedAt:  now,
      thirdPartySavedBy:  user.id,
      status:             'in_transit',
      paymentAtDoor:      body.paymentAtDoor ?? 'not_required',
      amountToCollect:    body.amountToCollect ?? 0,
    })
  }

  // Avanzar estado del pedido a en_ruta
  await db.update(orders).set({ status: 'en_ruta', updatedAt: now }).where(eq(orders.id, body.orderId))

  // Notificar en tiempo real
  publishOrderEvent(c.env, {
    type:    'order.dispatched',
    channel: 'rappi',
    payload: { orderId: body.orderId, dispatchType: 'rappi', thirdPartyName: body.thirdPartyName, thirdPartyTracking: body.thirdPartyTracking ?? null },
  })

  // Encolar email "Va en camino" (no bloquea la respuesta)
  c.executionCtx.waitUntil(
    c.env.EMAIL_QUEUE.send({ orderId: body.orderId, trigger: 'order_dispatched', attempt: 1 })
  )

  return c.json({ ok: true })
})

// ── POST /api/delivery/location — ping GPS del repartidor ────────────────────

router.post('/location', requireAuth(['owner', 'admin', 'staff', 'delivery']), zValidator('json', z.object({
  assignmentId: z.string().uuid().optional(),
  latitude:     z.number(),
  longitude:    z.number(),
  accuracy:     z.number().int().optional(),
})), async (c) => {
  const db   = getDb(c.env)
  const user = c.get('user')
  const body = c.req.valid('json')

  await db.insert(deliveryLocationPings).values({
    driverId:     user.id,
    assignmentId: body.assignmentId ?? null,
    latitude:     body.latitude.toString(),
    longitude:    body.longitude.toString(),
    accuracy:     body.accuracy ?? null,
  })

  return c.json({ ok: true })
})

// ── GET /api/delivery/drivers/:id/z-report — liquidación del repartidor ─────

router.get('/drivers/:id/z-report', requireAuth(['owner', 'admin', 'staff', 'delivery']), async (c) => {
  const db         = getDb(c.env)
  const { id }     = c.req.param()
  const { from, to } = c.req.query()

  const periodFrom = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000)
  const periodTo   = to   ? new Date(to)   : new Date()

  const assignments = await db.select({
    id:                  deliveryAssignments.id,
    orderId:             deliveryAssignments.orderId,
    status:              deliveryAssignments.status,
    distanciaKm:         deliveryAssignments.distanciaKm,
    tarifaKmClp:         deliveryAssignments.tarifaKmClp,
    montoRepartidorClp:  deliveryAssignments.montoRepartidorClp,
    amountToCollect:     deliveryAssignments.amountToCollect,
    paymentAtDoor:       deliveryAssignments.paymentAtDoor,
    paymentMethod:       deliveryAssignments.paymentMethod,
    deliveredAt:         deliveryAssignments.deliveredAt,
    orderNumber:         orders.number,
    orderTotal:          orders.total,
  })
    .from(deliveryAssignments)
    .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
    .where(and(
      eq(deliveryAssignments.driverId, id),
      eq(deliveryAssignments.status, 'delivered'),
      gte(deliveryAssignments.deliveredAt, periodFrom),
      lte(deliveryAssignments.deliveredAt, periodTo),
    ))
    .orderBy(deliveryAssignments.deliveredAt)

  const [driver] = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users).where(eq(users.id, id))

  if (!driver) return c.json({ error: 'Driver not found' }, 404)

  const totalKm      = assignments.reduce((s, a) => s + parseFloat(a.distanciaKm ?? '0'), 0)
  const grossClp     = assignments.reduce((s, a) => {
    if (a.montoRepartidorClp) return s + a.montoRepartidorClp
    return s + Math.round(parseFloat(a.distanciaKm ?? '0') * (a.tarifaKmClp ?? 1000))
  }, 0)
  const cashCollected = assignments.reduce((s, a) => {
    if (a.paymentAtDoor === 'collected' && a.paymentMethod === 'cash') {
      return s + (a.amountToCollect ?? 0)
    }
    return s
  }, 0)
  // Si cobró más en efectivo que lo que gana → descuenta de su efectivo
  // Si ganó más de lo que cobró → la tienda le paga la diferencia (caja chica)
  const netPayable = grossClp - cashCollected

  return c.json({
    driver,
    periodFrom,
    periodTo,
    deliveriesCount: assignments.length,
    totalKm: Math.round(totalKm * 1000) / 1000,
    grossClp,
    cashCollected,
    netPayable,
    assignments,
  })
})

// ── POST /api/delivery/payouts — registrar liquidación ───────────────────────

router.post('/payouts', requireAuth(['owner', 'admin']), zValidator('json', z.object({
  driverId:        z.string().uuid(),
  shiftId:         z.string().uuid().optional(),
  periodFrom:      z.string(),
  periodTo:        z.string(),
  deliveriesCount: z.number().int(),
  totalKm:         z.number(),
  grossClp:        z.number().int(),
  cashCollected:   z.number().int(),
  netPayable:      z.number().int(),
  notes:           z.string().optional(),
})), async (c) => {
  const db   = getDb(c.env)
  const user = c.get('user')
  const body = c.req.valid('json')

  const [payout] = await db.insert(deliveryPayouts).values({
    driverId:        body.driverId,
    shiftId:         body.shiftId ?? null,
    periodFrom:      new Date(body.periodFrom),
    periodTo:        new Date(body.periodTo),
    deliveriesCount: body.deliveriesCount,
    totalKm:         body.totalKm.toString(),
    grossClp:        body.grossClp,
    cashCollected:   body.cashCollected,
    netPayable:      body.netPayable,
    paidAt:          new Date(),
    paidBy:          user.id,
    notes:           body.notes ?? null,
  }).returning({ id: deliveryPayouts.id })

  return c.json({ ok: true, payoutId: payout.id }, 201)
})

export { router as deliveryRouter }
