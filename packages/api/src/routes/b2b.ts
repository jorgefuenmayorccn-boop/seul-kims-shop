import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { eq, desc, sql, and } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import { CUSTOMER_COOKIE, validateCustomerSession } from '../lib/customer-auth'
import type { Bindings } from '../index'
import { b2bCompanies, b2bCreditRequests, b2bWalletLedger, customers, orders, orderItems, products } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// Validación de RUT chileno (dígito verificador)
function validarRUT(rut: string): boolean {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return false
  const dv = clean.slice(-1)
  const num = clean.slice(0, -1)
  let sum = 0; let mult = 2
  for (let i = num.length - 1; i >= 0; i--) {
    sum += parseInt(num[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const expected = 11 - (sum % 11)
  const expectedStr = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)
  return dv === expectedStr
}

// POST /api/b2b/registro — solicitud de cuenta mayorista
const registroSchema = z.object({
  // Empresa
  razonSocial: z.string().min(2),
  rut:         z.string().refine(validarRUT, { message: 'RUT inválido — verifica el dígito verificador' }),
  giro:        z.string().min(2),
  address:     z.string().min(5),
  // Contacto
  name:        z.string().min(2),
  email:       z.string().email(),
  phone:       z.string().optional(),
})

router.post('/registro', zValidator('json', registroSchema), async (c) => {
  const db = getDb(c.env)
  const body = c.req.valid('json')

  // Verificar si ya existe empresa con ese RUT
  const existing = await db.select({ id: b2bCompanies.id })
    .from(b2bCompanies)
    .where(eq(b2bCompanies.rut, body.rut))

  if (existing.length > 0) {
    return c.json({ error: 'Ya existe una cuenta asociada a este RUT. Escríbenos al +56936451991.' }, 409)
  }

  // Crear cliente + empresa (capturar duplicados de email o RUT)
  let customer: { id: string }
  try {
    const [row] = await db.insert(customers).values({
      name:  body.name,
      email: body.email,
      phone: body.phone ?? null,
      rut:   body.rut,
    }).returning({ id: customers.id })
    customer = row
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return c.json({ error: 'Este correo o RUT ya está asociado a otra cuenta. Contáctanos al +56936451991.' }, 409)
    }
    throw err
  }

  await db.insert(b2bCompanies).values({
    customerId:  customer.id,
    razonSocial: body.razonSocial,
    rut:         body.rut,
    giro:        body.giro,
    address:     body.address,
    tier:        'hoobae',
    status:      'pending',
    creditLimitClp: 500000,
    paymentDays: 0,
  })

  console.info('[B2B_REGISTRO]', { razonSocial: body.razonSocial, rut: body.rut, email: body.email })

  return c.json({
    ok: true,
    message: 'Solicitud recibida. Te contactaremos por WhatsApp en 24–48 horas hábiles.',
  }, 201)
})

// GET /api/b2b/empresa/me — estado de cuenta del cliente autenticado
router.get('/empresa/me', async (c) => {
  const token = getCookie(c, CUSTOMER_COOKIE)
  if (!token) return c.json({ error: 'No autenticado' }, 401)

  const customer = await validateCustomerSession(c.env, token)
  if (!customer) return c.json({ error: 'Sesión inválida' }, 401)

  const db = getDb(c.env)
  const [empresa] = await db.select({
    id:             b2bCompanies.id,
    razonSocial:    b2bCompanies.razonSocial,
    rut:            b2bCompanies.rut,
    tier:           b2bCompanies.tier,
    status:         b2bCompanies.status,
    creditLimitClp: b2bCompanies.creditLimitClp,
    creditUsedClp:  b2bCompanies.creditUsedClp,
    paymentDays:    b2bCompanies.paymentDays,
    customerId:     b2bCompanies.customerId,
  })
    .from(b2bCompanies)
    .where(eq(b2bCompanies.customerId, customer.id))

  if (!empresa) return c.json({ error: 'Sin cuenta B2B asociada' }, 404)
  if (empresa.status === 'pending')  return c.json({ error: 'Tu solicitud está en revisión. Te avisaremos pronto.' }, 403)
  if (empresa.status === 'rejected') return c.json({ error: 'Tu solicitud fue rechazada. Escríbenos al +56936451991.' }, 403)

  const limit = empresa.creditLimitClp ?? 0
  const used  = empresa.creditUsedClp  ?? 0
  const creditPct = limit > 0 ? Math.round((used / limit) * 100) : 0

  return c.json({ ...empresa, creditPct })
})

// GET /api/b2b/empresa/:rut — estado de cuenta (para login B2B)
router.get('/empresa/:rut', async (c) => {
  const db = getDb(c.env)
  const { rut } = c.req.param()

  const [empresa] = await db.select({
    id:             b2bCompanies.id,
    razonSocial:    b2bCompanies.razonSocial,
    rut:            b2bCompanies.rut,
    tier:           b2bCompanies.tier,
    status:         b2bCompanies.status,
    creditLimitClp: b2bCompanies.creditLimitClp,
    creditUsedClp:  b2bCompanies.creditUsedClp,
    paymentDays:    b2bCompanies.paymentDays,
    customerId:     b2bCompanies.customerId,
  })
    .from(b2bCompanies)
    .where(eq(b2bCompanies.rut, rut.replace(/[^0-9kK]/gi, '').toUpperCase()))

  if (!empresa) return c.json({ error: 'Empresa no encontrada' }, 404)
  if (empresa.status === 'pending') return c.json({ error: 'Tu solicitud está en revisión. Te avisaremos pronto.' }, 403)
  if (empresa.status === 'rejected') return c.json({ error: 'Tu solicitud fue rechazada. Escríbenos al +56936451991.' }, 403)

  const limit = empresa.creditLimitClp ?? 0
  const used  = empresa.creditUsedClp  ?? 0
  const creditPct = limit > 0 ? Math.round((used / limit) * 100) : 0

  return c.json({ ...empresa, creditPct })
})

// GET /api/b2b/catalogo — catálogo mayorista con precio neto
router.get('/catalogo', async (c) => {
  const db = getDb(c.env)
  const { q } = c.req.query()

  const rows = await db.select({
    id:          products.id,
    sku:         products.sku,
    name:        products.name,
    brand:       products.brand,
    priceRetail: products.priceRetail,
    priceB2B:    products.priceB2B,
    coldChain:   products.coldChain,
    isBaesEligible: products.isBaesEligible,
    weightGrams: products.weightGrams,
    stock:       sql<number>`coalesce(sum(inv.quantity), 0)`,
  })
    .from(products)
    .leftJoin(
      sql`inventory inv`,
      sql`inv.product_id = ${products.id} and inv.quantity > 0`,
    )
    .where(and(
      eq(products.status, 'active'),
      q ? sql`${products.name} ilike ${'%' + q + '%'}` : undefined,
    ))
    .groupBy(products.id)

  return c.json({ products: rows, total: rows.length })
})

// POST /api/b2b/pedido — pedido mayorista
const pedidoSchema = z.object({
  empresaId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity:  z.number().int().positive(),
    unitPrice: z.number().int().positive(),
  })).min(1),
  notes: z.string().optional(),
})

