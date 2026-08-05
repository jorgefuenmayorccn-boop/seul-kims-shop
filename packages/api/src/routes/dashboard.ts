import { Hono } from 'hono'
import { sql, and, gte, lt, lte, eq, desc } from 'drizzle-orm'
import { getDb } from '../lib/db'
import type { Bindings } from '../index'
import {
  orders, orderItems,
  inventory, products,
} from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/dashboard/stats
// KPIs principales del Cerebro OS
router.get('/stats', async (c) => {
  const db = getDb(c.env)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  // 7 días para alertas de vencimiento
  const in7Days = new Date(now)
  in7Days.setDate(in7Days.getDate() + 7)
  const in30Days = new Date(now)
  in30Days.setDate(in30Days.getDate() + 30)

  const [
    ventasHoy,
    ventasAyer,
    pedidosActivos,
    pedidosWebSinDespachar,
    b2bPendientes,
    vencenEstaSemana,
    stockCritico,
    top5Productos,
  ] = await Promise.all([
    // Ventas hoy
    db.select({ total: sql<number>`sum(${orders.total})` })
      .from(orders)
      .where(and(
        gte(orders.createdAt, todayStart),
        sql`${orders.status} != 'cancelada'`,
      ))
      .then(r => Number(r[0]?.total ?? 0)),

    // Ventas ayer (para delta %)
    db.select({ total: sql<number>`sum(${orders.total})` })
      .from(orders)
      .where(and(
        gte(orders.createdAt, yesterdayStart),
        lt(orders.createdAt, todayStart),
        sql`${orders.status} != 'cancelada'`,
      ))
      .then(r => Number(r[0]?.total ?? 0)),

    // Pedidos activos (nueva + preparando + lista)
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.status} in ('nueva', 'preparando', 'lista')`)
      .then(r => Number(r[0]?.count ?? 0)),

    // Pedidos web sin despachar
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(
        eq(orders.channel, 'web'),
        sql`${orders.status} in ('nueva', 'preparando')`,
      ))
      .then(r => Number(r[0]?.count ?? 0)),

    // B2B pedidos pendientes de pago (DTE emitida, no pagada)
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(
        eq(orders.channel, 'b2b'),
        eq(orders.dteStatus, 'issued'),
        sql`${orders.status} = 'entregada'`,
      ))
      .then(r => Number(r[0]?.count ?? 0)),

    // Lotes que vencen en 7 días
    db.select({ count: sql<number>`count(*)` })
      .from(inventory)
      .where(and(
        gte(inventory.expiresAt, now),
        lte(inventory.expiresAt, in7Days),
        sql`${inventory.quantity} > 0`,
      ))
      .then(r => Number(r[0]?.count ?? 0)),

    // SKUs con stock bajo (menos de 5 unidades)
    db.select({ count: sql<number>`count(*)` })
      .from(inventory)
      .where(sql`${inventory.quantity} > 0 and ${inventory.quantity} < 5`)
      .then(r => Number(r[0]?.count ?? 0)),

    // Top 5 productos hoy por unidades vendidas
    db.select({
      productId: orderItems.productId,
      name: products.name,
      units: sql<number>`sum(${orderItems.quantity})`,
      revenue: sql<number>`sum(${orderItems.subtotal})`,
    })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(and(
        gte(orders.createdAt, todayStart),
        sql`${orders.status} != 'cancelada'`,
      ))
      .groupBy(orderItems.productId, products.name)
      .orderBy(desc(sql`sum(${orderItems.subtotal})`))
      .limit(5),
  ])

  const deltaVentas = ventasAyer > 0
    ? ((ventasHoy - ventasAyer) / ventasAyer) * 100
    : null

  const ticketPromedio = pedidosActivos > 0
    ? Math.round(ventasHoy / pedidosActivos)
    : 0

  return c.json({
    ventasHoy,
    ventasAyer,
    deltaVentas: deltaVentas ? Math.round(deltaVentas * 10) / 10 : null,
    ticketPromedio,
    pedidosActivos,
    pedidosWebSinDespachar,
    b2bPendientes,
    vencenEstaSemana,
    stockCritico,
    top5Productos,
    generatedAt: now.toISOString(),
  })
})

// GET /api/dashboard/alerts
// Alertas críticas ordenadas por severidad
router.get('/alerts', async (c) => {
  const db = getDb(c.env)
  const now = new Date()
  const in3Days = new Date(now)
  in3Days.setDate(in3Days.getDate() + 3)
  const in7Days = new Date(now)
  in7Days.setDate(in7Days.getDate() + 7)

  const [vencidos, urgentes, dtesFallidos] = await Promise.all([
    // Productos ya vencidos con stock > 0 — alerta legal
    db.select({
      productId: inventory.productId,
      name: products.name,
      quantity: inventory.quantity,
      expiresAt: inventory.expiresAt,
    })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(and(
        lt(inventory.expiresAt, now),
        sql`${inventory.quantity} > 0`,
      ))
      .limit(10),

    // Productos que vencen en 3 días
    db.select({
      productId: inventory.productId,
      name: products.name,
      quantity: inventory.quantity,
      expiresAt: inventory.expiresAt,
    })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(and(
        gte(inventory.expiresAt, now),
        lte(inventory.expiresAt, in3Days),
        sql`${inventory.quantity} > 0`,
      ))
      .limit(20),

    // Boletas con DTE fallido
    db.select({ id: orders.id, number: orders.number })
      .from(orders)
      .where(eq(orders.dteStatus, 'failed'))
      .limit(5),
  ])

  return c.json({
    vencidos,
    urgentes,
    dtesFallidos,
    hasAlerts: vencidos.length > 0 || dtesFallidos.length > 0,
  })
})

export { router as dashboardRouter }
