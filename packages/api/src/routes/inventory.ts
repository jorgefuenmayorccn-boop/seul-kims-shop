import { Hono } from 'hono'
import { sql, eq, and, gte, lte, asc, desc, lt } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import { requireAuth } from '../middleware/require-auth'
import type { Bindings } from '../index'
import { inventory, inventoryMovements, products, categories, inventorySummary } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/inventory
// Lista de inventario con semáforo de vencimiento
router.get('/', async (c) => {
  const db = getDb(c.env)
  const now = new Date()
  const in15Days = new Date(now); in15Days.setDate(in15Days.getDate() + 15)
  const in30Days = new Date(now); in30Days.setDate(in30Days.getDate() + 30)

  const { category, expiry, cold_chain, baes } = c.req.query()

  const rows = await db.select({
    id:          inventory.id,
    productId:   inventory.productId,
    productName: products.name,
    sku:         products.sku,
    brand:       products.brand,
    lot:         inventory.lot,
    quantity:    inventory.quantity,
    expiresAt:   inventory.expiresAt,
    location:    inventory.location,
    coldChain:   products.coldChain,
    isBaesEligible: products.isBaesEligible,
    categoryId:  products.categoryId,
    categoryName: categories.name,
  })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(
      category ? eq(products.categoryId, category) : undefined,
      cold_chain ? eq(products.coldChain, cold_chain as 'ambient' | 'refrigerated' | 'frozen') : undefined,
      baes === 'true' ? eq(products.isBaesEligible, true) : undefined,
      expiry === 'urgent' ? and(gte(inventory.expiresAt, now), lte(inventory.expiresAt, in15Days)) : undefined,
      expiry === 'warning' ? and(gte(inventory.expiresAt, in15Days), lte(inventory.expiresAt, in30Days)) : undefined,
      expiry === 'expired' ? lt(inventory.expiresAt, now) : undefined,
      sql`${inventory.quantity} > 0`,
    ))
    .orderBy(asc(inventory.expiresAt))

  // Calcular semáforo por fila
  const withSemaforo = rows.map(row => {
    let expiryStatus: 'fresh' | 'warning' | 'urgent' | 'expired' | null = null
    if (row.expiresAt) {
      const days = Math.floor((new Date(row.expiresAt).getTime() - now.getTime()) / 86400000)
      expiryStatus = days < 0 ? 'expired' : days < 15 ? 'urgent' : days < 30 ? 'warning' : 'fresh'
    }
    return { ...row, expiryStatus }
  })

  return c.json({ items: withSemaforo, total: withSemaforo.length })
})

// GET /api/inventory/availability/:productId (OPTIMIZADO)
// Consulta rápida de disponibilidad usando inventory_summary
router.get('/availability/:productId', async (c) => {
  const db = getDb(c.env)
  const { productId } = c.req.param()

  const [availability] = await db.select({
    productId: inventorySummary.productId,
    qtyTotal: inventorySummary.qtyTotal,
    qtyAvailable: inventorySummary.qtyAvailable,
    qtyReserved: inventorySummary.qtyReserved,
    qtyFrozen: inventorySummary.qtyFrozen,
    updatedAt: inventorySummary.updatedAt,
  })
    .from(inventorySummary)
    .where(eq(inventorySummary.productId, productId))

  if (!availability) {
    return c.json({ qtyTotal: 0, qtyAvailable: 0, qtyReserved: 0, qtyFrozen: 0 })
  }

  return c.json({
    productId: availability.productId,
    qtyTotal: availability.qtyTotal,
    qtyAvailable: availability.qtyAvailable,
    qtyReserved: availability.qtyReserved,
    qtyFrozen: availability.qtyFrozen,
    inStock: availability.qtyAvailable > 0,
    updatedAt: availability.updatedAt,
  })
})

// GET /api/inventory/:productId/movements
// Historial de movimientos de un producto
router.get('/:productId/movements', async (c) => {
  const db = getDb(c.env)
  const { productId } = c.req.param()

  const movements = await db.select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.productId, productId))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(20)

  return c.json({ movements })
})

// POST /api/inventory/adjust
// Ajuste manual de stock
const adjustSchema = z.object({
  productId: z.string().uuid(),
  inventoryId: z.string().uuid().optional(),
  quantity: z.number().int(),
  type: z.enum(['adjustment', 'expired', 'return']),
  notes: z.string().optional(),
})

router.post('/adjust', requireAuth(['owner', 'admin', 'staff']), zValidator('json', adjustSchema), async (c) => {
  const db = getDb(c.env)
  const body = c.req.valid('json')

  await db.insert(inventoryMovements).values({
    productId: body.productId,
    inventoryId: body.inventoryId ?? null,
    type: body.type,
    quantity: body.quantity,
    notes: body.notes ?? null,
  })

  if (body.inventoryId) {
    await db.update(inventory)
      .set({ quantity: sql`${inventory.quantity} + ${body.quantity}` })
      .where(eq(inventory.id, body.inventoryId))
  }

  return c.json({ ok: true })
})

// POST /api/inventory/lot
// Ingreso de nuevo lote
const lotSchema = z.object({
  productId: z.string().uuid(),
  lot: z.string().optional(),
  quantity: z.number().int().positive(),
  expiresAt: z.string().optional(),
  costPerUnit: z.number().int().optional(),
  location: z.enum(['main', 'freezer', 'fridge']).default('main'),
})

router.post('/lot', requireAuth(['owner', 'admin', 'staff']), zValidator('json', lotSchema), async (c) => {
  const db = getDb(c.env)
  const body = c.req.valid('json')

  const [newLot] = await db.insert(inventory).values({
    productId: body.productId,
    lot: body.lot ?? null,
    quantity: body.quantity,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    costPerUnit: body.costPerUnit?.toString() ?? null,
    location: body.location,
  }).returning()

  await db.insert(inventoryMovements).values({
    productId: body.productId,
    inventoryId: newLot.id,
    type: 'purchase',
    quantity: body.quantity,
    notes: body.lot ? `Lote ${body.lot}` : null,
  })

  return c.json({ ok: true, id: newLot.id }, 201)
})

export { router as inventoryRouter }
