import { pgTable, uuid, text, integer, boolean, timestamp, decimal, pgEnum } from 'drizzle-orm/pg-core'

export const coldChainEnum = pgEnum('cold_chain', ['ambient', 'refrigerated', 'frozen'])
export const productStatusEnum = pgEnum('product_status', ['active', 'inactive', 'discontinued'])

export const products = pgTable('products', {
  id:           uuid('id').primaryKey().defaultRandom(),
  sku:          text('sku').notNull().unique(),
  barcode:      text('barcode').unique(),              // EAN-13
  name:         text('name').notNull(),
  nameKo:       text('name_ko'),           // nombre en hangul (opcional)
  slug:         text('slug').notNull().unique(),
  description:  text('description'),
  brand:        text('brand'),             // Ottogi, Nongshim, Samyang, Bibigo, etc.
  categoryId:   uuid('category_id'),
  costPrice:    decimal('cost_price',   { precision: 10, scale: 0 }),             // costo unitario CLP
  priceRetail:  decimal('price_retail', { precision: 10, scale: 0 }).notNull(),  // CLP (legacy + fallback)
  priceWeb:     decimal('price_web',    { precision: 10, scale: 0 }),             // precio B2C web
  pricePOS:     decimal('price_pos',    { precision: 10, scale: 0 }),             // precio caja física
  priceB2B:     decimal('price_b2b',   { precision: 10, scale: 0 }),             // CLP neto mayorista
  discountWebPct: integer('discount_web_pct').default(0),                         // % descuento canal web
  discountPOSPct: integer('discount_pos_pct').default(0),                         // % descuento canal POS
  discountB2BPct: integer('discount_b2b_pct').default(0),                         // % descuento canal B2B
  weightGrams:  integer('weight_grams'),
  isWeighable:  boolean('is_weighable').default(false),          // kg en POS
  isBaesEligible: boolean('is_baes_eligible').default(false),   // JUNAEB
  coldChain:    coldChainEnum('cold_chain').default('ambient'),
  status:       productStatusEnum('status').default('active'),
  imageUrl:     text('image_url'),
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
})

export const categories = pgTable('categories', {
  id:       uuid('id').primaryKey().defaultRandom(),
  name:     text('name').notNull(),
  slug:     text('slug').notNull().unique(),
  emoji:    text('emoji'),
  sortOrder: integer('sort_order').default(0),
})

// Sellos "Alto En" — Ley 20.606
export const productSellos = pgTable('product_sellos', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sello:     text('sello').notNull(), // 'sodio' | 'grasas' | 'azucares' | 'calorias'
})

// Galería de imágenes — almacenadas en Cloudflare R2
export const productImages = pgTable('product_images', {
  id:        uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  r2Key:     text('r2_key').notNull(),    // products/{productId}/{uuid}.{ext}
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
})
