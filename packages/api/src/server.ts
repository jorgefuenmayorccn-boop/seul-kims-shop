import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'
import {
  emailQueue, emailLog, orders, deliveryAssignments, deliveryPods,
  b2bQuotes, b2bCompanies, orderItems, products
} from '@seul/db'

// ============================================================================
// ENVIRONMENT & CONFIG
// ============================================================================

const RESEND_KEY = process.env.RESEND_API_KEY
if (!RESEND_KEY) throw new Error('RESEND_API_KEY required')

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@seoulshop.cl'
const CAJERO_EMAIL = process.env.CAJERO_EMAIL || 'cajero.admi@seoulshop.cl'
const JWT_SECRET = process.env.JWT_SECRET || 'seul-king-os-secret-dev'

const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost/seul_dev',
  { ssl: 'require', max: 20, idle_timeout: 30, max_lifetime: 3600 })
const db = drizzle(sql)
const resend = new Resend(RESEND_KEY)

// ============================================================================
// TYPES
// ============================================================================

interface EmailPayload {
  email: string
  subject: string
  html: string
  templateId?: string
  templateData?: Record<string, any>
}

// ============================================================================
// EMAIL ENGINE (DB-backed)
// ============================================================================

async function enqueueEmail(payload: EmailPayload, cc?: string[]): Promise<string> {
  try {
    const [record] = await db.insert(emailQueue).values({
      email: payload.email,
      subject: payload.subject,
      type: (payload.templateId || 'contact-form-reply') as any,
      templateId: payload.templateId,
      templateData: payload.templateData || {},
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
    }).returning({ id: emailQueue.id })

    // Enviar asincronicamente
    processEmailQueue(record.id).catch(err => console.error('Queue process error:', err))

    return record.id
  } catch (err) {
    console.error('Enqueue error:', err)
    throw err
  }
}

