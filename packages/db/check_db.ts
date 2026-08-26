import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  const shifts = await sql`SELECT id, status, device_id FROM shifts WHERE status='open' LIMIT 3`
  console.log('OPEN SHIFTS:', shifts)
  
  const tills = await sql`SELECT id, status, shift_id FROM till_sessions WHERE status='open' LIMIT 3`
  console.log('OPEN TILLS:', tills)
  
  // Get a real product with stock
  const prods = await sql`
    SELECT p.id, p.name, i.quantity 
    FROM products p 
    JOIN inventory i ON i.product_id = p.id 
    WHERE i.quantity > 0 
    LIMIT 3
  `
  console.log('PRODUCTS WITH STOCK:', prods)
}
main().catch(console.error)