router.post('/pedido', zValidator('json', pedidoSchema), async (c) => {
  const db = getDb(c.env)
  const body = c.req.valid('json')

  const [empresa] = await db.select().from(b2bCompanies).where(eq(b2bCompanies.id, body.empresaId))
  if (!empresa || empresa.status !== 'approved') {
    return c.json({ error: 'Cuenta no autorizada' }, 403)
  }

  const subtotal = body.items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const creditDisponible = (empresa.creditLimitClp ?? 0) - (empresa.creditUsedClp ?? 0)

  if ((empresa.paymentDays ?? 0) > 0 && subtotal > creditDisponible) {
    return c.json({
      error: `Cupo de crédito insuficiente. Disponible: $${creditDisponible.toLocaleString('es-CL')}`
    }, 400)
  }

  const [{ maxNum }] = await db.select({ maxNum: sql<number>`coalesce(max(${orders.number}), 0)` }).from(orders)

  const [newOrder] = await db.insert(orders).values({
    number:       (maxNum ?? 0) + 1,
    channel:      'b2b',
    customerId:   empresa.customerId,
    deliveryMode: 'pickup',
    subtotal:     subtotal.toString(),
    baesAmount:   '0',
    total:        subtotal.toString(),
    dteStatus:    'pending',
    pdfToken:     crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    pdfExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  }).returning()

  await db.insert(orderItems).values(
    body.items.map(i => ({
      orderId:   newOrder.id,
      productId: i.productId,
      quantity:  i.quantity.toString(),
      unitPrice: i.unitPrice.toString(),
      isBaes:    false,
      subtotal:  (i.unitPrice * i.quantity).toString(),
    }))
  )

  // Actualizar crédito usado si pago a crédito
  if ((empresa.paymentDays ?? 0) > 0) {
    await db.update(b2bCompanies)
      .set({ creditUsedClp: (empresa.creditUsedClp ?? 0) + subtotal })
      .where(eq(b2bCompanies.id, empresa.id))
  }

  await c.env.DTE_QUEUE.send({ orderId: newOrder.id, attempt: 1 })

  return c.json({ ok: true, orderId: newOrder.id, number: newOrder.number }, 201)
})

