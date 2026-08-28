import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, desc, sql, like, or } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import type { Bindings } from '../index'
import { customers, orders, loyaltyLedger } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendWelcomeEmail(env: Bindings, customer: { name: string; email: string; createdChannel: string }) {
  if (!env.RESEND_API_KEY) return
  fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from:    'SEUL SHOP <noreply@seoulshop.cl>',
      to:      ['contact@seoulshop.cl'],
      subject: `Nuevo cliente registrado — ${customer.name}`,
      html:    `<p>Nuevo cliente <strong>${customer.name}</strong> (${customer.email}) se registró vía <b>${customer.createdChannel}</b>.</p>`,
    }),
  }).catch(() => {})
}

// ── GET /api/customers — lista (owner/admin/staff) ───────────────────────────

router.get('/', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { q, limit: limitQ } = c.req.query()
  const take = Math.min(Number(limitQ) || 50, 200)

  const rows = await db.select({
    id:             customers.id,
    name:           customers.name,
    email:          customers.email,
    phone:          customers.phone,
    rut:            customers.rut,
    documentType:   customers.documentType,
    documentNumber: customers.documentNumber,
    createdChannel: customers.createdChannel,
    createdAt:      customers.createdAt,
    lastLoginAt:    customers.lastLoginAt,
    orderCount:     sql<number>`count(distinct ${orders.id})`,
    totalSpent:     sql<number>`coalesce(sum(${orders.total}), 0)`,
    loyaltyBalance: sql<number>`coalesce((
      select sum(ll.points) from loyalty_ledger ll
      where ll.customer_id = ${customers.id}
    ), 0)`,
  })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(
      q ? or(
        like(customers.name,  `%${q}%`),
        like(customers.email, `%${q}%`),
        like(sql`coalesce(${customers.rut}, '')`, `%${q}%`),
      ) : undefined
    )
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt))
    .limit(take)

  return c.json({ customers: rows, total: rows.length })
})

// ── GET /api/customers/search — búsqueda rápida para POS (CRM en caja) ───────
// Devuelve solo campos de contacto, sin joins pesados de loyalty/orders

router.get('/search', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { q } = c.req.query()
  if (!q || q.trim().length < 2) return c.json({ customers: [] })

  const term = `%${q.trim()}%`
  const rows = await db.select({
    id:      customers.id,
    name:    customers.name,
    email:   customers.email,
    phone:   customers.phone,
    address: customers.address,
    commune: customers.commune,
  })
    .from(customers)
    .where(or(
      like(customers.phone,                       term),
      like(customers.name,                        term),
      like(customers.email,                       term),
      like(sql`coalesce(${customers.rut}, '')`,   term),
    ))
    .limit(8)
    .orderBy(customers.name)

  return c.json({ customers: rows })
})

// ── GET /api/customers/:id — perfil completo ─────────────────────────────────

router.get('/:id', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [customer] = await db.select().from(customers).where(eq(customers.id, id))
  if (!customer) return c.json({ error: 'Not found' }, 404)

  const [stats] = await db.select({
    orderCount:  sql<number>`count(*)`,
    totalSpent:  sql<number>`coalesce(sum(${orders.total}), 0)`,
    lastOrderAt: sql<string | null>`max(${orders.createdAt})`,
  }).from(orders).where(eq(orders.customerId, id))

  const [loyalty] = await db.select({
    balance: sql<number>`coalesce(sum(${loyaltyLedger.points}), 0)`,
  }).from(loyaltyLedger).where(eq(loyaltyLedger.customerId, id))

  return c.json({
    customer: {
      ...customer,
      orderCount:     Number(stats?.orderCount ?? 0),
      totalSpent:     Number(stats?.totalSpent  ?? 0),
      lastOrderAt:    stats?.lastOrderAt ?? null,
      loyaltyBalance: Number(loyalty?.balance ?? 0),
    },
  })
})

// ── GET /api/customers/:id/timeline — historial pedidos + loyalty ─���───────────

router.get('/:id/timeline', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [customerRow] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, id))
  if (!customerRow) return c.json({ error: 'Not found' }, 404)

  const [orderRows, ledgerRows] = await Promise.all([
    db.select({
      id:        orders.id,
      number:    orders.number,
      channel:   orders.channel,
      total:     orders.total,
      status:    orders.status,
      dteStatus: orders.dteStatus,
      createdAt: orders.createdAt,
    }).from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt))
      .limit(100),

    db.select({
      id:        loyaltyLedger.id,
      type:      loyaltyLedger.type,
      points:    loyaltyLedger.points,
      reason:    loyaltyLedger.reason,
      orderId:   loyaltyLedger.orderId,
      createdAt: loyaltyLedger.createdAt,
    }).from(loyaltyLedger)
      .where(eq(loyaltyLedger.customerId, id))
      .orderBy(desc(loyaltyLedger.createdAt))
      .limit(100),
  ])

  return c.json({ orders: orderRows, loyalty: ledgerRows })
})

