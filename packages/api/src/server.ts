import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import postgres from 'postgres'
import * as crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'

// ============================================================================
// ENV & CONFIG
// ============================================================================

const RESEND_KEY = process.env.RESEND_API_KEY
if (!RESEND_KEY) throw new Error('RESEND_API_KEY required')

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@seoulshop.cl'
const JWT_SECRET = process.env.JWT_SECRET || 'seul-king-os-secret-dev'

const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost/seul_dev',
  { ssl: 'require', max: 20, idle_timeout: 30, max_lifetime: 3600 })
const resend = new Resend(RESEND_KEY)

// ============================================================================
// EMAIL ENGINE
// ============================================================================

async function enqueueEmail(email: string, subject: string, html: string): Promise<string> {
  try {
    const templateData = { html }
    const [record] = await sql`
      INSERT INTO email_queue (email, type, subject, template_data, status, attempts, max_attempts)
      VALUES (${email}, 'contact-form-reply', ${subject}, ${templateData}, 'pending', 0, 3)
      RETURNING id
    `

    console.log(`📧 Email enqueued: ${email} | ${subject}`)

    // Send async
    setTimeout(() => processEmailQueue(record.id).catch(e => console.error('Queue error:', e)), 100)
    return record.id
  } catch (err) {
    console.error('Enqueue error:', err)
    throw err
  }
}

async function processEmailQueue(queueId: string, retryCount = 0): Promise<void> {
  try {
    const [record] = await sql`SELECT * FROM email_queue WHERE id = ${queueId}`
    if (!record) return

    if (record.attempts >= record.max_attempts) {
      await sql`UPDATE email_queue SET status = 'failed' WHERE id = ${queueId}`
      return
    }

    const updatedAttempts = record.attempts + 1
    await sql`UPDATE email_queue SET attempts = ${updatedAttempts} WHERE id = ${queueId}`

    const htmlContent = typeof record.template_data === 'string'
      ? JSON.parse(record.template_data).html
      : record.template_data?.html

    if (!htmlContent) {
      throw new Error(`No HTML content for email: ${record.id}`)
    }

    const result = await resend.emails.send({
      from: 'Seoul Shop Viña del Mar <noreply@seoulshop.cl>',
      to: record.email,
      subject: record.subject,
      html: htmlContent,
    })

    if (result.error) throw new Error(`Resend: ${JSON.stringify(result.error)}`)

    // Log delivery
    await sql`
      INSERT INTO email_log (queue_id, email, type, subject, status, provider, provider_ref)
      VALUES (${queueId}, ${record.email}, ${record.type}, ${record.subject}, 'delivered', 'resend', ${result.data?.id})
    `

    await sql`UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = ${queueId}`

    console.log(`✅ Email sent: ${record.email}`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const [record] = await sql`SELECT * FROM email_queue WHERE id = ${queueId}`

    if (record && record.attempts < record.max_attempts) {
      const delay = Math.pow(2, record.attempts) * 1000
      console.log(`⏳ Retry ${queueId} in ${delay}ms`)
      setTimeout(() => processEmailQueue(queueId, retryCount + 1), delay)
    } else {
      await sql`UPDATE email_queue SET status = 'failed', last_error = ${errorMsg} WHERE id = ${queueId}`
    }
  }
}

// ============================================================================
// TEMPLATES
// ============================================================================

const templates = {
  orderConfirmation: (order: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">✅ Orden Confirmada #${order.number}</h2>
      <p>Tu orden ha sido registrada. Total: $${Number(order.total).toLocaleString('es-CL')}</p>
      <p>Tu pedido está siendo preparado. Recibirás notificaciones sobre su estado.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop Viña del Mar | +56 32 250 0000</p>
    </div>
  `,
  orderStatus: (order: any, status: string) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">📦 Actualización Orden #${order.number}</h2>
      <p>Tu pedido cambió a: <strong>${status.toUpperCase()}</strong></p>
      <p>Recibirás más actualizaciones pronto.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop Viña del Mar</p>
    </div>
  `,
  quote: (quote: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">📋 Cotización #${quote.number}</h2>
      <p>Tu cotización está lista. Total: $${Number(quote.total).toLocaleString('es-CL')}</p>
      <p>Válida hasta: ${quote.validUntilAt}</p>
      <p>Contacta con nosotros para aceptar o discutir.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop B2B | b2b@seoulshop.cl</p>
    </div>
  `,
  deliveryPhoto: (order: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #4caf50;">✅ Pedido Entregado #${order.number}</h2>
      <p>Tu orden ha sido entregada exitosamente.</p>
      <p>¡Gracias por tu compra!</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop Viña del Mar</p>
    </div>
  `,
  deliveryAssigned: () => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">🚚 Nueva Entrega Asignada</h2>
      <p>Tienes una nueva entrega. Revisá tu aplicación para más detalles.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Sistema de Entregas</p>
    </div>
  `,
}

// ============================================================================
// APP
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

// HEALTH
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
// B2C ENDPOINTS (7 emails)
// ============================================================================

// POST /api/orders
app.post('/api/orders', async (c) => {
  try {
    const { customer_email, customer_name, items, total, delivery_mode } = await c.req.json()
    if (!customer_email || !items || !total) return c.json({ error: 'Missing fields' }, 400)

    const order_number = Math.floor(Math.random() * 100000)
    const [order] = await sql`
      INSERT INTO orders (number, channel, delivery_mode, status, subtotal, total)
      VALUES (${order_number}, 'web', ${delivery_mode || 'delivery'}, 'nueva', ${total}, ${total})
      RETURNING id, number
    `

    // Email confirmación
    await enqueueEmail(
      customer_email,
      `✅ Orden Confirmada #${order.number}`,
      templates.orderConfirmation(order)
    )

    // Email admin
    await enqueueEmail(
      ADMIN_EMAIL,
      `📦 Nueva Orden #${order.number}`,
      `<p>Nueva orden de ${customer_name}. Total: $${total}</p>`
    )

    console.log(`✅ Order created: #${order.number}`)
    return c.json({ ok: true, order_id: order.id, order_number: order.number })
  } catch (err) {
    console.error('Order error:', err)
    return c.json({ error: 'Error creating order' }, 500)
  }
})

