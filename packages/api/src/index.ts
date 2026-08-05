import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

export type Bindings = {
  DATABASE_URL:        string
  DTE_API_KEY:         string
  DTE_RUT_EMPRESA:     string
  UPSTASH_REDIS_URL:   string
  UPSTASH_REDIS_TOKEN: string
  SENTRY_DSN:          string
  SESSIONS:   KVNamespace
  CARTS:      KVNamespace
  PDF_BUCKET: R2Bucket
  DTE_QUEUE:  Queue
}

// Routes
import { productsRouter }  from './routes/products'
import { inventoryRouter } from './routes/inventory'
import { dashboardRouter } from './routes/dashboard'
import { ordersRouter }    from './routes/orders'
import { processDTEMessage } from './routes/dte'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use('/api/*', cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',  // POS
    'https://seoulkims.cl',
    'https://www.seoulkims.cl',
    'https://pos.seoulkims.cl',
  ],
  credentials: true,
}))

app.get('/', c => c.json({ service: 'SEUL KING OS API', version: '1.0.0' }))

// Fase 1
app.route('/api/products',  productsRouter)
app.route('/api/inventory', inventoryRouter)
app.route('/api/dashboard', dashboardRouter)

// Fase 2
app.route('/api/orders', ordersRouter)

// Cloudflare Queue consumer — cola DTE (boleta electrónica SII)
// Nunca puede fallar silenciosamente — reintentos x3 con backoff exponencial
export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<{ orderId: string; attempt: number }>, env: Bindings) {
    for (const msg of batch.messages) {
      try {
        await processDTEMessage(msg.body.orderId, msg.body.attempt, env)
        msg.ack()
      } catch {
        msg.retry()
      }
    }
  },
}