// ── POST /api/customers/guest — upsert checkout guest ─────────��──────────────

const guestSchema = z.object({
  name:  z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
})

router.post('/guest', zValidator('json', guestSchema), async (c) => {
  const db = getDb(c.env)
  const { name, email, phone } = c.req.valid('json')
  const normalizedEmail = email.toLowerCase().trim()

  const [existing] = await db.select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.email, normalizedEmail))

  if (existing) {
    return c.json({ customerId: existing.id, isNew: false })
  }

  const [created] = await db.insert(customers).values({
    name:           name.trim(),
    email:          normalizedEmail,
    phone:          phone?.trim() ?? null,
    createdChannel: 'web',
  }).returning({ id: customers.id })

  // Fire-and-forget welcome email notification
  sendWelcomeEmail(c.env, { name: name.trim(), email: normalizedEmail, createdChannel: 'web' })

  return c.json({ customerId: created.id, isNew: true }, 201)
})

// ── GET /api/customers/search — búsqueda rápida CRM desde POS ────────────────
// Prioriza búsqueda por teléfono (campo más natural en caja)

router.get('/search', requireAuth(['owner', 'admin', 'staff']), async (c) => {
  const db = getDb(c.env)
  const { phone, q } = c.req.query()

  if (!phone && !q) return c.json({ customers: [] })

  const rows = await db.select({
    id:           customers.id,
    name:         customers.name,
    phone:        customers.phone,
    email:        customers.email,
    address:      customers.address,
    commune:      customers.commune,
    addressNotes: customers.addressNotes,
    orderCount:   sql<number>`count(distinct ${orders.id})`,
    lastOrderAt:  sql<string | null>`max(${orders.createdAt})`,
  })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(
      phone
        ? like(sql`coalesce(${customers.phone}, '')`, `%${phone.replace(/\s+/g, '')}%`)
        : or(
            like(customers.name,  `%${q}%`),
            like(sql`coalesce(${customers.phone}, '')`, `%${q}%`),
          )
    )
    .groupBy(customers.id)
    .orderBy(desc(sql`max(${orders.createdAt})`))
    .limit(5)

  return c.json({ customers: rows })
})

// ── POST /api/customers — crear cliente desde POS (staff) ────────────────────

const posCreateSchema = z.object({
  name:         z.string().min(2).max(100),
  phone:        z.string().min(8).max(20),
  email:        z.string().email().optional(),
  address:      z.string().optional(),
  commune:      z.string().optional(),
  addressNotes: z.string().optional(),
})

router.post('/', requireAuth(['owner', 'admin', 'staff']), zValidator('json', posCreateSchema), async (c) => {
  const db   = getDb(c.env)
  const body = c.req.valid('json')

  // Dedup por teléfono — evita duplicados desde el POS
  if (body.phone) {
    const phone = body.phone.replace(/\s+/g, '')
    const [existing] = await db.select({ id: customers.id, name: customers.name, phone: customers.phone, address: customers.address, commune: customers.commune, addressNotes: customers.addressNotes })
      .from(customers)
      .where(like(sql`coalesce(${customers.phone}, '')`, `%${phone}%`))
      .limit(1)
    if (existing) return c.json({ customer: existing, isNew: false })
  }

  const [created] = await db.insert(customers).values({
    name:           body.name.trim(),
    email:          body.email?.toLowerCase().trim() ?? null,
    phone:          body.phone.trim(),
    address:        body.address?.trim() ?? null,
    commune:        body.commune?.trim() ?? null,
    addressNotes:   body.addressNotes?.trim() ?? null,
    createdChannel: 'pos',
  }).returning()

  return c.json({ customer: created, isNew: true }, 201)
})

// ── PUT /api/customers/:id/delivery-info — actualizar dirección desde POS ────

router.put('/:id/delivery-info', requireAuth(['owner', 'admin', 'staff']), zValidator('json', z.object({
  address:      z.string().optional(),
  commune:      z.string().optional(),
  addressNotes: z.string().optional(),
})), async (c) => {
  const db     = getDb(c.env)
  const { id } = c.req.param()
  const body   = c.req.valid('json')

  await db.update(customers)
    .set({ address: body.address ?? null, commune: body.commune ?? null, addressNotes: body.addressNotes ?? null })
    .where(eq(customers.id, id))

  return c.json({ ok: true })
})

export { router as customersRouter }
