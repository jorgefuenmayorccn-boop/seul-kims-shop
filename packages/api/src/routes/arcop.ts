import { Hono } from 'hono'
import { eq, desc, lte, and } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import type { Bindings } from '../index'
import { arcopRequests, customers } from '@seul/db/schema'
import { sql } from 'drizzle-orm'

const router = new Hono<{ Bindings: Bindings }>()

// Calcula deadline: 15 días hábiles desde hoy
// Hábil = lunes a viernes (no contempla festivos CL v1.0)
function calcDeadline(from = new Date()): Date {
  let days = 0
  const d  = new Date(from)
  while (days < 15) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) days++ // skip sab/dom
  }
  return d
}

// POST /api/arcop — solicitud pública (sin auth)
const createSchema = z.object({
  type:  z.enum(['access', 'rectification', 'deletion', 'portability']),
  email: z.string().email(),
  name:  z.string().min(2),
  notes: z.string().min(10).max(800),
})

router.post('/', zValidator('json', createSchema), async (c) => {
  const db   = getDb(c.env)
  const body = c.req.valid('json')

  // Buscar cliente por email (puede no existir — igualmente se registra)
  const [customer] = await db.select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, body.email))

  const [req] = await db.insert(arcopRequests).values({
    customerId: customer?.id ?? null,
    type:       body.type,
    status:     'pending',
    notes:      `${body.name} <${body.email}>: ${body.notes}`,
    deadline:   calcDeadline(),
  }).returning()

  console.info('[ARCOP_NUEVA]', { id: req.id, type: body.type, email: body.email })

  return c.json({
    ok:       true,
    requestId: req.id,
    deadline:  req.deadline?.toISOString(),
    message:  'Solicitud recibida. Tienes derecho a respuesta en 15 días hábiles (Ley 21.719).',
  }, 201)
})

// GET /api/arcop — listado admin
router.get('/', async (c) => {
  const db = getDb(c.env)

  const rows = await db.select().from(arcopRequests)
    .orderBy(desc(arcopRequests.deadline))
    .limit(100)

  return c.json({ requests: rows })
})

// GET /api/arcop/urgentes — vencen en 3 días hábiles (para dashboard alert)
router.get('/urgentes', async (c) => {
  const db      = getDb(c.env)
  const cutoff  = calcDeadline(new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)) // ~12 días pasados → 3 restantes

  const rows = await db.select({ id: arcopRequests.id, type: arcopRequests.type, deadline: arcopRequests.deadline })
    .from(arcopRequests)
    .where(and(
      eq(arcopRequests.status, 'pending'),
      lte(arcopRequests.deadline, cutoff),
    ))

  return c.json({ urgentes: rows, count: rows.length })
})

// PATCH /api/arcop/:id — admin resuelve
const patchSchema = z.object({
  status: z.enum(['resolved', 'rejected']),
  notes:  z.string().optional(),
})

router.patch('/:id', zValidator('json', patchSchema), async (c) => {
  const db   = getDb(c.env)
  const { id } = c.req.param()
  const body = c.req.valid('json')

  await db.update(arcopRequests)
    .set({
      status:     body.status,
      ...(body.notes && { notes: body.notes }),
      resolvedAt: new Date(),
    })
    .where(eq(arcopRequests.id, id))

  return c.json({ ok: true })
})

export { router as arcopRouter }