// GET /api/b2b/pedidos/:empresaId — historial pedidos B2B
router.get('/pedidos/:empresaId', async (c) => {
  const db = getDb(c.env)
  const { empresaId } = c.req.param()

  const [empresa] = await db.select({ customerId: b2bCompanies.customerId })
    .from(b2bCompanies).where(eq(b2bCompanies.id, empresaId))
  if (!empresa) return c.json({ error: 'No encontrado' }, 404)

  const pedidos = await db.select({
    id:        orders.id,
    number:    orders.number,
    total:     orders.total,
    status:    orders.status,
    dteStatus: orders.dteStatus,
    dteFolio:  orders.dteFolio,
    createdAt: orders.createdAt,
  })
    .from(orders)
    .where(and(eq(orders.customerId, empresa.customerId), eq(orders.channel, 'b2b')))
    .orderBy(desc(orders.createdAt))
    .limit(20)

  return c.json({ pedidos })
})

// PATCH /api/b2b/empresa/:id/tier — cambiar tier (admin, requiere auth)
const tierSchema = z.object({
  tier:           z.enum(['hoobae', 'sunbae', 'hyung']),
  status:         z.enum(['pending', 'approved', 'rejected', 'suspended']).optional(),
  creditLimitClp: z.number().int().optional(),
  paymentDays:    z.number().int().optional(),
})

router.patch('/empresa/:id/tier', requireAuth(['owner', 'admin']), zValidator('json', tierSchema), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()
  const body = c.req.valid('json')

  await db.update(b2bCompanies)
    .set({
      tier: body.tier,
      ...(body.status && { status: body.status }),
      ...(body.creditLimitClp && { creditLimitClp: body.creditLimitClp }),
      ...(body.paymentDays !== undefined && { paymentDays: body.paymentDays }),
      ...(body.status === 'approved' && { approvedAt: new Date() }),
    })
    .where(eq(b2bCompanies.id, id))

  return c.json({ ok: true })
})

// GET /api/b2b/solicitudes — lista de solicitudes de crédito (admin)
router.get('/solicitudes', requireAuth(['owner', 'admin']), async (c) => {
  const db = getDb(c.env)
  const { status } = c.req.query()

  const rows = await db.select({
    id:           b2bCreditRequests.id,
    companyId:    b2bCreditRequests.companyId,
    amountClp:    b2bCreditRequests.amountClp,
    reason:       b2bCreditRequests.reason,
    status:       b2bCreditRequests.status,
    reviewedAt:   b2bCreditRequests.reviewedAt,
    reviewerNote: b2bCreditRequests.reviewerNote,
    createdAt:    b2bCreditRequests.createdAt,
    razonSocial:  b2bCompanies.razonSocial,
    rut:          b2bCompanies.rut,
    tier:         b2bCompanies.tier,
  })
    .from(b2bCreditRequests)
    .innerJoin(b2bCompanies, eq(b2bCompanies.id, b2bCreditRequests.companyId))
    .where(status ? eq(b2bCreditRequests.status, status) : undefined)
    .orderBy(desc(b2bCreditRequests.createdAt))

  return c.json({ solicitudes: rows })
})

