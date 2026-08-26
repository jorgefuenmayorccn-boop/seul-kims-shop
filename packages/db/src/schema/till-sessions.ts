import { pgTable, uuid, text, integer, timestamp, jsonb, serial, pgEnum } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { uniqueIndex } from 'drizzle-orm/pg-core'
import { shifts } from './shifts'
import { users } from './auth'

export const tillStatusEnum = pgEnum('till_status', ['open', 'closed'])

export const tillSessions = pgTable('till_sessions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  sessionNumber:  serial('session_number').notNull(),
  shiftId:        uuid('shift_id').notNull().references(() => shifts.id),
  openedBy:       uuid('opened_by').notNull().references(() => users.id),
  deviceId:       text('device_id').notNull(),
  openingFloat:   integer('opening_float').notNull(),
  status:         tillStatusEnum('status').default('open').notNull(),
  openedAt:       timestamp('opened_at').defaultNow().notNull(),
  closedAt:       timestamp('closed_at'),
  closingSummary: jsonb('closing_summary'),
}, (table) => ({
  activeTillPerDevice: uniqueIndex('till_sessions_device_active_uniq')
    .on(table.deviceId)
    .where(sql`${table.status} = 'open'`),
}))

export type TillZReport = {
  tillId:            string
  tillSessionNumber: number
  shiftId:           string
  shiftNumber:       number
  cashierName:       string
  openedAt:          string
  closedAt:          string
  openingFloat:      number
  ticketCount:       number
  voidCount:         number
  refundCount:       number
  grossTotal:        number
  refundTotal:       number
  netTotal:          number
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

export type MasterZReport = {
  shiftId:      string
  shiftNumber:  number
  openedAt:     string
  closedAt:     string
  tillCount:    number
  totalTickets: number
  totalVoids:   number
  totalRefunds: number
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
  tills: Array<{
    tillId:            string
    tillSessionNumber: number
    cashierName:       string
    openedAt:          string
    closedAt:          string | null
    openingFloat:      number
    ticketCount:       number
    netTotal:          number
    byMethod:          Record<string, number>
  }>
}
