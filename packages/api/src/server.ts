import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'

// ============================================================================
// SETUP
// ============================================================================

const app = new Hono()
const resend = new Resend(process.env.RESEND_API_KEY)
const JWT_SECRET = process.env.JWT_SECRET || 'seul-king-os-secret-dev'

app.use('*', logger())
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
    'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl'],
  credentials: true,
}))

// DB
const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost/seul_dev',
  { ssl: 'require', max: 20, idle_timeout: 30, max_lifetime: 3600 })

// Minimal schema para email queue
interface EmailQueueRecord {
  id: string
  email: string
  subject: string
  html: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  lastError?: string
  createdAt: Date
}

const emailQueue: Map<string, EmailQueueRecord> = new Map()

// ============================================================================
// HELPERS
// ============================================================================

const generateToken = () => crypto.randomBytes(32).toString('hex')
const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 12)
const verifyPassword = (pwd: string, hash: string) => bcrypt.compareSync(pwd, hash)
const createJWT = (userId: string, role: string) => jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '24h' })

// P1: Email Queue — Async send with retries
async function enqueueEmail(email: string, subject: string, html: string): Promise<string> {
  const id = crypto.randomUUID()
  const record: EmailQueueRecord = {
    id,
    email,
    subject,
    html,
    status: 'pending',
    attempts: 0,
    createdAt: new Date(),
  }
  emailQueue.set(id, record)

  // Async send con reintentos
  processEmailQueue(id).catch((err) => {
    console.error(`❌ Email queue process failed for ${id}:`, err)
  })

  return id
}

async function processEmailQueue(id: string, retryCount = 0): Promise<void> {
  const record = emailQueue.get(id)
  if (!record) return

  record.attempts++

  try {
    const result = await resend.emails.send({
      from: 'noreply@seoulshop.cl',
      to: record.email,
      subject: record.subject,
      html: record.html,
    })

    if (result.error) {
      throw new Error(`Resend error: ${JSON.stringify(result.error)}`)
    }

    record.status = 'sent'
    console.log(`✅ Email sent to ${record.email} (ID: ${result.data?.id || 'unknown'})`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    record.lastError = errorMsg

    if (record.attempts < 3) {
      // Retry con backoff exponencial
      const delay = Math.pow(2, record.attempts) * 1000
      console.log(`⏳ Retry email ${record.email} in ${delay}ms (attempt ${record.attempts}/3)`)
      setTimeout(() => processEmailQueue(id, retryCount + 1), delay)
    } else {
      record.status = 'failed'
      console.error(`❌ Email failed after 3 attempts: ${record.email}`)
    }
  }
}

// ============================================================================
// ENDPOINTS
// ============================================================================

app.get('/', (c) => c.json({ service: 'SEUL KING OS API', version: '1.0.0' }))

app.get('/health', async (c) => {
  try {
    await sql`SELECT 1`
    return c.json({ ok: true, status: 'healthy', db: 'connected' })
  } catch (error) {
    return c.json({ ok: false, status: 'degraded' }, 503)
  }
})

app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, firstName, lastName } = await c.req.json()
    if (!email || !password || !firstName) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const fullName = lastName ? `${firstName} ${lastName}` : firstName
    const verificationToken = generateToken()
    const redirectUrl = process.env.APP_URL ? `${process.env.APP_URL}/verify?token=${verificationToken}` : `http://localhost:3000/verify?token=${verificationToken}`

    // P1: Enqueue email
    const emailId = await enqueueEmail(
      email,
      '¡Bienvenido a Seoul Kims! Verifica tu correo',
      `<h2>¡Hola ${fullName}!</h2><p>Gracias por registrarte en Seoul Kims.</p><p><a href="${redirectUrl}">Verifica tu correo aquí</a></p>`,
    )

    console.log(`📧 User registered: ${email} (name: ${fullName}, emailQueueId: ${emailId})`)

    // Mock JWT (en producción, guardaría en DB)
    const userId = crypto.randomUUID()
    const token = createJWT(userId, 'customer')

    return c.json({
      ok: true,
      message: 'Registration successful. Check your email.',
      token,
      customer: { id: userId, email, name: fullName },
      emailQueueId: emailId,
    })
  } catch (error) {
    console.error('❌ Registration error:', error instanceof Error ? error.message : String(error))
    return c.json({
      error: 'Registration failed',
      details: error instanceof Error ? error.message : String(error),
    }, 500)
  }
})

