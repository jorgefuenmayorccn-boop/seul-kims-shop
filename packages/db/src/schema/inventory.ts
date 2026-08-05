import { pgTable, uuid, text, integer, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { products } from './products'

export const movementTypeEnum = pgEnum('movement_type', [
  'purchase',   // compra a proveedor
  'sale',       // venta POS o web
  'adjustment', // ajuste manual
  'return',     // devolución de cliente
  'expired',    // baja por vencimiento
  'transfer',   // transferencia entre locales (futuro)
])

export const inventory = pgTable('inventory', {
  id:          uuid('id').primaryKey().defaultRandom(),
  productId:   uuid('product_id').notNull().references(() => products.id),
  lot:         text('lot'),                // número de lote del proveedor
  quantity:    integer('quantity').notNull().default(0),
  expiresAt:   timestamp('expires_at'),
  costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 0 }),  // CLP
  location:    text('location').default('main'),  // 'main' | 'freezer' | 'fridge'
  createdAt:   timestamp('created_at').defaultNow(),
})

export const inventoryMovements = pgTable('inventory_movements', {
  id:          uuid('id').primaryKey().defaultRandom(),
  productId:   uuid('product_id').notNull().references(() => products.id),
  inventoryId: uuid('inventory_id').references(() => inventory.id),
  type:        movementTypeEnum('type').notNull(),
  quantity:    integer('quantity').notNull(), // negativo para salidas
  referenceId: uuid('reference_id'),         // order_id o null
  notes:       text('notes'),
  createdAt:   timestamp('created_at').defaultNow(),
  createdBy:   uuid('created_by'),           // user_id
})
