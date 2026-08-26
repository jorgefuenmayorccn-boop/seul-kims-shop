// Seed v2: catálogo de productos seulmarket.cl + 2 staff users
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/seed-v2.ts

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { categories, products } from './schema'
import { eq } from 'drizzle-orm'

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) throw new Error('DATABASE_URL requerida')

const db = drizzle(neon(DATABASE_URL))

const CATS = [
  { name: 'Ramyún',          slug: 'ramyun',         emoji: '🍜', sortOrder: 1 },
  { name: 'Snacks',          slug: 'snacks',          emoji: '🍿', sortOrder: 2 },
  { name: 'Salsas',          slug: 'salsas',          emoji: '🫙', sortOrder: 3 },
  { name: 'Bebidas',         slug: 'bebidas',         emoji: '🧃', sortOrder: 4 },
  { name: 'Pastas / Arroces',slug: 'pastas-arroces',  emoji: '🍚', sortOrder: 5 },
  { name: 'Dulces',          slug: 'dulces',          emoji: '🍬', sortOrder: 6 },
  { name: 'Frozen',          slug: 'frozen',          emoji: '🧊', sortOrder: 7 },
  { name: 'Lácteos',         slug: 'lacteos',         emoji: '🥛', sortOrder: 8 },
  { name: 'K-Beauty',        slug: 'k-beauty',        emoji: '✨', sortOrder: 9 },
  { name: 'Condimentos',     slug: 'condimentos',     emoji: '🧂', sortOrder: 10 },
  { name: 'Kimchi',          slug: 'kimchi',          emoji: '🫙', sortOrder: 11 },
  { name: 'Otros',           slug: 'otros',           emoji: '📦', sortOrder: 12 },
]

const PRODUCTS = [
  // Ramyún
  { sku: 'RAM-001', name: 'Shin Ramyun Nongshim 120g', slug: 'shin-ramyun-nongshim-120g', brand: 'Nongshim', cat: 'ramyun', price: 2490, priceB2B: 1800, baes: true },
  { sku: 'RAM-002', name: 'Buldak 2x Spicy 140g', slug: 'buldak-2x-spicy-140g', brand: 'Samyang', cat: 'ramyun', price: 2990, priceB2B: 2200, baes: true },
  { sku: 'RAM-003', name: 'Jin Ramen Picante 120g', slug: 'jin-ramen-picante-120g', brand: 'Ottogi', cat: 'ramyun', price: 1990, priceB2B: 1500, baes: true },
  { sku: 'RAM-004', name: 'Neoguri Seafood 120g', slug: 'neoguri-seafood-120g', brand: 'Nongshim', cat: 'ramyun', price: 2290, priceB2B: 1700, baes: true },
  { sku: 'RAM-005', name: 'Chapagetti 140g', slug: 'chapagetti-140g', brand: 'Nongshim', cat: 'ramyun', price: 2190, priceB2B: 1650, baes: true },

  // Snacks
  { sku: 'SNK-001', name: 'Honey Butter Chip 60g', slug: 'honey-butter-chip-60g', brand: 'Haitai', cat: 'snacks', price: 2890, priceB2B: 2100, baes: false },
  { sku: 'SNK-002', name: 'Pepero Original 47g', slug: 'pepero-original-47g', brand: 'Lotte', cat: 'snacks', price: 1490, priceB2B: 1100, baes: false },
  { sku: 'SNK-003', name: 'Choco Pie 12u', slug: 'choco-pie-12u', brand: 'Orion', cat: 'snacks', price: 5490, priceB2B: 4200, baes: false },

  // Salsas
  { sku: 'SAL-001', name: 'Gochujang CJ 200g', slug: 'gochujang-cj-200g', brand: 'CJ', cat: 'salsas', price: 3990, priceB2B: 2900, baes: false },
  { sku: 'SAL-002', name: 'Soja Kikoman 150ml', slug: 'soja-kikoman-150ml', brand: 'Kikkoman', cat: 'salsas', price: 2490, priceB2B: 1800, baes: false },
  { sku: 'SAL-003', name: 'Doenjang Sempio 200g', slug: 'doenjang-sempio-200g', brand: 'Sempio', cat: 'salsas', price: 3590, priceB2B: 2700, baes: false },

  // Bebidas
  { sku: 'BEB-001', name: 'Bebida Milkis 250ml', slug: 'milkis-250ml', brand: 'Lotte', cat: 'bebidas', price: 1290, priceB2B: 950, baes: false },
  { sku: 'BEB-002', name: 'Coco Palm 500ml', slug: 'coco-palm-500ml', brand: 'Coco Palm', cat: 'bebidas', price: 2190, priceB2B: 1600, baes: false },

  // Pastas / Arroces
  { sku: 'ARR-001', name: 'Arroz Jazmín 1kg', slug: 'arroz-jazmin-1kg', brand: 'Ottogi', cat: 'pastas-arroces', price: 3490, priceB2B: 2600, baes: true },
  { sku: 'ARR-002', name: 'Vermicelli Vidrio 200g', slug: 'vermicelli-vidrio-200g', brand: 'Ottogi', cat: 'pastas-arroces', price: 2290, priceB2B: 1700, baes: false },

  // Dulces
  { sku: 'DUL-001', name: 'Yakult Original 65ml ×5', slug: 'yakult-original-65ml-x5', brand: 'Yakult', cat: 'lacteos', price: 2990, priceB2B: 2200, baes: false, cold: 'refrigerated' as const },
  { sku: 'DUL-002', name: 'Binggrae Banana Milk 200ml', slug: 'binggrae-banana-milk-200ml', brand: 'Binggrae', cat: 'lacteos', price: 1890, priceB2B: 1400, baes: false, cold: 'refrigerated' as const },

  // Kimchi
  { sku: 'KIM-001', name: 'Kimchi Baechu 500g', slug: 'kimchi-baechu-500g', brand: 'Bibigo', cat: 'kimchi', price: 7990, priceB2B: 6200, baes: false, cold: 'refrigerated' as const },

  // Condimentos
  { sku: 'CON-001', name: 'Aceite de Sésamo 100ml', slug: 'aceite-sesamo-100ml', brand: 'Ottogi', cat: 'condimentos', price: 3290, priceB2B: 2500, baes: false },
  { sku: 'CON-002', name: 'Semillas Sésamo 100g', slug: 'semillas-sesamo-100g', brand: 'Ottogi', cat: 'condimentos', price: 1990, priceB2B: 1500, baes: false },
]