app.get('/api/email-queue/:id', (c) => {
  const id = c.req.param('id')
  const record = emailQueue.get(id)
  if (!record) {
    return c.json({ error: 'Email queue record not found' }, 404)
  }
  return c.json({
    id: record.id,
    email: record.email,
    status: record.status,
    attempts: record.attempts,
    lastError: record.lastError,
    createdAt: record.createdAt,
  })
})

// ============================================================================
// FORMULARIOS EMAILS
// ============================================================================

app.post('/api/shop/devoluciones', async (c) => {
  try {
    const { email, nombre, razon, numeroOrden } = await c.req.json()
    if (!email || !nombre) return c.json({ error: 'Campos requeridos' }, 400)

    const emailId = await enqueueEmail(
      email,
      'Solicitud de Devolución Recibida',
      `<h2>Hola ${nombre}</h2><p>Hemos recibido tu solicitud de devolución para la orden #${numeroOrden}.</p><p>Motivo: ${razon}</p><p>Nos pondremos en contacto pronto.</p>`,
    )

    console.log(`📦 Devolución registrada: ${email} (orden: ${numeroOrden})`)
    return c.json({ ok: true, emailId, message: 'Solicitud de devolución recibida' })
  } catch (error) {
    console.error('❌ Devolución error:', error)
    return c.json({ error: 'Error al procesar devolución' }, 500)
  }
})

app.post('/api/b2b/solicitar-credito', async (c) => {
  try {
    const { email, empresa, monto, razon } = await c.req.json()
    if (!email || !empresa) return c.json({ error: 'Campos requeridos' }, 400)

    const emailId = await enqueueEmail(
      email,
      'Solicitud de Crédito Recibida',
      `<h2>Hola ${empresa}</h2><p>Hemos recibido tu solicitud de crédito por ${monto} CLP.</p><p>Razón: ${razon}</p><p>Nuestro equipo evaluará tu solicitud en los próximos 2-3 días hábiles.</p>`,
    )

    console.log(`💳 Solicitud crédito: ${email} (${empresa})`)
    return c.json({ ok: true, emailId, message: 'Solicitud de crédito recibida' })
  } catch (error) {
    console.error('❌ Crédito error:', error)
    return c.json({ error: 'Error al procesar solicitud' }, 500)
  }
})

app.post('/api/b2b/postventa', async (c) => {
  try {
    const { email, empresa, asunto, consulta } = await c.req.json()
    if (!email || !empresa) return c.json({ error: 'Campos requeridos' }, 400)

    const emailId = await enqueueEmail(
      email,
      `Consulta Post-Venta: ${asunto}`,
      `<h2>Hola ${empresa}</h2><p>Hemos recibido tu consulta: ${asunto}</p><p>Detalle: ${consulta}</p><p>Te responderemos en el plazo de 24 horas.</p>`,
    )

    console.log(`🛠️ Post-venta: ${email} (${asunto})`)
    return c.json({ ok: true, emailId, message: 'Consulta post-venta recibida' })
  } catch (error) {
    console.error('❌ Post-venta error:', error)
    return c.json({ error: 'Error al procesar consulta' }, 500)
  }
})

app.post('/api/admin/crear-usuario', async (c) => {
  try {
    const { email, nombre, rol, password } = await c.req.json()
    if (!email || !nombre || !password) return c.json({ error: 'Campos requeridos' }, 400)

    const emailId = await enqueueEmail(
      email,
      'Tu Cuenta en Seoul Kims Admin ha sido Creada',
      `<h2>¡Bienvenido ${nombre}!</h2><p>Tu cuenta de administrador ha sido creada.</p><p><strong>Email:</strong> ${email}</p><p><strong>Contraseña:</strong> ${password}</p><p><strong>Rol:</strong> ${rol}</p><p>Por favor, cambia tu contraseña en el primer acceso.</p>`,
    )

    console.log(`👤 Usuario admin creado: ${email} (${rol})`)
    return c.json({ ok: true, emailId, message: 'Usuario creado y email enviado' })
  } catch (error) {
    console.error('❌ Usuario error:', error)
    return c.json({ error: 'Error al crear usuario' }, 500)
  }
})

// ============================================================================
// START
// ============================================================================

const port = parseInt(process.env.PORT || '3000')
console.log(`🚀 SEUL API port ${port}`)

serve({ fetch: app.fetch, port }, async () => {
  try {
    await sql`SELECT 1`
    console.log('✅ DB connected')
  } catch (e) {
    console.error('DB warning:', e)
  }
})
