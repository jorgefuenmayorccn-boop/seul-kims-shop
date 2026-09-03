import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { locations } from './locations'

// 'manager' (Gerente de local) agregado post-entrega, 3-sep-2026, Fase 2 del
// plan multilocal — pedido explícito del dueño: además de lo que ya tiene
// `staff`, puede ver/agregar/modificar Productos (antes solo owner/admin).
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'manager', 'staff', 'delivery', 'viewer'])

export const users = pgTable('users', {
  id:                uuid('id').primaryKey().defaultRandom(),
  email:             text('email').notNull().unique(),
  passwordHash:      text('password_hash').notNull(),
  name:              text('name').notNull(),
  role:              userRoleEnum('role').notNull().default('staff'),
  // Local al que queda atado este usuario (adición post-entrega, 3-sep-2026,
  // Fase 2 multilocal) — NULL = acceso cross-local (owner/admin ven todo).
  // staff/manager/delivery quedan atados a UN local.
  locationId:        uuid('location_id').references(() => locations.id),
  isActive:          boolean('is_active').notNull().default(true),
  lastLoginAt:       timestamp('last_login_at'),
  failedAttempts:    integer('failed_attempts').notNull().default(0),
  lockedUntil:       timestamp('locked_until'),
  // IAM Corporate Metadata (migrate-0008)
  cargo:             text('cargo'),
  departamento:      text('departamento'),
  telefonoPersonal:  text('telefono_personal'),
  avatarUrl:         text('avatar_url'),
  metadata:          jsonb('metadata'),
  createdAt:         timestamp('created_at').defaultNow(),
  updatedAt:         timestamp('updated_at').defaultNow(),
})

export const sessions = pgTable('sessions', {
  id:        text('id').primaryKey(),               // 32 bytes random → hex 64 chars
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),     // rolling 7 días
  userAgent: text('user_agent'),
  ip:        text('ip'),
  createdAt: timestamp('created_at').defaultNow(),
}, t => ({
  userIdx: index('sessions_user_idx').on(t.userId),
  expIdx:  index('sessions_exp_idx').on(t.expiresAt),
}))
