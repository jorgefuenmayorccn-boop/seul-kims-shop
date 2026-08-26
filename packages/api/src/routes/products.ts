import { Hono } from 'hono'
import { eq, sql, like, and, asc, desc } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../lib/db'
import type { Bindings } from '../index'
import { requireAuth } from '../middleware/require-auth'
import { products, categories, productSellos, productImages, inventory } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// ── Helpers ──────────────────────────────────────────────────────────────────

function imageUrl(env: Bindings, r2Key: string) {
  const base = env.PUBLIC_API_URL ?? 'http://localhost:8787'
  return `${base}/api/images/${r2Key}`
}

// Fire-and-forget — invalida cache de Next.js web app después de mutaciones
function revalidateWebCache(env: Bindings, tag = 'products') {
  const webUrl = env.APP_URL ?? 'http://localhost:3000'
  fetch(`${webUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  }).catch(() => { /* silencioso — web puede no estar corriendo */ })
}

// ── GET /api/products — lista (public + admin) ───────────────────────────────

router.get('/', async (c) => {
  const db = getDb(c.env)
  const { q, category, baes, cold_chain, status } = c.req.query()

  const statusFilter = status === 'all'
    ? undefined
    : status
      ? eq(products.status, status as 'active' | 'inactive' | 'discontinued')
      : eq(products.status, 'active')

  const rows = await db.select({
    id:             products.id,
    sku:            products.sku,
    barcode:        products.barcode,
    name:           products.name,
    nameKo:         products.nameKo,
    slug:           products.slug,
    brand:          products.brand,
    costPrice:      products.costPrice,
    priceRetail:    products.priceRetail,
    priceWeb:       products.priceWeb,
    pricePOS:       products.pricePOS,
    priceB2B:       products.priceB2B,
    discountWebPct: products.discountWebPct,
    discountPOSPct: products.discountPOSPct,
    discountB2BPct: products.discountB2BPct,
    isBaesEligible: products.isBaesEligible,
    coldChain:      products.coldChain,
    isWeighable:    products.isWeighable,
    status:         products.status,
    imageUrl:       products.imageUrl,
    categoryId:     products.categoryId,
    categoryName:   categories.name,
    stockTotal:     sql<number>`coalesce(sum(${inventory.quantity}), 0)`,
  })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(inventory, and(eq(inventory.productId, products.id), sql`${inventory.quantity} > 0`))
    .where(and(
      q ? like(products.name, `%${q}%`) : undefined,
      category ? eq(products.categoryId, category) : undefined,
      baes === 'true' ? eq(products.isBaesEligible, true) : undefined,
      cold_chain ? eq(products.coldChain, cold_chain as 'ambient' | 'refrigerated' | 'frozen') : undefined,
      statusFilter,
    ))
    .groupBy(products.id, categories.id)
    .orderBy(asc(products.name))

  return c.json({ products: rows, total: rows.length })
})

// ── GET /api/products/meta/categories — ANTES de /:slug ─────────────────────

router.get('/meta/categories', async (c) => {
  const db = getDb(c.env)
  const cats = await db.select().from(categories).orderBy(categories.sortOrder)
  return c.json({ categories: cats })
})

// ── GET /api/products/barcode/:code — POS scanner ───────────────────────────

router.get('/barcode/:code', async (c) => {
  const db = getDb(c.env)
  const { code } = c.req.param()

  const [product] = await db.select({
    id:             products.id,
    sku:            products.sku,
    barcode:        products.barcode,
    name:           products.name,
    nameKo:         products.nameKo,
    slug:           products.slug,
    brand:          products.brand,
    priceRetail:    products.priceRetail,
    pricePOS:       products.pricePOS,
    discountPOSPct: products.discountPOSPct,
    isBaesEligible: products.isBaesEligible,
    coldChain:      products.coldChain,
    isWeighable:    products.isWeighable,
    imageUrl:       products.imageUrl,
    stockTotal:     sql<number>`coalesce(sum(${inventory.quantity}), 0)`,
  })
    .from(products)
    .leftJoin(inventory, and(eq(inventory.productId, products.id), sql`${inventory.quantity} > 0`))
    .where(eq(products.barcode, code))
    .groupBy(products.id)

  if (!product) return c.json({ error: 'Barcode not found' }, 404)
  return c.json({ product })
})

// ── GET /api/products/id/:id — por UUID (admin edit) ────────────────────────

router.get('/id/:id', async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()

  const [product] = await db.select().from(products).where(eq(products.id, id))
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const [sellos, images, stock] = await Promise.all([
    db.select().from(productSellos).where(eq(productSellos.productId, id)),
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder)),
    db.select({
      total:      sql<number>`coalesce(sum(${inventory.quantity}), 0)`,
      nextExpiry: sql<string | null>`min(${inventory.expiresAt})`,
    }).from(inventory).where(and(eq(inventory.productId, id), sql`${inventory.quantity} > 0`)),
  ])

  return c.json({
    ...product,
    sellos:     sellos.map(s => s.sello),
    images:     images.map(img => ({ id: img.id, url: imageUrl(c.env, img.r2Key), r2Key: img.r2Key, sortOrder: img.sortOrder })),
    stockTotal: Number(stock[0]?.total ?? 0),
    nextExpiry: stock[0]?.nextExpiry ?? null,
  })
})

// ── POST /api/products — crear ───────────────────────────────────────────────

const productSchema = z.object({
  sku:           z.string().min(1),
  barcode:       z.string().optional(),
  name:          z.string().min(1),
  nameKo:        z.string().optional(),
  slug:          z.string().min(1),
  description:   z.string().optional(),
  brand:         z.string().optional(),
  categoryId:    z.string().uuid().optional(),
  costPrice:     z.number().int().nonnegative().optional(),
  priceRetail:   z.number().int().positive(),
  priceWeb:      z.number().int().positive().optional(),
  pricePOS:      z.number().int().positive().optional(),
  priceB2B:      z.number().int().positive().optional(),
  discountWebPct: z.number().int().min(0).max(100).optional(),
  discountPOSPct: z.number().int().min(0).max(100).optional(),
  discountB2BPct: z.number().int().min(0).max(100).optional(),
  weightGrams:   z.number().int().optional(),
  isWeighable:   z.boolean().default(false),
  isBaesEligible: z.boolean().default(false),
  coldChain:     z.enum(['ambient', 'refrigerated', 'frozen']).default('ambient'),
  sellos:        z.array(z.enum(['sodio', 'grasas', 'azucares', 'calorias'])).default([]),
})

router.post('/', requireAuth(['owner', 'admin']), zValidator('json', productSchema), async (c) => {
  const db = getDb(c.env)
  const body = c.req.valid('json')
  const { sellos, ...productData } = body

  const [newProduct] = await db.insert(products).values({
    ...productData,
    barcode:        productData.barcode        ?? null,
    costPrice:      productData.costPrice      != null ? productData.costPrice.toString()  : null,
    priceRetail:    productData.priceRetail.toString(),
    priceWeb:       productData.priceWeb       != null ? productData.priceWeb.toString()   : null,
    pricePOS:       productData.pricePOS       != null ? productData.pricePOS.toString()   : null,
    priceB2B:       productData.priceB2B       != null ? productData.priceB2B.toString()   : null,
    discountWebPct: productData.discountWebPct ?? 0,
    discountPOSPct: productData.discountPOSPct ?? 0,
    discountB2BPct: productData.discountB2BPct ?? 0,
  }).returning()

  if (sellos.length > 0) {
    await db.insert(productSellos).values(sellos.map(sello => ({ productId: newProduct.id, sello })))
  }

  revalidateWebCache(c.env)
  return c.json({ ok: true, id: newProduct.id }, 201)
})

// ── PUT /api/products/:id — actualizar ──────────────────────────────────────

const updateSchema = productSchema.partial().omit({ sellos: true }).extend({
  sellos: z.array(z.enum(['sodio', 'grasas', 'azucares', 'calorias'])).optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
})

router.put('/:id', requireAuth(['owner', 'admin']), zValidator('json', updateSchema), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()
  const body = c.req.valid('json')
  const { sellos, ...updates } = body

  const setData: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date(),
  }
  if (updates.costPrice   !== undefined) setData.costPrice   = updates.costPrice   != null ? updates.costPrice.toString()   : null
  if (updates.priceRetail !== undefined) setData.priceRetail = updates.priceRetail.toString()
  if (updates.priceWeb    !== undefined) setData.priceWeb    = updates.priceWeb    != null ? updates.priceWeb.toString()    : null
  if (updates.pricePOS    !== undefined) setData.pricePOS    = updates.pricePOS    != null ? updates.pricePOS.toString()    : null
  if (updates.priceB2B    !== undefined) setData.priceB2B    = updates.priceB2B    != null ? updates.priceB2B.toString()    : null

  await db.update(products).set(setData).where(eq(products.id, id))

  if (sellos !== undefined) {
    await db.delete(productSellos).where(eq(productSellos.productId, id))
    if (sellos.length > 0) {
      await db.insert(productSellos).values(sellos.map(sello => ({ productId: id, sello })))
    }
  }

  revalidateWebCache(c.env)
  return c.json({ ok: true })
})

// ── DELETE /api/products/:id — archivar (soft delete) ───────────────────────

router.delete('/:id', requireAuth(['owner', 'admin']), async (c) => {
  const db = getDb(c.env)
  const { id } = c.req.param()
  await db.update(products).set({ status: 'discontinued', updatedAt: new Date() }).where(eq(products.id, id))
  return c.json({ ok: true })
})

// ── POST /api/products/:id/images — subir imagen a R2 ───────────────────────

router.post('/:id/images', requireAuth(['owner', 'admin']), async (c) => {
  const { id } = c.req.param()

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'No file provided' }, 400)

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext)) {
    return c.json({ error: 'Formato no soportado. Usar JPG, PNG o WebP.' }, 400)
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'Imagen demasiado grande. Máximo 5MB.' }, 400)
  }

  const db = getDb(c.env)

  // Max sort order for this product
  const [{ maxSort }] = await db.select({ maxSort: sql<number>`coalesce(max(${productImages.sortOrder}), -1)` })
    .from(productImages).where(eq(productImages.productId, id))

  const r2Key = `products/${id}/${crypto.randomUUID()}.${ext}`
  await c.env.PDF_BUCKET.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || `image/${ext}` },
  })

  const [img] = await db.insert(productImages).values({
    productId: id,
    r2Key,
    sortOrder: (maxSort ?? -1) + 1,
  }).returning()

  // Update cover imageUrl if this is the first image
  const [existing] = await db.select({ imageUrl: products.imageUrl }).from(products).where(eq(products.id, id))
  if (!existing?.imageUrl) {
    await db.update(products).set({ imageUrl: imageUrl(c.env, r2Key) }).where(eq(products.id, id))
  }

  revalidateWebCache(c.env)
  return c.json({ ok: true, id: img.id, url: imageUrl(c.env, r2Key) }, 201)
})

// ── DELETE /api/products/:id/images/:imageId — eliminar imagen ───────────────

router.delete('/:id/images/:imageId', requireAuth(['owner', 'admin']), async (c) => {
  const db = getDb(c.env)
  const { id, imageId } = c.req.param()

  const [img] = await db.select().from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, id)))
  if (!img) return c.json({ error: 'Image not found' }, 404)

  await c.env.PDF_BUCKET.delete(img.r2Key)
  await db.delete(productImages).where(eq(productImages.id, imageId))

  // Update cover imageUrl to next image or clear
  const remaining = await db.select().from(productImages)
    .where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder)).limit(1)
  await db.update(products)
    .set({ imageUrl: remaining[0] ? imageUrl(c.env, remaining[0].r2Key) : null })
    .where(eq(products.id, id))

  return c.json({ ok: true })
})

// ── GET /api/products/:slug — detalle B2C (debe ir AL FINAL) ─────────────────

router.get('/:slug', async (c) => {
  const db = getDb(c.env)
  const { slug } = c.req.param()

  const [product] = await db.select().from(products).where(eq(products.slug, slug))
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const [sellos, images, stock] = await Promise.all([
    db.select().from(productSellos).where(eq(productSellos.productId, product.id)),
    db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder)),
    db.select({
      total:      sql<number>`sum(${inventory.quantity})`,
      nextExpiry: sql<string | null>`min(${inventory.expiresAt})`,
    }).from(inventory).where(and(eq(inventory.productId, product.id), sql`${inventory.quantity} > 0`)),
  ])

  return c.json({
    ...product,
    sellos:    sellos.map(s => s.sello),
    images:    images.map(img => ({ id: img.id, url: imageUrl(c.env, img.r2Key) })),
    stockTotal: Number(stock[0]?.total ?? 0),
    nextExpiry: stock[0]?.nextExpiry ?? null,
  })
})

export { router as productsRouter }
