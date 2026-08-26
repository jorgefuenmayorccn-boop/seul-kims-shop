// Inserta las claves bancarias en tiendaConfig (si no existen)
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/seed-bank-config.ts

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { tiendaConfig } from './schema'

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) throw new Error('DATABASE_URL requerida')

const sql = neon(DATABASE_URL)
const db  = drizzle(sql)

async function main() {
  const keys = [
    { key: 'bank_name',         value: 'CONFIRMAR' },
    { key: 'bank_account',      value: 'CONFIRMAR' },
    { key: 'bank_account_type', value: 'Cuenta Corriente' },
    { key: 'bank_rut',          value: 'CONFIRMAR' },
    { key: 'bank_holder',       value: 'Seoul Kims' },
  ]

  await db.insert(tiendaConfig).values(keys).onConflictDoNothing()
  console.log('✓ Bank config keys insertadas (o ya existían)')
}

main().catch(console.error)
