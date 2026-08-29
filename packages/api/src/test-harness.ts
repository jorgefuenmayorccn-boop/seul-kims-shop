// ============================================================================
// TEST HARNESS — SESSION 20
// ============================================================================
// Herramienta QA INTERNA de VÉRTICE — NO es parte del entregable al cliente.
// Dispara los 27 emails documentados (aspiracionalmente) en FASE_2_COMPLETADA.md
// para verificar, contra la tabla email_queue real de Neon, cuáles de verdad
// llegan a status='sent'.
//
// - Los que tienen ruta HTTP real la usan (fetch contra apiBaseUrl).
// - Los que NO tienen subsistema real detrás (B2B post-cotización, cron jobs,
//   ciclo driver, pagos/inventario/caja) llaman enqueueEmail() directamente
//   con contenido realista — dejan claro en `real: false` que es simulado.
//
// NO construye pagos, inventario, caja ni el ciclo de vida B2B completo.
// Solo simula el DISPARADOR de esos emails para efectos de esta prueba.
// ============================================================================

import { enqueueEmail, templates } from './email-queue'
import { sql } from './db'

export interface TestEmailResult {
  email: number
  category: 'B2C' | 'B2B' | 'Driver' | 'Admin'
  description: string
  real: boolean // true = disparado vía endpoint HTTP real; false = simulado (enqueueEmail directo)
  status: 'queued' | 'error'
  queue_id?: string
  error?: string
}