async function main() {
  console.log('🌱 Seed v2 iniciado...')

  // 1. Upsert categorías (insert ignorando conflictos), luego fetch todos los IDs
  for (const cat of CATS) {
    await db.insert(categories).values({
      name: cat.name, slug: cat.slug, emoji: cat.emoji, sortOrder: cat.sortOrder,
    }).onConflictDoNothing()
  }
  const allCats = await db.select({ id: categories.id, slug: categories.slug }).from(categories)
  const catIds: Record<string, string> = {}
  for (const c of allCats) catIds[c.slug] = c.id
  console.log(`  ✓ ${CATS.length} categorías procesadas`)

  // 2. Insertar productos (upsert por slug)
  let created = 0; let skipped = 0
  for (const p of PRODUCTS) {
    const [existing] = await db.select({ id: products.id })
      .from(products)
      .where(eq(products.slug, p.slug))
      .limit(1)

    if (existing?.id) {
      console.log(`  ↩ Producto ya existe: ${p.name}`)
      skipped++
      continue
    }

    const catId = catIds[p.cat]
    await db.insert(products).values({
      sku:           p.sku,
      name:          p.name,
      slug:          p.slug,
      brand:         p.brand,
      categoryId:    catId,
      priceRetail:   p.price.toString(),
      priceWeb:      p.price.toString(),
      pricePOS:      p.price.toString(),
      priceB2B:      p.priceB2B.toString(),
      isBaesEligible: p.baes,
      coldChain:     (p.cold ?? 'ambient') as 'ambient' | 'refrigerated' | 'frozen',
      status:        'active',
    })
    console.log(`  ✓ Producto: ${p.name} — $${p.price.toLocaleString('es-CL')}`)
    created++
  }

  console.log(`\n✅ Seed v2 completo — ${CATS.length} categorías, ${created} productos creados, ${skipped} omitidos`)
}

main().catch(e => { console.error(e); process.exit(1) })
