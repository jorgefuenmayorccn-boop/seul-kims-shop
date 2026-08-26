// Crea un pedido delivery de prueba para ver el flujo completo
// Ejecutar CON API corriendo: DATABASE_URL=... npx tsx packages/db/src/seed-demo-order.ts

const API_URL = process.env.API_URL ?? 'http://localhost:8787'

async function main() {
  console.log('📦 Creando pedido demo via API...')
  console.log(`   API: ${API_URL}`)

  // Obtener productos por barcode
  const skus = [
    { barcode: '8801073110458', qty: 2 },  // Buldak 2x
    { barcode: '8809020115109', qty: 1 },  // Kimchi Jongga
    { barcode: '8801056136017', qty: 3 },  // Milkis
  ]

  const items: Array<{ productId: string; quantity: number; unitPrice: number; isBaes: boolean }> = []

  for (const { barcode, qty } of skus) {
    const res = await fetch(`${API_URL}/api/products/barcode/${barcode}`)
    if (!res.ok) {
      console.warn(`   ⚠️ Barcode ${barcode} no encontrado (HTTP ${res.status}) — omitiendo`)
      continue
    }
    const product = await res.json() as { id: string; priceRetail: string | number }
    items.push({
      productId: product.id,
      quantity:  qty,
      unitPrice: Number(product.priceRetail),
      isBaes:    false,
    })
    console.log(`   ✓ Producto ${barcode}: ${qty}x $${Number(product.priceRetail).toLocaleString('es-CL')}`)
  }

  if (items.length === 0) {
    console.error('❌ No se encontraron productos — ¿está corriendo el API y el seed aplicado?')
    process.exit(1)
  }

  // Crear el pedido
  const orderRes = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel:      'web',
      deliveryMode: 'metro',
      metroStation: 'Miramar',
      metroSlot:    '15:00-17:00',
      items,
    }),
  })

  if (!orderRes.ok) {
    const err = await orderRes.text()
    console.error('❌ Error creando pedido:', err)
    process.exit(1)
  }

  const order = await orderRes.json() as { number: number; orderId: string; total: number }
  console.log(`\n✅ Pedido demo creado: #${order.number}`)
  console.log(`   ID: ${order.orderId}`)
  console.log(`   Total: $${order.total.toLocaleString('es-CL')} CLP`)
  console.log(`   Canal: web · Metro Miramar 15:00-17:00`)
  console.log('\n   Verifica en http://localhost:3000/cerebro/dashboard → "Últimos pedidos"')
  console.log('   El inventario de Buldak, Kimchi y Milkis se descontó automáticamente (FIFO)')
}

main().catch(e => { console.error(e); process.exit(1) })
