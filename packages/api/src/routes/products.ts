import { Hono } from 'hono'
import { eq, sql, like, and } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import type { Bindings } from '../index'
import { products, categories, productSellos, inventory } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/products
router.get('/', async (c) => {
  const db = getDb(c.env)
  const { q, category, baes, cold_chain, status } = c.req.query()

  const rows = await db.select({
    id:         products.id,
    sku:        products.sku,
    name:       products.name,
    slug:       products.slug,
    brand:      products.brand,
    priceRetail: products.priceRetail,
    priceB2B:   products.priceB2B,
    isBaesEligible: products.isBaesEligible,
    coldChain:  products.coldChain,
    isWeighable: products.isWeighable,
    status:     products.status,
    imageUrl:   products.imageUrl,
    categoryName: categories.name,
    // stock total agregado
    stockTotal: sql<number>`coalesce(sum(${inventory.quantity}), 0)`,
  })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(inventory, and(
      eq(inventory.productId, products.id),
      sql`${inventory.quantity} > 0`,
    ))
    .where(and(
      q ? like(products.name, `%${q}%`) : undefined,
      category ? eq(products.categoryId, category) : undefined,
      baes === 'true' ? eq(products.isBaesEligible, true) : undefined,
      cold_chain ? eq(products.coldChain, cold_chain as 'ambient' | 'refrigerated' | 'frozen') : undefined,
      status ? eq(products.status, status as 'active' | 'inactive' | 'discontinued') : eq(products.status, 'active'),
    ))
    .groupBy(products.id, categories.name)

  return c.json({ products: rows, total: rows.length })
})

// GET /api/products/:slug
router.get('/:slug', async (c) => {
  const db = getDb(c.env)
  const { slug } = c.req.param()

  const [product] = await db.select()
    .from(products)
    .where(eq(products.slug, slug))

  if (!product) return c.json({ error: 'Product not found' }, 404)

  const [sellos, stock] = await Promise.all([
    db.select().from(productSellos).where(eq(productSellos.productId, product.id)),
    db.select({
      total: sql<number>`sum(${inventory.quantity})`,
      nextExpiry: sql<string>`min(${inventory.expiresAt})`,
    })
      .from(inventory)
      .where(and(
        eq(inventory.productId, product.id),
        sql`${inventory.quantity} > 0`,
      )),
  ])

  return c.json({
    ...product,
    sellos: sellos.map(s => s.sello),
    stockTotal: Number(stock[0]?.total ?? 0),
    nextExpiry: stock[0]?.nextExpiry ?? null,
  })
})

// POST /api/products
const productSchema = z.object({
  sku:        z.string().min(1),
  name:       z.string().min(1),
  nameKo:     z.string().optional(),
  slug:       z.string().min(1),
  description: z.string().optional(),
  brand:      z.string().optional(),
  categoryId: z.string().uuid().optional(),
  priceRetail: z.number().int().positive(),
  priceB2B:   z.number().int().positive().optional(),
  weightGrams: z.number().int().optional(),
  isWeighable: z.boolean().default(false),
  isBaesEligible: z.boolean().default(false),
  coldChain:  z.enum(['ambient', 'refrigerated', 'frozen']).default('ambient'),
  sellos:     z.array(z.enum(['sodio', 'grasas', 'azucares', 'calorias'])).default([]),
})

router.post('/', zValidator('json', productSchema), async (c) => {
  const db = getDb(c.env)
  const body = c.req.valid('json')
  const { sellos, ...productData } = body

  const [newProduct] = await db.insert(products).values({
    ...productData,
    priceRetail: productData.priceRetail.toString(),
    priceB2B: productData.priceB2B?.toString(),
  }).returning()

  if (sellos.length > 0) {
    await db.insert(productSellos).values(
      sellos.map(sello => ({ productId: newProduct.id, sello }))
    )
  }

  return c.json({ ok: true, id: newProduct.id }, 201)
})

// GET /api/products/categories
router.get('/meta/categories', async (c) => {
  const db = getDb(c.env)
  const cats = await db.select().from(categories)
    .orderBy(categories.sortOrder)
  return c.json({ categories: cats })
})

export { router as productsRouter }
