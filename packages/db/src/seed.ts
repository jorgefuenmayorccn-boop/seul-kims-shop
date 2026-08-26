// Seed SEUL KING OS v1.0 — 10 productos coreanos reales con inventario
// Ejecutar: DATABASE_URL=... npx tsx packages/db/src/seed.ts

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) throw new Error('DATABASE_URL requerida')

const sql = neon(DATABASE_URL)
const db  = drizzle(sql, { schema })

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

async function main() {
  console.log('🌱 Seeding Seoul Kims DB...')

  // 1. tiendaConfig
  await db.insert(schema.tiendaConfig).values([
    { key: 'metro_station_name',   value: 'Miramar' },
    { key: 'metro_station_coords', value: '-33.0147,-71.5558' },
    { key: 'whatsapp_number',      value: '56936451991' },
    { key: 'rappi_store_id',       value: '' },
    { key: 'dte_provider',         value: 'bsale' },
    { key: 'store_address',        value: 'CONFIRMAR' },
    { key: 'store_rut',            value: 'CONFIRMAR' },
    { key: 'void_pin',             value: '1234' },
    { key: 'bank_name',            value: 'CONFIRMAR' },
    { key: 'bank_account',         value: 'CONFIRMAR' },
    { key: 'bank_account_type',    value: 'Cuenta Corriente' },
    { key: 'bank_rut',             value: 'CONFIRMAR' },
    { key: 'bank_holder',          value: 'Seoul Kims' },
  ]).onConflictDoNothing()

  // 2. Categorías
  const cats = await db.insert(schema.categories).values([
    { name: 'Ramen & Fideos',   slug: 'ramen',      emoji: '🍜', sortOrder: 1 },
    { name: 'Salsas & Pastas',  slug: 'salsas',     emoji: '🌶️', sortOrder: 2 },
    { name: 'Snacks & Dulces',  slug: 'snacks',     emoji: '🍿', sortOrder: 3 },
    { name: 'Kimchi & Banchan', slug: 'kimchi',     emoji: '🥬', sortOrder: 4 },
    { name: 'Bebidas',          slug: 'bebidas',    emoji: '🧋', sortOrder: 5 },
    { name: 'Congelados',       slug: 'congelados', emoji: '🧊', sortOrder: 6 },
    { name: 'K-Beauty',         slug: 'kbeauty',    emoji: '✨', sortOrder: 7 },
    { name: 'Regalo K-Pop',     slug: 'regalo',     emoji: '🎁', sortOrder: 8 },
  ]).onConflictDoNothing().returning()

  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.id]))
  console.log('   Categorías:', Object.keys(catMap))

  // Si las categorías ya existían, buscarlas
  const existingCats = cats.length === 0
    ? await db.select().from(schema.categories)
    : cats
  const cm = Object.fromEntries(existingCats.map(c => [c.slug, c.id]))

  // 3. 10 productos reales
  const productsData = [
    {
      sku: 'SHIN-RAMYUN-CUP',
      barcode: '8801043150729',
      name: 'Shin Ramyun Cup 68g',
      nameKo: '신라면 컵',
      slug: 'shin-ramyun-cup-68g',
      brand: 'Nongshim',
      categoryId: cm['ramen'],
      priceRetail: '1490',
      priceB2B: '1100',
      coldChain: 'ambient' as const,
      isBaesEligible: true,
      weightGrams: 68,
      imageUrl: 'https://picsum.photos/seed/SHIN-RAMYUN-CUP/600/600',
    },
    {
      sku: 'BULDAK-2X',
      barcode: '8801073110458',
      name: 'Buldak Ramen 2x Spicy 140g',
      nameKo: '불닭볶음면 2x',
      slug: 'buldak-ramen-2x-spicy',
      brand: 'Samyang',
      categoryId: cm['ramen'],
      priceRetail: '2490',
      priceB2B: '1800',
      coldChain: 'ambient' as const,
      isBaesEligible: false,
      weightGrams: 140,
      imageUrl: 'https://picsum.photos/seed/BULDAK-2X/600/600',
    },
    {
      sku: 'CHOCO-PIE-12',
      barcode: '8801019200188',
      name: 'Orion Choco Pie 12 unidades',
      nameKo: '초코파이',
      slug: 'orion-choco-pie-12u',
      brand: 'Orion',
      categoryId: cm['snacks'],
      priceRetail: '4990',
      priceB2B: '3800',
      coldChain: 'ambient' as const,
      isBaesEligible: true,
      weightGrams: 468,
      imageUrl: 'https://picsum.photos/seed/CHOCO-PIE-12/600/600',
    },
    {
      sku: 'HONEY-BTR-CHIP',
      barcode: '8801121758015',
      name: 'Honey Butter Chip 60g',
      nameKo: '허니버터칩',
      slug: 'honey-butter-chip-60g',
      brand: 'Haitai',
      categoryId: cm['snacks'],
      priceRetail: '2990',
      priceB2B: '2200',
      coldChain: 'ambient' as const,
      isBaesEligible: false,
      weightGrams: 60,
      imageUrl: 'https://picsum.photos/seed/HONEY-BTR-CHIP/600/600',
    },
    {
      sku: 'GOCHUJANG-500',
      barcode: '8801007123456',
      name: 'Gochujang CJ Haechandle 500g',
      nameKo: '고추장',
      slug: 'gochujang-cj-500g',
      brand: 'CJ Haechandle',
      categoryId: cm['salsas'],
      priceRetail: '4990',
      priceB2B: '3800',
      coldChain: 'refrigerated' as const,
      isBaesEligible: false,
      weightGrams: 500,
      imageUrl: 'https://picsum.photos/seed/GOCHUJANG-500/600/600',
    },
    {
      sku: 'KIMCHI-JONGGA',
      barcode: '8809020115109',
      name: 'Kimchi Jongga 500g',
      nameKo: '종가집 김치',
      slug: 'kimchi-jongga-500g',
      brand: 'Jongga',
      categoryId: cm['kimchi'],
      priceRetail: '6990',
      priceB2B: '5200',
      coldChain: 'refrigerated' as const,
      isBaesEligible: false,
      weightGrams: 500,
      imageUrl: 'https://picsum.photos/seed/KIMCHI-JONGGA/600/600',
    },
    {
      sku: 'MILKIS-250',
      barcode: '8801056136017',
      name: 'Milkis Lotte 250ml',
      nameKo: '밀키스',
      slug: 'milkis-lotte-250ml',
      brand: 'Lotte',
      categoryId: cm['bebidas'],
      priceRetail: '1290',
      priceB2B: '950',
      coldChain: 'ambient' as const,
      isBaesEligible: true,
      weightGrams: 250,
      imageUrl: 'https://picsum.photos/seed/MILKIS-250/600/600',
    },
    {
      sku: 'OKF-ALOE-500',
      barcode: '8801121740751',
      name: 'OKF Aloe Vera King 500ml',
      nameKo: '알로에 베라',
      slug: 'okf-aloe-vera-500ml',
      brand: 'OKF',
      categoryId: cm['bebidas'],
      priceRetail: '1990',
      priceB2B: '1500',
      coldChain: 'ambient' as const,
      isBaesEligible: true,
      weightGrams: 500,
      imageUrl: 'https://picsum.photos/seed/OKF-ALOE-500/600/600',
    },
    {
      sku: 'BIBIGO-MANDU-400',
      barcode: '8801007311234',
      name: 'Bibigo Mandu Cerdo & Verduras 400g',
      nameKo: '비비고 만두',
      slug: 'bibigo-mandu-cerdo-400g',
      brand: 'Bibigo',
      categoryId: cm['congelados'],
      priceRetail: '7990',
      priceB2B: '6200',
      coldChain: 'frozen' as const,
      isBaesEligible: false,
      weightGrams: 400,
      imageUrl: 'https://picsum.photos/seed/BIBIGO-MANDU-400/600/600',
    },
    {
      sku: 'COSRX-SNAIL-100',
      barcode: '8809172080011',
      name: 'COSRX Snail Mucin 96% Power Repairing Essence 100ml',
      nameKo: '달팽이 에센스',
      slug: 'cosrx-snail-mucin-100ml',
      brand: 'COSRX',
      categoryId: cm['kbeauty'],
      priceRetail: '12990',
      priceB2B: '10000',
      coldChain: 'ambient' as const,
      isBaesEligible: false,
      weightGrams: 100,
      imageUrl: 'https://picsum.photos/seed/COSRX-SNAIL-100/600/600',
    },
  ]

  const insertedProducts = await db.insert(schema.products)
    .values(productsData)
    .onConflictDoNothing()
    .returning()

  console.log(`   Productos insertados: ${insertedProducts.length}`)

  // Si ya existían, buscarlos
  const allProducts = insertedProducts.length > 0
    ? insertedProducts
    : await db.select().from(schema.products)

  const pMap = Object.fromEntries(allProducts.map(p => [p.sku, p.id]))

  // 4. Lotes de inventario
  const now = new Date()
  const inventoryLots = [
    // Ramen — ambient, 60 días, stock 40
    { productId: pMap['SHIN-RAMYUN-CUP'],  lot: 'L2501-A', quantity: 40, expiresAt: daysFromNow(60),  location: 'main' },
    { productId: pMap['BULDAK-2X'],         lot: 'L2501-B', quantity: 35, expiresAt: daysFromNow(90),  location: 'main' },
    // Snacks — ambient, 60 días, stock 30
    { productId: pMap['CHOCO-PIE-12'],      lot: 'L2501-C', quantity: 25, expiresAt: daysFromNow(45),  location: 'main' },
    { productId: pMap['HONEY-BTR-CHIP'],    lot: 'L2501-D', quantity: 30, expiresAt: daysFromNow(75),  location: 'main' },
    // Salsas — refrigerated, 20 días (warning en dashboard)
    { productId: pMap['GOCHUJANG-500'],     lot: 'L2501-E', quantity: 20, expiresAt: daysFromNow(18),  location: 'fridge' },
    // Kimchi — refrigerated, 14 días (warning)
    { productId: pMap['KIMCHI-JONGGA'],     lot: 'L2501-F', quantity: 15, expiresAt: daysFromNow(14),  location: 'fridge' },
    // Bebidas — Milkis 5 días → alerta urgente, Aloe 60 días
    { productId: pMap['MILKIS-250'],        lot: 'L2501-G', quantity: 48, expiresAt: daysFromNow(5),   location: 'main' },
    { productId: pMap['OKF-ALOE-500'],      lot: 'L2501-H', quantity: 36, expiresAt: daysFromNow(120), location: 'main' },
    // Congelados — 180 días
    { productId: pMap['BIBIGO-MANDU-400'],  lot: 'L2501-I', quantity: 20, expiresAt: daysFromNow(180), location: 'freezer' },
    // K-Beauty — 365 días
    { productId: pMap['COSRX-SNAIL-100'],   lot: 'L2501-J', quantity: 25, expiresAt: daysFromNow(365), location: 'main' },
  ]

  // Filtrar lotes con productId válido
  const validLots = inventoryLots.filter(l => !!l.productId)
  if (validLots.length > 0) {
    await db.insert(schema.inventory).values(validLots).onConflictDoNothing()
    console.log(`   Lotes de inventario: ${validLots.length}`)
  }

  console.log('\n✅ Seed completado')
  console.log('   - tiendaConfig: 7 entradas')
  console.log('   - Categorías: 8')
  console.log('   - Productos: 10 (con barcodes EAN-13)')
  console.log('   - Lotes de inventario: 10')
  console.log('\n⚠️  Confirmar con dueño Seoul Kims:')
  console.log('   - metro_station_name (¿Miramar?)')
  console.log('   - store_address y store_rut')
  console.log('   - dte_provider (bsale/toku/haulmer)')
}

main().catch(console.error)