async function processEmailQueue(queueId: string, retryCount = 0): Promise<void> {
  try {
    const [record] = await db.select().from(emailQueue).where(eq(emailQueue.id, queueId))
    if (!record) return

    if (record.attempts >= record.maxAttempts) {
      await db.update(emailQueue).set({ status: 'failed' }).where(eq(emailQueue.id, queueId))
      return
    }

    const updatedAttempts = record.attempts + 1
    await db.update(emailQueue).set({ attempts: updatedAttempts }).where(eq(emailQueue.id, queueId))

    const result = await resend.emails.send({
      from: 'Seoul Shop Viña del Mar <noreply@seoulshop.cl>',
      to: record.email,
      subject: record.subject,
      html: record.templateData?.html || '',
    })

    if (result.error) throw new Error(`Resend: ${JSON.stringify(result.error)}`)

    // Guardar en log
    await db.insert(emailLog).values({
      queueId: queueId,
      email: record.email,
      type: record.type,
      subject: record.subject,
      status: 'delivered',
      provider: 'resend',
      providerRef: result.data?.id,
    })

    await db.update(emailQueue).set({
      status: 'sent',
      sentAt: new Date(),
    }).where(eq(emailQueue.id, queueId))

    console.log(`✅ Email sent: ${record.email} (${record.subject})`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const [record] = await db.select().from(emailQueue).where(eq(emailQueue.id, queueId))

    if (record && record.attempts < record.maxAttempts) {
      const delay = Math.pow(2, record.attempts) * 1000
      console.log(`⏳ Retry ${queueId} in ${delay}ms`)
      setTimeout(() => processEmailQueue(queueId, retryCount + 1), delay)
    } else {
      await db.update(emailQueue).set({
        status: 'failed',
        lastError: errorMsg,
      }).where(eq(emailQueue.id, queueId))
      console.error(`❌ Email failed: ${queueId}`)
    }
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function orderConfirmationTemplate(order: any, customer: any): string {
  return `<div style="font-family: 'Segoe UI', Arial; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%); padding: 40px 20px; border-radius: 8px;">
    <div style="background: white; padding: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h2 style="color: #d7263d; font-size: 24px; margin: 0;">¡Orden Confirmada!</h2>
      <p style="color: #555; font-size: 15px; margin: 15px 0;">Gracias por tu compra. Tu orden #${order.number} ha sido registrada.</p>

      <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; font-weight: 600; color: #333;">📋 Detalles de la Orden</p>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">Total: $${parseInt(order.total).toLocaleString('es-CL')}</p>
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 20px;">Tu pedido está siendo preparado. Recibirás notificaciones sobre el estado de tu entrega.</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #888; font-size: 12px; margin: 0;">Seoul Shop Viña del Mar | +56 32 250 0000</p>
      </div>
    </div>
  </div>`
}

function orderStatusTemplate(order: any, status: string): string {
  const statusTexts: Record<string, string> = {
    preparando: '✏️ Tu pedido está siendo preparado en nuestro almacén.',
    lista: '✅ Tu pedido está listo para retirar.',
    en_ruta: '🚚 Tu pedido salió para entrega. El repartidor está en camino.',
    entregada: '📦 Tu pedido ha sido entregado exitosamente.',
  }

  return `<div style="font-family: 'Segoe UI', Arial; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%); padding: 40px 20px; border-radius: 8px;">
    <div style="background: white; padding: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h2 style="color: #d7263d; font-size: 22px; margin: 0;">Actualización de tu Pedido #${order.number}</h2>
      <p style="color: #666; font-size: 15px; margin: 15px 0;">${statusTexts[status] || 'Tu pedido ha sido actualizado.'}</p>

      <div style="background: linear-gradient(135deg, #d7263d15 0%, #d7263d08 100%); padding: 20px; border-left: 4px solid #d7263d; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #333; font-weight: 600;">Estado: ${status.toUpperCase()}</p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #888; font-size: 12px; margin: 0;">Seoul Shop Viña del Mar</p>
      </div>
    </div>
  </div>`
}

function quoteTemplate(quote: any, company: any): string {
  return `<div style="font-family: 'Segoe UI', Arial; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%); padding: 40px 20px; border-radius: 8px;">
    <div style="background: white; padding: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h2 style="color: #d7263d; font-size: 24px; margin: 0;">📋 Cotización #${quote.number}</h2>
      <p style="color: #555; font-size: 15px; margin: 15px 0;">Hola ${quote.buyerName}, Tu cotización está lista.</p>

      <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-weight: 600; color: #333;">Resumen</p>
        <p style="margin: 5px 0; color: #666; font-size: 14px;">Total: $${parseInt(quote.total).toLocaleString('es-CL')}</p>
        <p style="margin: 5px 0; color: #666; font-size: 14px;">Válida hasta: ${quote.validUntilAt}</p>
      </div>

      <p style="color: #666; font-size: 14px;">Contacta con nosotros para aceptar o discutir esta cotización.</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #888; font-size: 12px; margin: 0;">Seoul Shop B2B | b2b@seoulshop.cl</p>
      </div>
    </div>
  </div>`
}

function deliveryPhotoTemplate(order: any, podUrl: string): string {
  return `<div style="font-family: 'Segoe UI', Arial; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%); padding: 40px 20px; border-radius: 8px;">
    <div style="background: white; padding: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h2 style="color: #4caf50; font-size: 24px; margin: 0;">✅ Pedido Entregado</h2>
      <p style="color: #555; font-size: 15px; margin: 15px 0;">Tu orden #${order.number} ha sido entregada exitosamente.</p>

      <div style="background: #e8f5e9; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #4caf50;">
        <p style="margin: 0; color: #2e7d32; font-weight: 600;">Evidencia de Entrega</p>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">Foto tomada en la dirección de entrega</p>
      </div>

      <p style="color: #666; font-size: 14px;">¡Gracias por tu compra! Si tienes dudas, contáctanos.</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #888; font-size: 12px; margin: 0;">Seoul Shop Viña del Mar</p>
      </div>
    </div>
  </div>`
}

// ============================================================================
// APP & ENDPOINTS
// ============================================================================

const app = new Hono()

app.use('*', logger())
app.use('/api/*', cors({
  origin: [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
    'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl',
  ],
  credentials: true,
}))

// HEALTH CHECK
app.get('/', (c) => c.json({ service: 'SEUL KING OS API v1.0' }))
app.get('/health', async (c) => {
  try {
    await sql`SELECT 1`
    return c.json({ ok: true, status: 'healthy', db: 'connected' })
  } catch (e) {
    return c.json({ ok: false, status: 'degraded' }, 503)
  }
})

// ============================================================================
// 1. B2C ORDER LIFECYCLE (3 endpoints)
// ============================================================================

// POST /api/orders — Crear orden → enviar confirmación
app.post('/api/orders', async (c) => {
  try {
    const body = await c.req.json()
    const { customer_email, customer_name, items, total, delivery_mode } = body
    if (!customer_email || !items || !total) return c.json({ error: 'Missing fields' }, 400)

    const [order] = await db.insert(orders).values({
      number: Math.floor(Math.random() * 100000),
      channel: 'web',
      deliveryMode: delivery_mode || 'delivery',
      status: 'nueva',
      subtotal: total,
      total: total,
    }).returning()

    // Agregar items
    for (const item of items) {
      await db.insert(orderItems).values({
        orderId: order.id,
        productId: crypto.randomUUID(),
        quantity: item.qty,
        unitPrice: item.price,
        subtotal: item.qty * item.price,
      })
    }

    // Enviar email confirmación
    await enqueueEmail({
      email: customer_email,
      subject: `✅ Orden Confirmada #${order.number}`,
      templateId: 'order-confirmation',
      templateData: {
        html: orderConfirmationTemplate(order, { name: customer_name }),
      },
    })

    // Notificar admin
    await enqueueEmail({
      email: ADMIN_EMAIL,
      subject: `📦 Nueva Orden #${order.number} - $${total}`,
      templateId: 'order-confirmation',
      templateData: {
        html: `<p>Nueva orden de ${customer_name} (${customer_email}). Total: $${total}</p>`,
      },
    })

    console.log(`✅ Order created: #${order.number}`)
    return c.json({ ok: true, order_id: order.id, order_number: order.number })
  } catch (err) {
    console.error('Order error:', err)
    return c.json({ error: 'Error creating order' }, 500)
  }
})

// POST /api/orders/:id/status — Actualizar estado → enviar notificación
app.post('/api/orders/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const { status, customer_email, customer_name } = await c.req.json()
    if (!status) return c.json({ error: 'Missing status' }, 400)

    const [order] = await db.update(orders)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning()

    if (!order) return c.json({ error: 'Order not found' }, 404)

    // Enviar email con nuevo estado
    if (customer_email) {
      await enqueueEmail({
        email: customer_email,
        subject: `Actualización: Orden #${order.number} - ${status.toUpperCase()}`,
        templateId: 'order-shipped',
        templateData: {
          html: orderStatusTemplate(order, status),
        },
      })
    }

    console.log(`✅ Order status updated: #${order.number} → ${status}`)
    return c.json({ ok: true, status: order.status })
  } catch (err) {
    console.error('Status error:', err)
    return c.json({ error: 'Error updating status' }, 500)
  }
})

// POST /api/deliveries/:id/photo — Subir foto + enviar confirmación
app.post('/api/deliveries/:id/photo', async (c) => {
  try {
    const { id } = c.req.param()
    const { customer_email, photo_url, recipient_name } = await c.req.json()

    const [assignment] = await db.select().from(deliveryAssignments).where(eq(deliveryAssignments.id, id))
    if (!assignment) return c.json({ error: 'Delivery not found' }, 404)

    // Guardar pod (foto de entrega)
    await db.insert(deliveryPods).values({
      assignmentId: id,
      r2Key: `pods/${assignment.orderId}/photo.jpg`,
      recipientName: recipient_name,
      capturedAt: new Date(),
      uploadedAt: new Date(),
    })

    // Actualizar delivery a entregada
    await db.update(deliveryAssignments)
      .set({ status: 'delivered', deliveredAt: new Date() })
      .where(eq(deliveryAssignments.id, id))

    // Actualizar orden a entregada
    await db.update(orders)
      .set({ status: 'entregada', updatedAt: new Date() })
      .where(eq(orders.id, assignment.orderId))

    // Buscar orden para obtener datos
    const [order] = await db.select().from(orders).where(eq(orders.id, assignment.orderId))

    // Enviar email con foto
    if (customer_email) {
      await enqueueEmail({
        email: customer_email,
        subject: `✅ Entregado: Orden #${order.number}`,
        templateId: 'order-delivered',
        templateData: {
          html: deliveryPhotoTemplate(order, photo_url || ''),
        },
      })
    }

    console.log(`✅ Delivery completed with photo`)
    return c.json({ ok: true, pod_id: id })
  } catch (err) {
    console.error('Photo error:', err)
    return c.json({ error: 'Error uploading photo' }, 500)
  }
})

// ============================================================================
// 2. B2B QUOTE WORKFLOW (3 endpoints)
// ============================================================================

// POST /api/b2b/quotes — Crear cotización
app.post('/api/b2b/quotes', async (c) => {
  try {
    const body = await c.req.json()
    const { company_id, buyer_name, buyer_email, items, total, valid_days } = body
    if (!company_id || !buyer_email || !items) return c.json({ error: 'Missing fields' }, 400)

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (valid_days || 7))

    const [quote] = await db.insert(b2bQuotes).values({
      number: Math.floor(Math.random() * 100000),
      companyId: company_id,
      buyerName: buyer_name,
      buyerEmail: buyer_email,
      status: 'sent',
      items: items,
      subtotal: total,
      total: total,
      validUntilAt: validUntil,
      sentAt: new Date(),
    }).returning()

    // Enviar cotización
    await enqueueEmail({
      email: buyer_email,
      subject: `📋 Cotización #${quote.number} - Seoul Shop`,
      templateId: 'order-confirmation',
      templateData: {
        html: quoteTemplate(quote, { name: buyer_name }),
      },
    })

    // Notificar admin
    await enqueueEmail({
      email: ADMIN_EMAIL,
      subject: `📋 Cotización #${quote.number} enviada a ${buyer_name}`,
      templateId: 'order-confirmation',
      templateData: {
        html: `<p>Cotización enviada a ${buyer_email}</p>`,
      },
    })

    console.log(`✅ Quote created: #${quote.number}`)
    return c.json({ ok: true, quote_id: quote.id, quote_number: quote.number })
  } catch (err) {
    console.error('Quote error:', err)
    return c.json({ error: 'Error creating quote' }, 500)
  }
})

