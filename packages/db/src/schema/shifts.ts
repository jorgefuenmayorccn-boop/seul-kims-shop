import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum, serial } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { locations } from './locations'

export const shiftStatusEnum = pgEnum('shift_status', ['open', 'closed'])

export const cashMovementTypeEnum = pgEnum('cash_movement_type', [
  'opening_float',
  'cash_in',
  'cash_out',
  'cash_refund',
])

export const shifts = pgTable('shifts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  shiftNumber:    serial('shift_number').notNull(),
  openedBy:       uuid('opened_by').notNull().references(() => users.id),
  // Local (adición post-entrega, 3-sep-2026, migración 0027) — la unicidad
  // de turno abierto por dispositivo pasa a ser compuesta (locationId,
  // deviceId): antes 2 locales con una caja llamada igual ("caja-1")
  // habrían colisionado al abrir turno el mismo día.
  locationId:     uuid('location_id').notNull().references(() => locations.id),
  deviceId:       text('device_id').notNull(),
  openingFloat:   integer('opening_float').notNull(),
  status:         shiftStatusEnum('status').default('open').notNull(),
  openedAt:       timestamp('opened_at').defaultNow().notNull(),
  closedAt:       timestamp('closed_at'),
  closingSummary: jsonb('closing_summary'),
}, (table) => ({
  activeShiftPerDevice: uniqueIndex('shifts_device_active_uniq')
    .on(table.locationId, table.deviceId)
    .where(sql`${table.status} = 'open'`),
}))

export const cashMovements = pgTable('cash_movements', {
  id:          uuid('id').primaryKey().defaultRandom(),
  shiftId:     uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  type:        cashMovementTypeEnum('type').notNull(),
  amountClp:   integer('amount_clp').notNull(),
  referenceId: uuid('reference_id'),
  notes:       text('notes'),
  createdBy:   uuid('created_by').notNull().references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

export type ZReport = {
  shiftId:      string
  shiftNumber:  number
  cashierName:  string
  openedAt:     string
  closedAt:     string
  openingFloat: number
  ticketCount:  number
  voidCount:    number
  refundCount:  number
  grossTotal:   number
  refundTotal:  number
  netTotal:     number
  byMethod: {
    cash:     number
    debit:    number
    credit:   number
    baes:     number
    qr:       number
    transfer: number
    [key: string]: number
  }
  expectedCash: number
}
