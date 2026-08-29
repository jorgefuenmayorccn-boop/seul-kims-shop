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
      '🛍️ Solicitud de Devolución - Seoul Kims',
      `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%); padding: 40px 20px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #d7263d; font-size: 28px; margin: 0;">Seoul Kims</h1>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;">Productos Coreanos de Calidad</p>
          </div>

          <div style="background: white; padding: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 20px; margin-top: 0;">¡Hola ${nombre}! 👋</h2>

            <p style="color: #555; line-height: 1.6; font-size: 15px;">
              Hemos recibido tu solicitud de devolución. Nos aseguramos de procesar cada caso con cuidado y profesionalismo.
            </p>

            <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #d7263d; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #333; font-weight: 600;">Detalles de tu solicitud:</p>
              <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">
                <strong>Orden:</strong> #${numeroOrden}<br>
                <strong>Motivo:</strong> ${razon}
              </p>
            </div>

            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Nuestro equipo revisará tu solicitud en las próximas 24-48 horas y se pondrá en contacto contigo para coordinar la devolución.
            </p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                ¿Preguntas? Contáctanos en:<br>
                <strong>📞 +56 32 250 0000 | 📧 soporte@seoulshop.cl</strong>
              </p>
            </div>
          </div>

          <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            © 2026 Seoul Kims. Todos los derechos reservados.
          </p>
        </div>
      `,
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
      '💳 Solicitud de Crédito B2B - Seoul Kims',
      `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%); padding: 40px 20px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #d7263d; font-size: 28px; margin: 0;">Seoul Kims B2B</h1>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;">Portal Mayorista</p>
          </div>

          <div style="background: white; padding: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 20px; margin-top: 0;">Solicitud de Crédito Recibida ✅</h2>

            <p style="color: #555; line-height: 1.6; font-size: 15px;">
              Agradecemos tu confianza en Seoul Kims. Hemos recibido tu solicitud de crédito comercial.
            </p>

            <div style="background: linear-gradient(135deg, #faf3f0 0%, #ffe8e3 100%); padding: 20px; border-left: 4px solid #d7263d; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #d7263d; font-weight: 700; font-size: 16px;">💰 Monto Solicitado</p>
              <p style="margin: 5px 0 0 0; color: #333; font-size: 24px; font-weight: 600;">${monto.toLocaleString()} CLP</p>
            </div>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;"><strong>Empresa:</strong> ${empresa}</p>
              <p style="margin: 0; color: #666; font-size: 13px;"><strong>Razón:</strong> ${razon}</p>
            </div>

            <div style="background: #e8f4f8; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #0099cc;">
              <p style="margin: 0; color: #0066aa; font-weight: 600;">📅 Próximos Pasos</p>
              <p style="margin: 5px 0 0 0; color: #555; font-size: 14px;">
                Nuestro equipo de crédito evaluará tu solicitud en 2-3 días hábiles. Te contactaremos con una respuesta definitiva.
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                <strong>Equipo B2B Seoul Kims</strong><br>
                📞 +56 32 250 0001 | 📧 b2b@seoulshop.cl
              </p>
            </div>
          </div>

          <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            © 2026 Seoul Kims. Tus Productos Coreanos de Confianza.
          </p>
        </div>
      `,
    )

    console.log(`💳 Solicitud crédito: ${email} (${empresa}) - ${monto} CLP`)
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
      `🛠️ Consulta Post-Venta: ${asunto}`,
      `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%); padding: 40px 20px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #d7263d; font-size: 28px; margin: 0;">Seoul Kims Support</h1>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;">Soporte Post-Venta</p>
          </div>

          <div style="background: white; padding: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 20px; margin-top: 0;">Consulta Registrada ✓</h2>

            <p style="color: #555; line-height: 1.6; font-size: 15px;">
              Hola ${empresa}, hemos recibido tu consulta post-venta. Estamos aquí para ayudarte.
            </p>

            <div style="background: #f0f8e8; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #2e7d32; font-weight: 600;">📌 ${asunto}</p>
              <p style="margin: 8px 0 0 0; color: #555; font-size: 14px; line-height: 1.5;">
                ${consulta}
              </p>
            </div>

            <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; border-left: 4px solid #1976d2;">
              <p style="margin: 0; color: #0d47a1; font-weight: 600;">⏱️ Tiempo de Respuesta</p>
              <p style="margin: 5px 0 0 0; color: #1565c0; font-size: 14px;">
                Nuestro equipo te contactará dentro de 24 horas para resolver tu consulta.
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                <strong>Equipo de Soporte Seoul Kims</strong><br>
                📞 +56 32 250 0002 | 📧 postventa@seoulshop.cl
              </p>
            </div>
          </div>

          <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            © 2026 Seoul Kims. Satisfacción del Cliente es Nuestra Prioridad.
          </p>
        </div>
      `,
    )

    console.log(`🛠️ Post-venta: ${email} - "${asunto}"`)
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

    const roleDisplay = rol === 'owner' ? 'SUPER ADMINISTRADOR' : 'CAJERO'

    const emailId = await enqueueEmail(
      email,
      '🔐 Tu Cuenta de Administrador Seoul Kims',
      `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%); padding: 40px 20px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #d7263d; font-size: 28px; margin: 0;">🔐 Seoul Kims Admin</h1>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;">Control Center</p>
          </div>

          <div style="background: white; padding: 30px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #333; font-size: 20px; margin-top: 0;">¡Bienvenido, ${nombre}! 👋</h2>

            <p style="color: #555; line-height: 1.6; font-size: 15px;">
              Tu cuenta de administrador en Seoul Kims ha sido creada exitosamente. A continuación, encontrarás tus credenciales de acceso.
            </p>

            <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe8a8 100%); padding: 20px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 15px 0; color: #856404; font-weight: 700; font-size: 14px;">⚙️ CREDENCIALES DE ACCESO</p>

              <div style="background: white; padding: 12px; border-radius: 3px; margin-bottom: 10px; font-family: 'Courier New', monospace; font-size: 13px;">
                <p style="margin: 0 0 5px 0; color: #333;"><strong>📧 Email:</strong></p>
                <p style="margin: 0 0 10px 0; color: #d7263d; font-weight: 600;">${email}</p>

                <p style="margin: 0 0 5px 0; color: #333;"><strong>🔑 Contraseña:</strong></p>
                <p style="margin: 0 0 10px 0; color: #d7263d; font-weight: 600; letter-spacing: 1px;">${password}</p>

                <p style="margin: 0 0 5px 0; color: #333;"><strong>👥 Rol:</strong></p>
                <p style="margin: 0; color: #2e7d32; font-weight: 600;">${roleDisplay}</p>
              </div>
            </div>

            <div style="background: #f3e5f5; padding: 15px; border-radius: 4px; border-left: 4px solid #9c27b0; margin: 20px 0;">
              <p style="margin: 0; color: #6a1b9a; font-weight: 600;">⚠️ Acciones Importantes</p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #5e35b1; font-size: 14px;">
                <li>Accede a cmr.seoulshop.cl</li>
                <li>Cambia tu contraseña en el primer acceso</li>
                <li>Guarda tus credenciales en un lugar seguro</li>
                <li>No compartas este email con terceros</li>
              </ul>
            </div>

            <div style="background: #e8f5e9; padding: 15px; border-radius: 4px; border-left: 4px solid #4caf50; margin: 20px 0;">
              <p style="margin: 0; color: #2e7d32; font-weight: 600;">✅ Enlace de Acceso</p>
              <p style="margin: 8px 0 0 0; color: #555; font-size: 14px;">
                <a href="https://cmr.seoulshop.cl" style="color: #1976d2; text-decoration: none; font-weight: 600;">🔗 Ir a Seoul Kims Admin</a>
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                <strong>Equipo Administrativo Seoul Kims</strong><br>
                📞 +56 32 250 0000 | 📧 admin@seoulshop.cl
              </p>
            </div>
          </div>

          <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            © 2026 Seoul Kims. Sistema de Gestión Administrativo.
          </p>
        </div>
      `,
    )

    console.log(`👤 Usuario admin creado: ${email} (${roleDisplay})`)
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