// POST /api/b2b/quotes/:id/accept — Aceptar cotización
app.post('/api/b2b/quotes/:id/accept', async (c) => {
  try {
    const { id } = c.req.param()

    const [quote] = await db.update(b2bQuotes)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(b2bQuotes.id, id))
      .returning()

    if (!quote) return c.json({ error: 'Quote not found' }, 404)

    // Notificar aceptación
    await enqueueEmail({
      email: quote.buyerEmail,
      subject: `✅ Cotización #${quote.number} Aceptada`,
      templateId: 'order-confirmation',
      templateData: {
        html: `<p>Tu cotización ha sido aceptada. Procederemos con la orden.</p>`,
      },
    })

    console.log(`✅ Quote accepted: #${quote.number}`)
    return c.json({ ok: true, status: 'accepted' })
  } catch (err) {
    console.error('Accept error:', err)
    return c.json({ error: 'Error accepting quote' }, 500)
  }
})

// POST /api/b2b/quotes/:id/reject — Rechazar cotización
app.post('/api/b2b/quotes/:id/reject', async (c) => {
  try {
    const { id } = c.req.param()
    const { reason } = await c.req.json()

    const [quote] = await db.update(b2bQuotes)
      .set({ status: 'rejected', rejectedAt: new Date(), rejectionReason: reason })
      .where(eq(b2bQuotes.id, id))
      .returning()

    if (!quote) return c.json({ error: 'Quote not found' }, 404)

    // Notificar admin
    await enqueueEmail({
      email: ADMIN_EMAIL,
      subject: `❌ Cotización #${quote.number} Rechazada`,
      templateId: 'order-confirmation',
      templateData: {
        html: `<p>Cotización rechazada por ${quote.buyerName}. Razón: ${reason || 'No especificada'}</p>`,
      },
    })

    console.log(`✅ Quote rejected: #${quote.number}`)
    return c.json({ ok: true, status: 'rejected' })
  } catch (err) {
    console.error('Reject error:', err)
    return c.json({ error: 'Error rejecting quote' }, 500)
  }
})

