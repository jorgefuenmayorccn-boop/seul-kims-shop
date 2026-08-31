/**
 * Migration 0014: Agregar soporte para primer-login obligatorio y reset de contraseña
 * - users.must_change_password: bool, marca si el usuario DEBE cambiar contraseña en primer login
 * - users.password_changed_at: timestamp, cuándo cambió contraseña por última vez (para auditoría)
 * - staff_password_reset_tokens: tabla para tokens de recuperación de contraseña
 */

import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL

export async function up() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not configured')
  }

  const sql = postgres(DATABASE_URL, { ssl: 'require' })

  console.log('🔄 Migración 0014: Primer-login obligatorio + reset tokens')

  try {
    // 1. Agregar must_change_password a users (default true para usuarios nuevos)
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true
    `
    console.log('✓ Agregado: users.must_change_password')

    // 2. Agregar password_changed_at a users (para auditoría)
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP
    `
    console.log('✓ Agregado: users.password_changed_at')

    // 3. Crear tabla de reset tokens (similar a password_reset_tokens de customers)
    await sql`
      CREATE TABLE IF NOT EXISTS staff_password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✓ Creada tabla: staff_password_reset_tokens')

    // 4. Índice para búsqueda rápida de tokens activos
    await sql`
      CREATE INDEX IF NOT EXISTS staff_pwd_reset_user_idx
      ON staff_password_reset_tokens(user_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS staff_pwd_reset_token_idx
      ON staff_password_reset_tokens(token)
    `
    console.log('✓ Índices creados')

    console.log('✅ Migración 0014 completada')
    await sql.end()
  } catch (e) {
    console.error('❌ Error en migración:', e)
    await sql.end()
    throw e
  }
}

export async function down() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not configured')
  }

  const sql = postgres(DATABASE_URL, { ssl: 'require' })

  console.log('🔄 Revertiendo migración 0014...')
  try {
    await sql`DROP TABLE IF EXISTS staff_password_reset_tokens`
    await sql`ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at`
    await sql`ALTER TABLE users DROP COLUMN IF EXISTS must_change_password`
    console.log('✅ Migración 0014 revertida')
    await sql.end()
  } catch (e) {
    console.error('❌ Error al revertir:', e)
    await sql.end()
    throw e
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  up().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
