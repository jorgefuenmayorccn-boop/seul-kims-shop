import { pgTable, uuid, text, integer, decimal, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { products } from './products'
import { shifts } from './shifts'
import { tillSessions } from './till-sessions'

export const orderChannelEnum = pgEnum('order_channel', [
  'pos', 'web', 'b2b', 'whatsapp',
])

export const orderStatusEnum = pgEnum('order_status', [
  'nueva', 'preparando', 'lista', 'en_ruta', 'entregada', 'cancelada',
])

export const deliveryModeEnum = pgEnum('delivery_mode', [
  'rappi',    // delivery local Viña/Reñaca/Concón (plataforma Rappi)
  'metro',    // retiro en estación Merval (gratis)
  'pickup',   // retiro en tienda
  'shipping', // despacho a regiones (Chilexpress)
  'delivery', // delivery propio — flota interna (WhatsApp/teléfono/POS)
])

export const dteTypeEnum = pgEnum('dte_type', [
  'nota_venta', // comprobante interno sin folio SII (actual)
  'boleta',     // boleta electrónica SII (39)
  'factura',    // factura electrónica SII (33)
])

export const dteStatusEnum = pgEnum('dte_status', [
  'pending',      // encolado, aún no enviado al proveedor
  'sending',      // en vuelo hacia el proveedor
  'issued',       // proveedor aceptó + timbró
  'accepted_sii', // SII confirmó recepción (via webhook/poll)
  'rejected_sii', // SII rechazó el DTE
  'failed',       // error definitivo tras 3 reintentos
])

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
  // DTE
  dteType:         dteTypeEnum('dte_type').default('nota_venta').notNull(),
  dteStatus:       dteStatusEnum('dte_status').default('pending').notNull(),
  dteFolio:        text('dte_folio'),               // número boleta SII
  dteTrackId:      text('dte_track_id'),            // trackId del proveedor/SII
  dteProvider:     text('dte_provider'),            // 'openfactura' | 'mock'
  pdfToken:        text('pdf_token'),               // token 16 chars para URL R2
  pdfUrl:          text('pdf_url'),                 // URL PDF del proveedor
  pdfExpiresAt:    timestamp('pdf_expires_at'),     // 48h TTL
  // Receptor (solo factura electrónica)
  receiverRut:     text('receiver_rut'),
  receiverName:    text('receiver_name'),
  receiverGiro:    text('receiver_giro'),
  receiverAddress: text('receiver_address'),
  receiverComuna:  text('receiver_comuna'),
  notes:           text('notes'),
  // Delivery manual (WhatsApp/teléfono ingresado en POS sin cuenta registrada)
  guestName:       text('guest_name'),
  guestPhone:      text('guest_phone'),
  guestEmail:      text('guest_email'),
  shiftId:         uuid('shift_id').references(() => shifts.id),
  tillSessionId:   uuid('till_session_id').references(() => tillSessions.id),
  cashierId:       uuid('cashier_id'),
  voidedBy:        uuid('voided_by'),
  voidedAt:        timestamp('voided_at'),
  voidReason:      text('void_reason'),
  // SII void (migrate-0011)
  voidSiiFolio:    text('void_sii_folio'),
  voidSiiStatus:   text('void_sii_status'),
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
