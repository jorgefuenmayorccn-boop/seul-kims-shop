import { eq } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { sendEmail, templateOrderCreated, templateOrderDispatched, templateOrderDelivered } from '../lib/send-email'
import { orders, orderItems, products, customers, deliveryAssignments, emailQueueLog } from '@seul/db/schema'
import type { Bindings } from '../index'

type Trigger = 'order_created' | 'order_dispatched' | 'order_delivered'

export async function processEmailMessage(
  orderId: string,
  trigger: Trigger,
  attempt: number,
  env: Bindings,
): Promise<void> {
  const db = getDb(env)

  // Fetch pedido + cliente + ítems + asignación
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  if (!order) return

  // Solo disparar emails para pedidos de delivery (no presenciales en caja)
  const isDelivery = ['rappi', 'delivery', 'shipping'].includes(order.deliveryMode)
  if (trigger === 'order_created' && !isDelivery) {
    await logEmail(db, orderId, trigger, attempt, null, null, 'skipped', null)
    return
  }

  // Resolver email y nombre del destinatario
  let recipientEmail: string | null = order.guestEmail ?? null
  let recipientName: string = order.guestName ?? 'Cliente'

  if (!recipientEmail && order.customerId) {
    const [customer] = await db.select({ email: customers.email, name: customers.name })
      .from(customers).where(eq(customers.id, order.customerId))
    recipientEmail = customer?.email ?? null
    recipientName  = customer?.name ?? recipientName
  }

  if (!recipientEmail) {
    await logEmail(db, orderId, trigger, attempt, null, null, 'skipped', 'Sin email de contacto')
    return
  }

  let subject = ''
  let html    = ''

  if (trigger === 'order_created') {
    const items = await db.select({
      name:      products.name,
      quantity:  orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      subtotal:  orderItems.subtotal,
    }).from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, orderId))

    subject = `Tu pedido #SK-${order.number} esta en preparacion`
    html = templateOrderCreated({
      recipientName,
      orderNumber:     order.number,
      items:           items.map(i => ({ name: i.name, quantity: String(i.quantity), unitPrice: String(i.unitPrice), subtotal: String(i.subtotal) })),
      total:           String(order.total),
      deliveryAddress: order.deliveryAddress ?? null,
    })

  } else if (trigger === 'order_dispatched') {
    const [assignment] = await db.select({
      dispatchType:       deliveryAssignments.dispatchType,
      thirdPartyName:     deliveryAssignments.thirdPartyName,
      thirdPartyTracking: deliveryAssignments.thirdPartyTracking,
    }).from(deliveryAssignments)
      .where(eq(deliveryAssignments.orderId, orderId))
      .orderBy(deliveryAssignments.createdAt)
      .limit(1)

    subject = `Tu pedido #SK-${order.number} va en camino`
    html = templateOrderDispatched({
      recipientName,
      orderNumber:        order.number,
      deliveryAddress:    order.deliveryAddress ?? null,
      dispatchType:       (assignment?.dispatchType ?? 'internal') as 'internal' | 'rappi' | 'other',
      thirdPartyName:     assignment?.thirdPartyName ?? null,
      thirdPartyTracking: assignment?.thirdPartyTracking ?? null,
    })

  } else if (trigger === 'order_delivered') {
    subject = `Tu pedido #SK-${order.number} fue entregado`
    html = templateOrderDelivered({
      recipientName,
      orderNumber: order.number,
      total:       String(order.total),
    })
  }

  if (!html) return

  const result = await sendEmail(env, { to: recipientEmail, subject, html })

  await logEmail(
    db, orderId, trigger, attempt, recipientEmail,
    result.id ?? null,
    result.ok ? 'sent' : 'failed',
    result.error ?? null,
  )

  if (!result.ok) throw new Error(`Resend error: ${result.error}`)
}

async function logEmail(
  db: ReturnType<typeof getDb>,
  orderId: string,
  triggerType: Trigger,
  attempt: number,
  recipientEmail: string | null,
  resendId: string | null,
  status: 'queued' | 'sent' | 'failed' | 'skipped',
  errorDetail: string | null,
) {
  await db.insert(emailQueueLog).values({
    orderId,
    triggerType,
    status,
    attempt,
    recipientEmail,
    resendId,
    errorDetail,
    processedAt: new Date(),
  })
}
