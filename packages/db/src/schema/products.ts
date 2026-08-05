import { pgTable, uuid, text, integer, boolean, timestamp, decimal, pgEnum } from 'drizzle-orm/pg-core'

export const coldChainEnum = pgEnum('cold_chain', ['ambient', 'refrigerated', 'frozen'])
export const productStatusEnum = pgEnum('product_status', ['active', 'inactive', 'discontinued'])

export const products = pgTable('products', {
  id:           uuid('id').primaryKey().defaultRandom(),
  sku:          text('sku').notNull().unique(),
  name:         text('name').notNull(),
  nameKo:       text('name_ko'),           // nombre en hangul (opcional)
  slug:         text('slug').notNull().unique(),
  description:  text('description'),
  brand:        text('brand'),             // Ottogi, Nongshim, Samyang, Bibigo, etc.
  categoryId:   uuid('category_id'),
  priceRetail:  decimal('price_retail', { precision: 10, scale: 0 }).notNull(),  // CLP
  priceB2B:     decimal('price_b2b', { precision: 10, scale: 0 }),               // CLP neto
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
