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
  SESSIONS: KVNamespace
  CARTS:    KVNamespace
  PDF_BUCKET: R2Bucket
  DTE_QUEUE: Queue
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use('/api/*', cors({
  origin: [
    'http://localhost:3000',
    'https://seoulkims.cl',
    'https://www.seoulkims.cl',
    'https://pos.seoulkims.cl',
  ],
  credentials: true,
}))

app.get('/', c => c.json({ service: 'SEUL KING OS API', version: '1.0.0' }))

// Routes (se agregan por fase)
// import { productsRouter } from './routes/products'
// import { ordersRouter } from './routes/orders'
// import { inventoryRouter } from './routes/inventory'
// import { dteRouter } from './routes/dte'
// app.route('/api/products', productsRouter)
// app.route('/api/orders', ordersRouter)
// app.route('/api/inventory', inventoryRouter)
// app.route('/api/dte', dteRouter)

export default app
