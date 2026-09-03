import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

// Local físico de Seoul Kims (adición post-entrega, 3-sep-2026, migración
// 0027 — Fase 1 del plan multilocal). El dueño ve todo consolidado de todos
// los locales; su staff queda atado a uno (ver users.locationId en auth.ts).
// dte_provider/dte_api_key/dte_rut_empresa quedan acá (no en env vars de
// Railway) para que el dueño pueda autoconfigurar cada local desde el panel
// sin que VÉRTICE toque código — ver pantalla de Configuración (Fase 3).
export const locations = pgTable('locations', {
  id:                uuid('id').primaryKey().defaultRandom(),
  name:              text('name').notNull(),
  slug:              text('slug').notNull().unique(),
  // Prefijo visible en el número de pedido (ej. "VM-00123") — decisión
  // confirmada con el dueño para evitar la colisión de orders.number
  // encontrada en la auditoría (era un contador sin scope de local).
  orderPrefix:       text('order_prefix').notNull(),
  address:           text('address'),
  commune:           text('commune'),
  rut:               text('rut'),
  giro:              text('giro'),
  phone:             text('phone'),
  whatsapp:          text('whatsapp'),
  instagram:         text('instagram'),
  email:             text('email'),
  metroStationName:  text('metro_station_name'),
  dteProvider:       text('dte_provider'),
  dteApiKey:         text('dte_api_key'),
  dteRutEmpresa:     text('dte_rut_empresa'),
  isActive:          boolean('is_active').notNull().default(true),
  createdAt:         timestamp('created_at').defaultNow(),
  updatedAt:         timestamp('updated_at').defaultNow(),
})