// ============================================================================
// 3. DRIVER/DELIVERY (2 endpoints)
// ============================================================================

// POST /api/deliveries/assign — Asignar entrega a repartidor
app.post('/api/deliveries/assign', async (c) => {
  try {
    const body = await c.req.json()
    const { assignment_id, driver_id, driver_email } = body
    if (!assignment_id || !driver_id) return c.json({ error: 'Missing fields' }, 400)

    const [assignment] = await db.update(deliveryAssignments)
      .set({ driverId: driver_id, status: 'assigned', assignedAt: new Date() })
      .where(eq(deliveryAssignments.id, assignment_id))
      .returning()

    // Notificar repartidor
    if (driver_email) {
      await enqueueEmail({
        email: driver_email,
        subject: `🚚 Nueva Entrega Asignada`,
        templateId: 'delivery-update',
        templateData: {
          html: `<p>Tienes una nueva entrega. Revisá tu aplicación para más detalles.</p>`,
        },
      })
    }

    console.log(`✅ Delivery assigned to driver`)
    return c.json({ ok: true, assigned_at: assignment.assignedAt })
  } catch (err) {
    console.error('Assign error:', err)
    return c.json({ error: 'Error assigning delivery' }, 500)
  }
})

// POST /api/deliveries/:id/status — Actualizar estado de entrega
app.post('/api/deliveries/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const { status } = await c.req.json()
    if (!status) return c.json({ error: 'Missing status' }, 400)

    const [assignment] = await db.update(deliveryAssignments)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(deliveryAssignments.id, id))
      .returning()

    if (!assignment) return c.json({ error: 'Delivery not found' }, 404)

    console.log(`✅ Delivery status: ${status}`)
    return c.json({ ok: true, status: assignment.status })
  } catch (err) {
    console.error('Status error:', err)
    return c.json({ error: 'Error updating delivery status' }, 500)
  }
})

