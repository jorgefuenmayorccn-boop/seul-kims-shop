import { pgTable, uuid, text, integer, decimal, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { orders } from './orders'
import { users } from './auth'
import { shifts } from './shifts'
import { driverShifts } from './driver-shifts'
import { locations } from './locations'

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'assigned',
  'accepted',
  'in_transit',
  'delivered',
  'failed',
])

export const paymentAtDoorEnum = pgEnum('payment_at_door', [
  'not_required',
  'pending',
  'collected',
  'refused',
])

export const deliveryAssignments = pgTable('delivery_assignments', {
  id:              uuid('id').primaryKey().defaultRandom(),
  orderId:         uuid('order_id').notNull().references(() => orders.id),
  driverId:        uuid('driver_id').references(() => users.id),
  status:          deliveryStatusEnum('status').notNull().default('pending'),
  paymentAtDoor:   paymentAtDoorEnum('payment_at_door').notNull().default('not_required'),
  amountToCollect: integer('amount_to_collect').default(0),
  paymentMethod:   text('payment_method'),  // 'cash' | 'debit' | 'transfer' — cobrado en puerta
  routeIndex:      integer('route_index'),
  notes:           text('notes'),
  assignedAt:      timestamp('assigned_at'),
  acceptedAt:      timestamp('accepted_at'),
  pickedUpAt:      timestamp('picked_up_at'),
  deliveredAt:     timestamp('delivered_at'),
  failedAt:        timestamp('failed_at'),
  failureReason:   text('failure_reason'),
  // Bifurcación de flota: interna vs. terceros (Rappi)
  dispatchType:        text('dispatch_type').notNull().default('internal'),
  thirdPartyName:      text('third_party_name'),
  thirdPartyTracking:  text('third_party_tracking'),
  thirdPartySavedAt:   timestamp('third_party_saved_at'),
  thirdPartySavedBy:   uuid('third_party_saved_by').references(() => users.id),
  // Liquidación (migrate-0009) — tarifa $1.000/km
  distanciaKm:         decimal('distancia_km', { precision: 8, scale: 3 }),
  tarifaKmClp:         integer('tarifa_km_clp').notNull().default(1000),
  montoRepartidorClp:  integer('monto_repartidor_clp'),
  firmaR2Key:          text('firma_r2_key'),
  firmaAt:             timestamp('firma_at'),
  firmaLat:            decimal('firma_lat', { precision: 9, scale: 6 }),
  firmaLng:            decimal('firma_lng', { precision: 9, scale: 6 }),
  createdAt:           timestamp('created_at').defaultNow(),
  updatedAt:           timestamp('updated_at').defaultNow(),
  // Turno de repartidor vigente al momento de asignar (adición post-entrega,
  // 3-sep-2026, migración 0026) — ver driver-shifts.ts. NULL si se asignó a
  // un repartidor sin turno abierto (override manual).
  driverShiftId:       uuid('driver_shift_id').references(() => driverShifts.id),
  // Local del pedido (adición post-entrega, 3-sep-2026, migración 0027) —
  // es lo que usa pickActiveDriver() para no asignar un repartidor de otro
  // local.
  locationId:          uuid('location_id').notNull().references(() => locations.id),
})

export const deliveryPods = pgTable('delivery_pods', {
  id:             uuid('id').primaryKey().defaultRandom(),
  assignmentId:   uuid('assignment_id').notNull().references(() => deliveryAssignments.id, { onDelete: 'cascade' }),
  r2Key:          text('r2_key').notNull(),   // pods/{orderId}/{uuid}.jpg en PDF_BUCKET
  recipientName:  text('recipient_name'),
  recipientRut:   text('recipient_rut'),
  latitude:       decimal('latitude', { precision: 9, scale: 6 }),
  longitude:      decimal('longitude', { precision: 9, scale: 6 }),
  signatureR2Key: text('signature_r2_key'),
  capturedAt:     timestamp('captured_at').defaultNow(),
  uploadedAt:     timestamp('uploaded_at').defaultNow(),
})

export const deliveryLocationPings = pgTable('delivery_location_pings', {
  id:           uuid('id').primaryKey().defaultRandom(),
  driverId:     uuid('driver_id').notNull().references(() => users.id),
  assignmentId: uuid('assignment_id').references(() => deliveryAssignments.id),
  latitude:     decimal('latitude', { precision: 9, scale: 6 }).notNull(),
  longitude:    decimal('longitude', { precision: 9, scale: 6 }).notNull(),
  accuracy:     integer('accuracy'),
  createdAt:    timestamp('created_at').defaultNow(),
})

// Liquidaciones de repartidores (migrate-0009)
export const deliveryPayouts = pgTable('delivery_payouts', {
  id:               uuid('id').primaryKey().defaultRandom(),
  driverId:         uuid('driver_id').notNull().references(() => users.id),
  shiftId:          uuid('shift_id').references(() => shifts.id),
  periodFrom:       timestamp('period_from').notNull(),
  periodTo:         timestamp('period_to').notNull(),
  deliveriesCount:  integer('deliveries_count').notNull().default(0),
  totalKm:          decimal('total_km', { precision: 10, scale: 3 }).notNull().default('0'),
  grossClp:         integer('gross_clp').notNull().default(0),
  cashCollected:    integer('cash_collected').notNull().default(0),
  netPayable:       integer('net_payable').notNull().default(0),
  paidAt:           timestamp('paid_at'),
  paidBy:           uuid('paid_by').references(() => users.id),
  pdfR2Key:         text('pdf_r2_key'),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').defaultNow(),
})

// Turnos de repartidores (migrate-0009) — HUÉRFANA: confirmado 3-sep-2026
// (Fase 0 del plan multilocal) que esta tabla tiene 0 filas en producción y
// ningún endpoint la usa (grep exhaustivo sobre server.ts). El turno de
// repartidor REAL, en uso desde el 3-sep-2026, es `driverShifts`
// (tabla `driver_shifts`, singular) en driver-shifts.ts — nombre casi
// idéntico, tabla distinta. No borrar sin confirmar con el equipo — se deja
// documentada para no repetir la confusión.
export const deliveryShifts = pgTable('delivery_shifts', {
  id:         uuid('id').primaryKey().defaultRandom(),
  driverId:   uuid('driver_id').notNull().references(() => users.id),
  deviceId:   text('device_id').notNull().default('repartidor'),
  status:     text('status').notNull().default('open'),
  openedAt:   timestamp('opened_at').defaultNow().notNull(),
  closedAt:   timestamp('closed_at'),
  summary:    jsonb('summary'),
  createdAt:  timestamp('created_at').defaultNow(),
})