// POST /api/orders/:id/status
app.post('/api/orders/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const { status, customer_email } = await c.req.json()
    if (!status) return c.json({ error: 'Missing status' }, 400)

    const [order] = await sql`
      UPDATE orders SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, number
    `

    if (!order) return c.json({ error: 'Order not found' }, 404)

    if (customer_email) {
      await enqueueEmail(
        customer_email,
        `Actualización: Orden #${order.number}`,
        templates.orderStatus(order, status)
      )
    }

    console.log(`✅ Order status: #${order.number} → ${status}`)
    return c.json({ ok: true, status })
  } catch (err) {
    console.error('Status error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/deliveries/:id/photo
app.post('/api/deliveries/:id/photo', async (c) => {
  try {
    const { id } = c.req.param()
    const { customer_email } = await c.req.json()

    const [assignment] = await sql`SELECT * FROM delivery_assignments WHERE id = ${id}`
    if (!assignment) return c.json({ error: 'Delivery not found' }, 404)

    // Save pod
    await sql`
      INSERT INTO delivery_pods (assignment_id, r2_key, captured_at, uploaded_at)
      VALUES (${id}, ${'pods/' + assignment.order_id + '/photo.jpg'}, NOW(), NOW())
    `

    // Update delivery & order
    await sql`UPDATE delivery_assignments SET status = 'delivered', delivered_at = NOW() WHERE id = ${id}`
    const [order] = await sql`UPDATE orders SET status = 'entregada' WHERE id = ${assignment.order_id} RETURNING number`

    if (customer_email) {
      await enqueueEmail(
        customer_email,
        `✅ Entregado: Orden #${order.number}`,
        templates.deliveryPhoto(order)
      )
    }

    console.log(`✅ Delivery completed`)
    return c.json({ ok: true })
  } catch (err) {
    console.error('Photo error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// B2B ENDPOINTS (3 emails)
// ============================================================================

// POST /api/b2b/quotes
app.post('/api/b2b/quotes', async (c) => {
  try {
    const { company_id, buyer_name, buyer_email, items, total, valid_days } = await c.req.json()
    if (!company_id || !buyer_email) return c.json({ error: 'Missing fields' }, 400)

    const quote_number = Math.floor(Math.random() * 100000)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (valid_days || 7))

    await sql`
      INSERT INTO b2b_quotes (number, company_id, buyer_name, buyer_email, status, items, subtotal, total, valid_until_at, sent_at)
      VALUES (${quote_number}, ${company_id}, ${buyer_name}, ${buyer_email}, 'sent', ${JSON.stringify(items)}, ${total}, ${total}, ${validUntil}, NOW())
    `

    await enqueueEmail(
      buyer_email,
      `📋 Cotización #${quote_number}`,
      templates.quote({ number: quote_number, total, validUntilAt: validUntil.toLocaleDateString('es-CL') })
    )

    await enqueueEmail(
      ADMIN_EMAIL,
      `📋 Cotización #${quote_number} enviada`,
      `<p>Cotización enviada a ${buyer_email}</p>`
    )

    console.log(`✅ Quote: #${quote_number}`)
    return c.json({ ok: true, quote_number })
  } catch (err) {
    console.error('Quote error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/b2b/quotes/:id/accept
app.post('/api/b2b/quotes/:id/accept', async (c) => {
  try {
    const { id } = c.req.param()
    const [quote] = await sql`
      UPDATE b2b_quotes SET status = 'accepted', accepted_at = NOW()
      WHERE id = ${id}
      RETURNING number, buyer_email
    `

    if (!quote) return c.json({ error: 'Quote not found' }, 404)

    await enqueueEmail(
      quote.buyer_email,
      `✅ Cotización #${quote.number} Aceptada`,
      `<p>Tu cotización ha sido aceptada. Procederemos con la orden.</p>`
    )

    console.log(`✅ Quote accepted`)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/b2b/quotes/:id/reject
app.post('/api/b2b/quotes/:id/reject', async (c) => {
  try {
    const { id } = c.req.param()
    const { reason } = await c.req.json()
    const [quote] = await sql`
      UPDATE b2b_quotes SET status = 'rejected', rejected_at = NOW(), rejection_reason = ${reason}
      WHERE id = ${id}
      RETURNING number, buyer_name
    `

    if (!quote) return c.json({ error: 'Quote not found' }, 404)

    await enqueueEmail(
      ADMIN_EMAIL,
      `❌ Cotización #${quote.number} Rechazada`,
      `<p>Rechazada por ${quote.buyer_name}. Razón: ${reason || 'No especificada'}</p>`
    )

    console.log(`✅ Quote rejected`)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// DRIVER ENDPOINTS (2 emails)
// ============================================================================

// POST /api/deliveries/assign
app.post('/api/deliveries/assign', async (c) => {
  try {
    const { assignment_id, driver_id, driver_email } = await c.req.json()
    if (!assignment_id || !driver_id) return c.json({ error: 'Missing fields' }, 400)

    await sql`
      UPDATE delivery_assignments
      SET driver_id = ${driver_id}, status = 'assigned', assigned_at = NOW()
      WHERE id = ${assignment_id}
    `

    if (driver_email) {
      await enqueueEmail(
        driver_email,
        `🚚 Nueva Entrega Asignada`,
        templates.deliveryAssigned()
      )
    }

    console.log(`✅ Delivery assigned`)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/deliveries/:id/status
app.post('/api/deliveries/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const { status } = await c.req.json()

    await sql`UPDATE delivery_assignments SET status = ${status} WHERE id = ${id}`
    console.log(`✅ Delivery status: ${status}`)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// LEGACY ENDPOINTS
// ============================================================================

app.get('/api/email-queue/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const [record] = await sql`SELECT * FROM email_queue WHERE id = ${id}`
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json(record)
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, firstName, lastName } = await c.req.json()
    if (!email || !password) return c.json({ error: 'Missing fields' }, 400)

    const fullName = lastName ? `${firstName} ${lastName}` : firstName

    await enqueueEmail(
      ADMIN_EMAIL,
      `✨ Nuevo Usuario: ${fullName}`,
      `<p>Email: ${email}</p>`
    )

    await enqueueEmail(
      email,
      `¡Bienvenido a Seoul Shop!`,
      `<p>¡Hola ${fullName}! Bienvenido.</p>`
    )

    const token = jwt.sign({ userId: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '24h' })
    return c.json({ ok: true, token })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// START
// ============================================================================

const port = parseInt(process.env.PORT || '3000')
console.log(`🚀 SEUL API v1.0 on port ${port}...`)

serve({ fetch: app.fetch, port }, async () => {
  try {
    await sql`SELECT 1`
    console.log('✅ Database connected')
    console.log(`✅ Admin: ${ADMIN_EMAIL}`)
    console.log('🎉 Ready')
  } catch (err) {
    console.error('❌ Startup failed:', err)
    process.exit(1)
  }
})