// POST /api/b2b/credit-request — empresa solicita crédito
router.post('/credit-request', zValidator('json', z.object({
  companyId: z.string().uuid(),
  amountClp: z.number().int().min(1),
  reason:    z.string().min(10),
})), async (c) => {
  const db   = getDb(c.env)
  const body = c.req.valid('json')

  const [empresa] = await db.select({ id: b2bCompanies.id, status: b2bCompanies.status })
    .from(b2bCompanies).where(eq(b2bCompanies.id, body.companyId))
  if (!empresa || empresa.status !== 'approved') {
    return c.json({ error: 'Cuenta no autorizada' }, 403)
  }

  const [req] = await db.insert(b2bCreditRequests).values({
    companyId: body.companyId,
    amountClp: body.amountClp,
    reason:    body.reason,
    status:    'pending',
  }).returning({ id: b2bCreditRequests.id })

  return c.json({ ok: true, requestId: req.id }, 201)
})

// PATCH /api/b2b/credit-requests/:id/review — aprobar o rechazar solicitud
router.patch('/credit-requests/:id/review', requireAuth(['owner', 'admin']), zValidator('json', z.object({
  status:       z.enum(['approved', 'rejected']),
  reviewerNote: z.string().optional(),
})), async (c) => {
  const db     = getDb(c.env)
  const { id } = c.req.param()
  const user   = c.get('user')
  const body   = c.req.valid('json')

  const [req] = await db.select({
    id:        b2bCreditRequests.id,
    companyId: b2bCreditRequests.companyId,
    amountClp: b2bCreditRequests.amountClp,
    status:    b2bCreditRequests.status,
  }).from(b2bCreditRequests).where(eq(b2bCreditRequests.id, id))

  if (!req) return c.json({ error: 'Solicitud no encontrada' }, 404)
  if (req.status !== 'pending') return c.json({ error: 'Solicitud ya procesada' }, 400)

  await db.update(b2bCreditRequests).set({
    status:       body.status,
    reviewedBy:   user.id,
    reviewedAt:   new Date(),
    reviewerNote: body.reviewerNote ?? null,
    updatedAt:    new Date(),
  }).where(eq(b2bCreditRequests.id, id))

  if (body.status === 'approved') {
    // Acreditar en wallet y registrar en ledger
    const [empresa] = await db.select({ walletBalanceClp: b2bCompanies.walletBalanceClp })
      .from(b2bCompanies).where(eq(b2bCompanies.id, req.companyId))

    const balanceBefore = empresa?.walletBalanceClp ?? 0
    const balanceAfter  = balanceBefore + req.amountClp

    await db.update(b2bCompanies)
      .set({ walletBalanceClp: balanceAfter })
      .where(eq(b2bCompanies.id, req.companyId))

    await db.insert(b2bWalletLedger).values({
      companyId:    req.companyId,
      type:         'credit',
      amountClp:    req.amountClp,
      balanceAfter,
      referenceId:  req.id,
      referenceType: 'credit_request',
      notes:        body.reviewerNote ?? null,
      createdBy:    user.id,
    })
  }

  return c.json({ ok: true })
})

// GET /api/b2b/wallet/:companyId — saldo y movimientos de wallet
router.get('/wallet/:companyId', async (c) => {
  const db           = getDb(c.env)
  const { companyId } = c.req.param()

  const [empresa] = await db.select({
    id:               b2bCompanies.id,
    razonSocial:      b2bCompanies.razonSocial,
    walletBalanceClp: b2bCompanies.walletBalanceClp,
    creditLimitClp:   b2bCompanies.creditLimitClp,
    creditUsedClp:    b2bCompanies.creditUsedClp,
  }).from(b2bCompanies).where(eq(b2bCompanies.id, companyId))

  if (!empresa) return c.json({ error: 'Empresa no encontrada' }, 404)

  const ledger = await db.select().from(b2bWalletLedger)
    .where(eq(b2bWalletLedger.companyId, companyId))
    .orderBy(desc(b2bWalletLedger.createdAt))
    .limit(50)

  return c.json({ empresa, ledger })
})

export { router as b2bRouter }
