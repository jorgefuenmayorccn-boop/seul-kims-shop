import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL!)
async function main() {
  await sql`ALTER TYPE "public"."delivery_mode" ADD VALUE IF NOT EXISTS 'delivery'`
  console.log('✓ delivery_mode enum updated')
  await sql`ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'en_ruta' BEFORE 'entregada'`
  console.log('✓ order_status enum updated')
  await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address" text`
  await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "commune" text`
  await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address_notes" text`
  console.log('✓ customers columns added')
  await sql`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone)`
  console.log('✓ phone index created')
  console.log('Migration 0006 applied successfully')
}
main().catch(console.error)
