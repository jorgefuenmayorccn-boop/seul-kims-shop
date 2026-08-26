import { Hono } from 'hono'
import { eq, and, or, isNull, lte, gte } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { promotions, promotionRedemptions } from '@seul/db/schema'
import type { Bindings } from '../index'

const router = new Hono<{ Bindings: Bindings }>()

// POST /api/promotions/validate — público
router.post('/validate', async (c) => {
  const { code, subtotal = 0, customerId } = await c.req.json<{
    code?: string; subtotal?: number; customerId?: string
  }>()

  if (!code?.trim()) return c.json({ ok: false, error: 'Código requerido' }, 400)

  const db  = getDb(c.env)
  const now = new Date()

  const [promo] = await db.select().from(promotions)
    .where(and(
      eq(promotions.code,   code.trim().toUpperCase()),
      eq(promotions.active, true),
      or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
      or(isNull(promotions.endsAt),   gte(promotions.endsAt, now)),
    ))

  if (!promo) return c.json({ ok: false, error: 'Código de descuento inválido' }, 400)

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return c.json({ ok: false, error: 'Este código ya alcanzó su límite de usos' }, 400)
  }

  if (subtotal < promo.minSubtotal) {
    return c.json({
      ok: false,
      error: `Monto mínimo requerido: $${promo.minSubtotal.toLocaleString('es-CL')}`,
    }, 400)
  }

  // Verificar límite por cliente
  if (customerId && promo.perCustomerLimit > 0) {
    const redemptions = await db.select({ id: promotionRedemptions.id })
      .from(promotionRedemptions)
      .where(and(
        eq(promotionRedemptions.promotionId, promo.id),
        eq(promotionRedemptions.customerId, customerId),
      ))
    if (redemptions.length >= promo.perCustomerLimit) {
      return c.json({ ok: false, error: 'Ya usaste este descuento el máximo de veces permitidas' }, 400)
    }
  }

  // Calcular descuento
  let discountAmount = 0
  if (promo.type === 'percent') {
    discountAmount = Math.floor(subtotal * promo.value / 100)
  } else if (promo.type === 'amount') {
    discountAmount = Math.min(promo.value, subtotal)
  } else if (promo.type === 'free_shipping') {
    discountAmount = 0 // el envío se gestiona en checkout
  }

  return c.json({
    ok: true,
    discount: {
      code:           promo.code,
      type:           promo.type,
      value:          promo.value,
      discountAmount,
      description:    promo.description,
    },
  })
})

export { router as promotionsRouter }