// ============================================================================
// LEGACY ENDPOINTS (Backward compatibility)
// ============================================================================

// GET /api/email-queue/:id
app.get('/api/email-queue/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const [record] = await db.select().from(emailQueue).where(eq(emailQueue.id, id))
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json(record)
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/auth/register
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, firstName, lastName } = await c.req.json()
    if (!email || !password || !firstName) return c.json({ error: 'Missing fields' }, 400)

    const fullName = lastName ? `${firstName} ${lastName}` : firstName

    // Enviar bienvenida a admin
    await enqueueEmail({
      email: ADMIN_EMAIL,
      subject: '✨ Nuevo Usuario Registrado',
      templateId: 'welcome',
      templateData: {
        html: `<p>Nuevo usuario: ${fullName} (${email})</p>`,
      },
    })

    // Enviar welcome a cliente
    await enqueueEmail({
      email: email,
      subject: '¡Bienvenido a Seoul Shop!',
      templateId: 'welcome',
      templateData: {
        html: `<p>¡Hola ${fullName}! Bienvenido a Seoul Shop Viña del Mar.</p>`,
      },
    })

    const userId = crypto.randomUUID()
    const token = jwt.sign({ userId, role: 'customer' }, JWT_SECRET, { expiresIn: '24h' })

    return c.json({ ok: true, token, customer: { id: userId, email, name: fullName } })
  } catch (err) {
    console.error('Register error:', err)
    return c.json({ error: 'Error registering' }, 500)
  }
})

// ============================================================================
// START SERVER
// ============================================================================

const port = parseInt(process.env.PORT || '3000')
console.log(`🚀 SEUL API v1.0 starting on port ${port}...`)

serve({ fetch: app.fetch, port }, async () => {
  try {
    await sql`SELECT 1`
    console.log('✅ Database connected')
    console.log(`✅ Resend API configured`)
    console.log(`✅ Admin email: ${ADMIN_EMAIL}`)
    console.log(`🎉 API ready for requests`)
  } catch (err) {
    console.error('❌ Startup failed:', err)
    process.exit(1)
  }
})
