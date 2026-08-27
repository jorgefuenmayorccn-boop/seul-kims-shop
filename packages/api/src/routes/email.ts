import { Hono } from 'hono'
import { eq, and, lt, desc } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { emailQueue, emailLog } from '@seul/db/schema'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

// Email templates
const templates = {
  'welcome': {
    subject: '¡Bienvenido a Seoul Kims!',
    html: (data: Record<string, any>) => `
      <h1>Bienvenido, ${data.name || 'Amigo'}</h1>
      <p>Gracias por registrarte en Seoul Kims.</p>
      <p><a href="${data.confirmLink}">Confirmar email</a></p>
    `
  },
  'password-reset': {
    subject: 'Cambiar contraseña - Seoul Kims',
    html: (data: Record<string, any>) => `
      <h1>Cambiar Contraseña</h1>
      <p>Hiciste una solicitud para cambiar tu contraseña.</p>
      <p><a href="${data.resetLink}">Cambiar contraseña</a></p>
      <p>Válido por 1 hora.</p>
    `
  },
  'order-confirmation': {
    subject: (data: Record<string, any>) => `Orden confirmada #${data.orderId}`,
    html: (data: Record<string, any>) => `
      <h1>¡Orden Confirmada!</h1>
      <p>Número de orden: ${data.orderId}</p>
      <p>Total: $${data.total} CLP</p>
      <p><a href="${data.orderLink}">Ver orden</a></p>
    `
  },
  'order-delivered': {
    subject: 'Tu orden ha llegado',
    html: (data: Record<string, any>) => `
      <h1>Orden Entregada</h1>
      <p>Tu orden #${data.orderId} ha sido entregada.</p>
      <p><a href="${data.reviewLink}">Dejar comentario</a></p>
    `
  },
  'delivery-update': {
    subject: 'Actualización de tu entrega',
    html: (data: Record<string, any>) => `
      <h1>Actualización de Entrega</h1>
      <p>Estado: ${data.status}</p>
      <p><a href="${data.trackLink}">Rastrear</a></p>
    `
  },
}

// POST /api/email/enqueue - Encolar un email
const enqueueSchema = z.object({
  email: z.string().email(),
  type: z.enum(['welcome', 'password-reset', 'order-confirmation', 'order-shipped', 'order-delivered', 'delivery-update', 'invoice', 'newsletter', 'contact-form-reply']),
  templateData: z.record(z.any()).optional(),
  customerId: z.string().uuid().optional(),
  scheduledFor: z.string().datetime().optional(),
})

router.post('/enqueue', zValidator('json', enqueueSchema), async (c) => {
  const db = getDb(c.env)
  const body = c.req.valid('json')

  // Obtener template
  const template = templates[body.type as keyof typeof templates]
  if (!template) {
    return c.json({ error: 'Unknown email type' }, 400)
  }

  // Generar subject (puede ser función o string)
  const subject = typeof template.subject === 'function'
    ? template.subject(body.templateData ?? {})
    : template.subject

  // Encolar email
  const [queuedEmail] = await db.insert(emailQueue).values({
    email: body.email,
    type: body.type as any,
    subject,
    templateId: body.type,
    templateData: body.templateData ?? {},
    customerId: body.customerId ?? null,
    scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : new Date(),
  }).returning()

  return c.json({
    ok: true,
    queueId: queuedEmail.id,
    email: body.email,
    type: body.type,
  }, 201)
})

// GET /api/email/queue - Listar emails pendientes
router.get('/queue', async (c) => {
  const db = getDb(c.env)

  const pending = await db.select()
    .from(emailQueue)
    .where(and(
      eq(emailQueue.status, 'pending'),
      lt(emailQueue.scheduledFor, new Date())
    ))
    .orderBy(emailQueue.scheduledFor)
    .limit(10)

  return c.json({ pending, count: pending.length })
})

// POST /api/email/process - Procesar queue (llamado por CRON)
router.post('/process', async (c) => {
  const db = getDb(c.env)

  // Obtener emails para procesar
  const now = new Date()
  const toProcess = await db.select()
    .from(emailQueue)
    .where(and(
      eq(emailQueue.status, 'pending'),
      lt(emailQueue.scheduledFor, now)
    ))
    .limit(10)

  let sent = 0
  let failed = 0

  for (const email of toProcess) {
    try {
      // Simular envío (en producción, usar Resend/SendGrid API)
      const success = Math.random() > 0.1 // 90% éxito

      if (success) {
        // Marcar como enviado
        await db.update(emailQueue)
          .set({
            status: 'sent',
            sentAt: now,
          })
          .where(eq(emailQueue.id, email.id))

        // Guardar en log
        await db.insert(emailLog).values({
          queueId: email.id,
          customerId: email.customerId,
          email: email.email,
          type: email.type,
          subject: email.subject,
          status: 'delivered',
          provider: 'resend',
          sentAt: now,
        })

        sent++
      } else {
        // Reintentar con backoff
        if (email.attempts! < email.maxAttempts!) {
          const backoff = Math.pow(2, email.attempts!) * 60000 // exponential backoff
          const nextRetry = new Date(now.getTime() + backoff)

          await db.update(emailQueue)
            .set({
              attempts: email.attempts! + 1,
              scheduledFor: nextRetry,
              lastError: 'Provider error - retrying',
            })
            .where(eq(emailQueue.id, email.id))
        } else {
          // Max attempts alcanzado
          await db.update(emailQueue)
            .set({
              status: 'failed',
              lastError: 'Max retries exceeded',
            })
            .where(eq(emailQueue.id, email.id))
        }

        failed++
      }
    } catch (error) {
      console.error(`Email processing error:`, error)
      failed++
    }
  }

  return c.json({
    message: 'Email queue processed',
    sent,
    failed,
    attempted: toProcess.length,
  })
})

export { router as emailRouter }
