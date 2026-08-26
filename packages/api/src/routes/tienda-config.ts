import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import { tiendaConfig } from '@seul/db/schema'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

const PUBLIC_KEYS = ['bank_name', 'bank_account', 'bank_account_type', 'bank_rut', 'bank_holder', 'metro_station_name', 'whatsapp_number']

// GET /api/tienda-config/public — claves no sensibles (sin autenticación)
router.get('/public', async (c) => {
  const db   = getDb(c.env)
  const rows = await db.select().from(tiendaConfig)
  const config = Object.fromEntries(
    rows.filter(r => PUBLIC_KEYS.includes(r.key)).map(r => [r.key, r.value])
  )
  return c.json({ config })
})

// GET /api/tienda-config — todas las claves (owner/admin)
router.get('/', requireAuth(['owner', 'admin']), async (c) => {
  const db   = getDb(c.env)
  const rows = await db.select().from(tiendaConfig)
  const config = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return c.json({ config })
})

// PUT /api/tienda-config/:key — upsert una clave (owner/admin)
router.put('/:key', requireAuth(['owner', 'admin']), zValidator('json', z.object({
  value: z.string().min(1),
})), async (c) => {
  const db      = getDb(c.env)
  const { key } = c.req.param()
  const { value } = c.req.valid('json')

  await db.insert(tiendaConfig)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: tiendaConfig.key, set: { value, updatedAt: new Date() } })

  return c.json({ ok: true, key, value })
})

export { router as tiendaConfigRouter }
