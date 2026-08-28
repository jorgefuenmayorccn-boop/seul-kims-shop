import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

export type Bindings = {
  DATABASE_URL:        string
  PUBLIC_API_URL:      string   // e.g. http://localhost:8787 — para URLs absolutas de imágenes
  APP_URL:             string   // e.g. http://localhost:3000 — web frontend para revalidación
  DTE_API_KEY:         string
  DTE_RUT_EMPRESA:     string
  UPSTASH_REDIS_URL:   string
  UPSTASH_REDIS_TOKEN: string
  SENTRY_DSN:          string
  ANTHROPIC_API_KEY:   string   // Fase 5 — Asistente IA
  RESEND_API_KEY:      string   // Email transaccional
  SESSIONS:   KVNamespace
  CARTS:      KVNamespace
  PDF_BUCKET: R2Bucket
  DTE_QUEUE:   Queue
  EMAIL_QUEUE: Queue
  ORDER_HUB:   DurableObjectNamespace  // Realtime SSE broadcast
}

// Exportar DO para que wrangler lo registre
export { OrderHub } from './durable-objects/order-hub'

// Routes
import { authRouter }      from './routes/auth'
import { productsRouter }  from './routes/products'
import { inventoryRouter } from './routes/inventory'
import { dashboardRouter } from './routes/dashboard'
import { ordersRouter }    from './routes/orders'
import { processDTEMessage, dteRouter } from './routes/dte'
import { dteRetryRouter } from './routes/dte-retry'
import { emailRouter } from './routes/email'
import { processEmailMessage }          from './queue-consumers/email-processor'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use('/api/*', cors({
  origin: [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://www.seoulshop.cl', 'https://shop.seoulshop.cl',
    'https://pos.seoulshop.cl', 'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl',
  ],
  credentials: true,
}))

app.get('/', c => c.json({ service: 'SEUL KING OS API', version: '1.0.0' }))

// Serve product images from R2
app.get('/api/images/:key{.+}', async (c) => {
  const key = c.req.param('key')
  const obj = await c.env.PDF_BUCKET.get(key)
  if (!obj) return c.notFound()
  const contentType = obj.httpMetadata?.contentType ?? 'image/jpeg'
  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

// Auth
app.route('/api/auth', authRouter)

// Configuración tienda
import { tiendaConfigRouter } from './routes/tienda-config'
app.route('/api/tienda-config', tiendaConfigRouter)

// Delivery / Logística
import { deliveryRouter } from './routes/delivery'
app.route('/api/delivery', deliveryRouter)

// Fase 3 — Gestión de turnos y caja (1 Turno : N Cajas)
import { shiftsRouter }      from './routes/shifts'
import { tillSessionsRouter } from './routes/till-sessions'
app.route('/api/shifts',        shiftsRouter)
app.route('/api/till-sessions', tillSessionsRouter)

// Fase 1
app.route('/api/products',  productsRouter)
app.route('/api/inventory', inventoryRouter)
app.route('/api/dashboard', dashboardRouter)

// Fase 2
app.route('/api/orders', ordersRouter)

// Analytics (ventas + PIN guard)
import { analyticsRouter } from './routes/analytics'
app.route('/api/analytics', analyticsRouter)

// Realtime — SSE para POS y futuros canales
import { eventsRouter } from './routes/events'
app.route('/api/events', eventsRouter)

// Fase 6 — PDF boleta pública (token 48h)
app.route('/boleta', dteRouter)
app.route('/api/dte', dteRetryRouter)    // DTE retry queue management
app.route('/api/email', emailRouter)     // Email queue management

// Fase 4 — Portal B2B mayorista
import { b2bRouter } from './routes/b2b'
app.route('/api/b2b', b2bRouter)

// Fase 5 — Devoluciones + ARCOP + Asistente IA
import { returnsRouter } from './routes/returns'
import { arcopRouter }   from './routes/arcop'
import { chatRouter }    from './routes/chat'
app.route('/api/returns', returnsRouter)
app.route('/api/arcop',   arcopRouter)
app.route('/api/chat',    chatRouter)

// Clientes B2C — guest checkout, auth, newsletter, descuentos, FAQ, banners
import { customersRouter }    from './routes/customers'
import { customerAuthRouter } from './routes/customer-auth'
import { newsletterRouter }   from './routes/newsletter'
import { heroBannersRouter }  from './routes/hero-banners'
import { faqRouter }          from './routes/faq'
import { promotionsRouter }   from './routes/promotions'
app.route('/api/customers',    customersRouter)
app.route('/api/customer',     customerAuthRouter)
app.route('/api/newsletter',   newsletterRouter)
app.route('/api/hero-banners', heroBannersRouter)
app.route('/api/faq',          faqRouter)
app.route('/api/promotions',   promotionsRouter)

type DteMessage   = { orderId: string; attempt: number }
type EmailMessage = { orderId: string; trigger: 'order_created' | 'order_dispatched' | 'order_delivered'; attempt: number }

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<DteMessage | EmailMessage>, env: Bindings) {
    for (const msg of batch.messages) {
      try {
        if (batch.queue === 'seul-kims-email') {
          const body = msg.body as EmailMessage
          await processEmailMessage(body.orderId, body.trigger, body.attempt, env)
        } else {
          const body = msg.body as DteMessage
          await processDTEMessage(body.orderId, body.attempt, env)
        }
        msg.ack()
      } catch {
        msg.retry()
      }
    }
  },
}
