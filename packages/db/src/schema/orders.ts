import { pgTable, uuid, text, integer, decimal, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { products } from './products'

export const orderChannelEnum = pgEnum('order_channel', [
  'pos', 'web', 'b2b', 'whatsapp',
])

export const orderStatusEnum = pgEnum('order_status', [
  'nueva', 'preparando', 'lista', 'entregada', 'cancelada',
])

export const deliveryModeEnum = pgEnum('delivery_mode', [
  'rappi',    // delivery local Viña/Reñaca/Concón
  'metro',    // retiro en estación Merval (gratis)
  'pickup',   // retiro en tienda
  'shipping', // despacho a regiones (Chilexpress)
])

export const dteStatusEnum = pgEnum('dte_status', ['pending', 'issued', 'failed'])

export const orders = pgTable('orders', {
  id:              uuid('id').primaryKey().defaultRandom(),
  number:          integer('number').notNull(),     // número visible: #12345
  channel:         orderChannelEnum('channel').notNull(),
  customerId:      uuid('customer_id'),
  status:          orderStatusEnum('status').default('nueva'),
  deliveryMode:    deliveryModeEnum('delivery_mode').notNull(),
  deliveryAddress: text('delivery_address'),
  metroStation:    text('metro_station'),           // estación Merval seleccionada
  metroSlot:       text('metro_slot'),              // franja horaria "15:00-17:00"
  subtotal:        decimal('subtotal', { precision: 10, scale: 0 }).notNull(),
  baesAmount:      decimal('baes_amount', { precision: 10, scale: 0 }).default('0'),
  total:           decimal('total', { precision: 10, scale: 0 }).notNull(),
  dteStatus:       dteStatusEnum('dte_status').default('pending'),
  dteFolio:        text('dte_folio'),               // número boleta SII
  pdfToken:        text('pdf_token'),               // token 16 chars para URL R2
  pdfExpiresAt:    timestamp('pdf_expires_at'),     // 48h TTL
  notes:           text('notes'),
  createdAt:       timestamp('created_at').defaultNow(),
  updatedAt:       timestamp('updated_at').defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id:          uuid('id').primaryKey().defaultRandom(),
  orderId:     uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId:   uuid('product_id').notNull().references(() => products.id),
  quantity:    decimal('quantity', { precision: 8, scale: 3 }).notNull(), // soporta kg
  unitPrice:   decimal('unit_price', { precision: 10, scale: 0 }).notNull(),
  isBaes:      boolean('is_baes').default(false),
  subtotal:    decimal('subtotal', { precision: 10, scale: 0 }).notNull(),
})

// Configuración de la tienda (singleton)
export const tiendaConfig = pgTable('tienda_config', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
// Claves relevantes:
// metro_station_name — "Miramar" (confirmar con dueño)
// metro_station_coords — lat,lng
// whatsapp_number — "56932000000"
// rappi_store_id
// dte_provider — "bsale" | "toku" | "haulmer"
