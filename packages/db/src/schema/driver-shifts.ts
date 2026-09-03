import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './auth'

// Turno de repartidor (adición post-entrega, 3-sep-2026, migración 0025 en
// packages/api/src/server.ts) — reconciliado acá el 3-sep-2026 (Fase 0 del
// plan multilocal). NO CONFUNDIR con `deliveryShifts` (tabla `delivery_shifts`,
// plural, definida en delivery.ts) — esa es una tabla huérfana de una
// migración anterior (migrate-0009), 0 filas en producción, ningún endpoint
// la usa. Esta (`driver_shifts`, singular) es la real: turno abierto/cerrado
// por repartidor, sin arqueo (a diferencia de `shifts`, que es caja de POS).
export const driverShifts = pgTable('driver_shifts', {
  id:        uuid('id').primaryKey().defaultRandom(),
  driverId:  uuid('driver_id').notNull().references(() => users.id),
  status:    text('status').notNull().default('open'), // 'open' | 'closed'
  openedAt:  timestamp('opened_at').defaultNow(),
  closedAt:  timestamp('closed_at'),
})