async function api(apiBaseUrl: string, method: string, path: string, body?: any) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`)
  return json
}

export async function sendAllTestEmails(emailTo: string, apiBaseUrl: string): Promise<TestEmailResult[]> {
  const results: TestEmailResult[] = []
  const push = (r: TestEmailResult) => { results.push(r); return r }

  const safe = async (
    n: number, category: TestEmailResult['category'], description: string, real: boolean,
    fn: () => Promise<string | undefined>
  ) => {
    try {
      const queue_id = await fn()
      push({ email: n, category, description, real, status: 'queued', queue_id })
    } catch (err) {
      push({ email: n, category, description, real, status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  // ==========================================================================
  // B2C (7) — orden real de principio a fin
  // ==========================================================================
  let orderId: string | undefined
  let orderNumber: number | undefined

  await safe(1, 'B2C', 'Confirmación de pedido al comprar online', true, async () => {
    const order = await api(apiBaseUrl, 'POST', '/api/orders', {
      customer_email: emailTo,
      customer_name: 'Cliente Prueba VÉRTICE',
      items: [{ sku: 'KIMCHI-200', name: 'Kimchi 200g', qty: 2, unitPrice: 3500 }],
      total: 45000,
      delivery_mode: 'delivery',
    })
    orderId = order.order_id
    orderNumber = order.order_number
    return order.queue_ids?.[0]
  })

  await safe(2, 'B2C', '"Preparando" al entrar en preparación', true, async () => {
    const r = await api(apiBaseUrl, 'POST', `/api/orders/${orderId}/status`, {
      status: 'preparando', customer_email: emailTo,
    })
    return r.queue_id
  })

  await safe(3, 'B2C', '"Listo para retiro" (delivery_mode = pickup)', true, async () => {
    // order_status enum real no distingue "listo_retiro" de otros estados intermedios — usa 'lista'
    const r = await api(apiBaseUrl, 'POST', `/api/orders/${orderId}/status`, {
      status: 'lista', customer_email: emailTo,
    })
    return r.queue_id
  })

  await safe(4, 'B2C', '"Despachado / en camino" al salir de bodega', true, async () => {
    const r = await api(apiBaseUrl, 'POST', `/api/orders/${orderId}/status`, {
      status: 'en_ruta', customer_email: emailTo,
    })
    return r.queue_id
  })

  await safe(5, 'B2C', '"En camino" con ETA', true, async () => {
    // Mismo estado 'en_ruta' del enum real — el aspiracional distinguía 2 estados que hoy son 1
    const r = await api(apiBaseUrl, 'POST', `/api/orders/${orderId}/status`, {
      status: 'en_ruta', customer_email: emailTo, eta: '25-35 minutos',
    })
    return r.queue_id
  })

  // Delivery assignment + photo (necesita un assignment válido)
  let assignmentId: string | undefined
  await safe(6, 'B2C', 'Entregado con foto (prueba de entrega)', true, async () => {
    // Crea un assignment ad-hoc para esta orden usando el repartidor de prueba sembrado en Fase A
    const rows = await sql`SELECT id FROM users WHERE role = 'delivery' LIMIT 1`
    const driverId = rows[0]?.id
    if (!driverId) throw new Error('No hay repartidor de prueba sembrado (Paso 2)')
    const assignRows = await sql`
      INSERT INTO delivery_assignments (order_id, driver_id, status)
      VALUES (${orderId}, ${driverId}, 'in_transit')
      RETURNING id
    `
    assignmentId = assignRows[0]?.id
    const r = await api(apiBaseUrl, 'POST', `/api/deliveries/${assignmentId}/photo`, {
      customer_email: emailTo,
    })
    return r.queue_id
  })

  await safe(7, 'B2C', 'Notificación de entrega fallida (al cliente)', false, async () => {
    return enqueueEmail(
      emailTo,
      `⚠️ Problema con tu entrega #${orderNumber ?? '00000'}`,
      `<div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffebee;">
        <h2 style="color: #c62828;">⚠️ No pudimos entregar tu pedido</h2>
        <p>Intentamos entregar tu orden #${orderNumber ?? '00000'} pero no fue posible. Nos pondremos en contacto para coordinar un nuevo intento.</p>
      </div>`,
      'delivery-update'
    )
  })

  // ==========================================================================
  // B2B (9) — cotización real + resto simulado (no existe conversión a orden)
  // ==========================================================================
  const rows = await sql`SELECT id FROM b2b_companies LIMIT 1`
  const companyId = rows[0]?.id
  let quoteNumber: number | undefined
  let quoteId: string | undefined
  let quoteQueueIds: string[] = []

  await safe(8, 'B2B', 'Notificación de cotización creada (admin)', true, async () => {
    if (!companyId) throw new Error('No hay b2b_companies sembrada (Paso 1)')
    const q = await api(apiBaseUrl, 'POST', '/api/b2b/quotes', {
      company_id: companyId,
      buyer_name: 'Comprador Mayorista Prueba',
      buyer_email: emailTo,
      items: [{ sku: 'KIMCHI-1KG', qty: 20, unitPrice: 12000 }],
      total: 240000,
      valid_days: 7,
    })
    quoteNumber = q.quote_number
    quoteQueueIds = q.queue_ids ?? []
    const qRow = await sql`SELECT id FROM b2b_quotes WHERE number = ${quoteNumber} LIMIT 1`
    quoteId = qRow[0]?.id
    return quoteQueueIds[1] // admin copy
  })

  await safe(9, 'B2B', 'Cotización enviada al comprador', true, async () => {
    // Mismo endpoint que #8 dispara ambos emails; este es el leg del comprador (buyer_email)
    return quoteQueueIds[0]
  })

  await safe(10, 'B2B', 'Cotización aceptada por el comprador', true, async () => {
    if (!quoteId) throw new Error('No hay quoteId de #8/#9')
    const r = await api(apiBaseUrl, 'POST', `/api/b2b/quotes/${quoteId}/accept`, {})
    return r.queue_id
  })

  await safe(11, 'B2B', 'Cotización rechazada por el comprador', true, async () => {
    // Crea una 2da cotización de prueba solo para probar el flujo de rechazo
    if (!companyId) throw new Error('No hay b2b_companies sembrada (Paso 1)')
    const q = await api(apiBaseUrl, 'POST', '/api/b2b/quotes', {
      company_id: companyId, buyer_name: 'Comprador Prueba Rechazo', buyer_email: emailTo,
      items: [{ sku: 'KIMCHI-1KG', qty: 5, unitPrice: 12000 }], total: 60000, valid_days: 7,
    })
    const qRow = await sql`SELECT id FROM b2b_quotes WHERE number = ${q.quote_number} LIMIT 1`
    const r = await api(apiBaseUrl, 'POST', `/api/b2b/quotes/${qRow[0].id}/reject`, { reason: 'Precio no competitivo (prueba)' })
    return r.queue_id
  })

  const quoteForSim = { number: quoteNumber ?? 99999, total: 240000 }
  await safe(12, 'B2B', 'Confirmación de orden generada desde cotización', false, () =>
    enqueueEmail(emailTo, `✅ Orden B2B Confirmada (desde Cotización #${quoteForSim.number})`, templates.b2bOrderConfirmation(quoteForSim), 'order-confirmation'))

  await safe(13, 'B2B', 'Orden B2B en preparación', false, () =>
    enqueueEmail(emailTo, `📦 Orden B2B #${quoteForSim.number}: PREPARANDO`, templates.b2bOrderStatus(quoteForSim, 'preparando'), 'delivery-update'))

  await safe(14, 'B2B', 'Orden B2B despachada', false, () =>
    enqueueEmail(emailTo, `🚚 Orden B2B #${quoteForSim.number}: EN RUTA`, templates.b2bOrderStatus(quoteForSim, 'en_ruta'), 'order-shipped'))

  await safe(15, 'B2B', 'Orden B2B entregada', false, () =>
    enqueueEmail(emailTo, `✅ Orden B2B #${quoteForSim.number}: ENTREGADA`, templates.b2bOrderStatus(quoteForSim, 'entregada'), 'order-delivered'))

  await safe(16, 'B2B', 'Factura enviada', false, () =>
    enqueueEmail(emailTo, `🧾 Factura — Orden B2B #${quoteForSim.number}`, templates.invoiceSent(quoteForSim), 'invoice'))

  // ==========================================================================
  // Driver (5) — asignación real + resto simulado (no hay cron ni flujo driver completo)
  // ==========================================================================
  await safe(17, 'Driver', 'Notificación de entrega asignada', true, async () => {
    const driverRows = await sql`SELECT id FROM users WHERE role = 'delivery' LIMIT 1`
    const orderRows = await sql`SELECT id FROM orders ORDER BY created_at DESC LIMIT 1`
    const assignRows = await sql`
      INSERT INTO delivery_assignments (order_id, driver_id, status) VALUES (${orderRows[0].id}, ${driverRows[0].id}, 'pending') RETURNING id
    `
    const r = await api(apiBaseUrl, 'POST', '/api/deliveries/assign', {
      assignment_id: assignRows[0].id, driver_id: driverRows[0].id, driver_email: emailTo,
    })
    return r.queue_id
  })

  await safe(18, 'Driver', 'Briefing diario (8am, cron)', false, () =>
    enqueueEmail(emailTo, '☀️ Briefing Diario — Seoul Shop', templates.driverDailyBriefing('Repartidor de Prueba', 6), 'delivery-update'))

  await safe(19, 'Driver', 'Recordatorio de entrega pendiente', false, () =>
    enqueueEmail(emailTo, `⏰ Recordatorio de Entrega #${orderNumber ?? '00000'}`, templates.driverReminder(orderNumber ?? 0), 'delivery-update'))

  await safe(20, 'Driver', 'Confirmación de comprobante enviado', false, () =>
    enqueueEmail(emailTo, `✅ Comprobante Recibido — Orden #${orderNumber ?? '00000'}`, templates.driverProofSubmitted(orderNumber ?? 0), 'delivery-update'))

  await safe(21, 'Driver', 'Resumen de jornada/turno', false, () =>
    enqueueEmail(emailTo, '📋 Resumen de Jornada', templates.driverShiftSummary('Repartidor de Prueba', 8, '24.000'), 'delivery-update'))

  // ==========================================================================
  // Admin (6) — alertas reales (pedido grande, entrega fallida) + resto simulado
  // ==========================================================================
  await safe(22, 'Admin', 'Alerta de pedido grande (≥ $2.000.000)', true, async () => {
    const order = await api(apiBaseUrl, 'POST', '/api/orders', {
      customer_email: emailTo, customer_name: 'Cliente Pedido Grande',
      items: [{ sku: 'KIMCHI-1KG', qty: 200, unitPrice: 12000 }],
      total: 2400000, delivery_mode: 'delivery',
    })
    return order.queue_ids?.[2] // 3er queue_id = alerta de pedido grande
  })

  await safe(23, 'Admin', 'Alerta de entrega fallida', true, async () => {
    if (!assignmentId) throw new Error('No hay assignmentId de #6')
    const r = await api(apiBaseUrl, 'POST', `/api/deliveries/${assignmentId}/status`, { status: 'failed' })
    return r.queue_id
  })

  await safe(24, 'Admin', 'Problema de pago', false, () =>
    enqueueEmail(emailTo, `💳 Problema de Pago — Orden #${orderNumber ?? '00000'}`, templates.paymentIssue(orderNumber ?? 0), 'delivery-update'))

  await safe(25, 'Admin', 'Reporte de ventas diario (11pm, cron)', false, () =>
    enqueueEmail(emailTo, `📊 Reporte de Ventas — ${new Date().toLocaleDateString('es-CL')}`, templates.dailySalesReport(new Date().toLocaleDateString('es-CL'), '1.240.000', 14), 'delivery-update'))

  await safe(26, 'Admin', 'Alerta de stock bajo', false, () =>
    enqueueEmail(emailTo, '📉 Stock Bajo: Kimchi 200g', templates.stockLowAlert('Kimchi 200g', 3), 'delivery-update'))

  await safe(27, 'Admin', 'Notificación de efectivo recolectado', false, () =>
    enqueueEmail(emailTo, '💵 Efectivo Recolectado', templates.cashCollected('Repartidor de Prueba', '45.000'), 'delivery-update'))

  return results
}
