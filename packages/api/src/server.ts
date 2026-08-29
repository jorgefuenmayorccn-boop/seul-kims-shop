import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@seul/db/schema'
import { Resend } from 'resend'

const app = new Hono()
const resend = new Resend(process.env.RESEND_API_KEY)

app.use('*', logger())
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
    'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl'],
  credentials: true,
}))

const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost/seul_dev', 
  { ssl: 'require', max: 20, idle_timeout: 30, max_lifetime: 3600 })
const db = drizzle(sql, { schema })

app.get('/', (c) => c.json({
  service: 'SEUL KING OS API', version: '1.0.0',
  env: process.env.NODE_ENV || 'production'
}))

app.get('/health', async (c) => {
  try {
    await sql`SELECT 1`
    return c.json({ ok: true, status: 'healthy', db: 'connected' })
  } catch (error: any) {
    return c.json({ ok: false, status: 'degraded', error: error.message }, 503)
  }
})

app.post('/api/email/send', async (c) => {
  try {
    const { to, subject, html } = await c.req.json()
    if (!to || !subject || !html) return c.json({ error: 'Missing fields' }, 400)

    const response = await resend.emails.send({
      from: 'noreply@seoulshop.cl', to, subject, html,
    })

    return c.json({ ok: true, id: response.data?.id || null })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/products', async (c) => {
  try {
    const products = await db.query.products.findMany()
    return c.json({ ok: true, data: products })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.post('/api/orders', async (c) => {
  try {
    const body = await c.req.json()
    return c.json({ ok: true, orderId: 'pending' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/test', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT || '3000')
console.log(`🚀 SEUL API port ${port}`)

serve({ fetch: app.fetch, port }, async () => {
  try {
    await sql`SELECT 1`
    console.log('✅ Database connected')
  } catch (e) {
    console.error('Database warning:', e)
  }
})
