import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { buildPDFUrl } from '../lib/whatsapp'
import type { Bindings } from '../index'
import { orders, orderItems, products, orderPayments, dteEvents } from '@seul/db/schema'
import { generateBoletaBuffer } from '@seul/pdf-templates'
import type { BoletaData, BoletaItem } from '@seul/pdf-templates'
import { emitDte } from '@seul/dte'
import type { DteRequest } from '@seul/dte'

const router = new Hono<{ Bindings: Bindings }>()

// GET /api/dte/:token — sirve el PDF desde R2 (ruta pública con TTL)
router.get('/:token', async (c) => {
  const { token } = c.req.param()

  // Validar que el token existe y no expiró
  const db = getDb(c.env)
  const [order] = await db.select({ id: orders.id, pdfToken: orders.pdfToken, pdfExpiresAt: orders.pdfExpiresAt })
    .from(orders)
    .where(eq(orders.pdfToken, token))

  if (!order) return c.json({ error: 'Documento no encontrado' }, 404)
  if (order.pdfExpiresAt && new Date(order.pdfExpiresAt) < new Date()) {
    return c.json({ error: 'Este enlace ha expirado. Contáctanos al +56936451991.' }, 410)
  }

  const object = await c.env.PDF_BUCKET.get(`boletas/${token}.pdf`)
  if (!object) return c.json({ error: 'PDF no disponible aún' }, 404)

  const headers = new Headers()
  headers.set('Content-Type', 'application/pdf')
  headers.set('Content-Disposition', `inline; filename="boleta-${token}.pdf"`)
  headers.set('Cache-Control', 'private, max-age=3600')

  return new Response(object.body, { headers })
})

// --- Queue consumer (llamado desde index.ts) ---

export async function processDTEMessage(
  orderId: string,
  attempt: number,
  env: Bindings
): Promise<void> {
  const db = getDb(env)

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  if (!order) return

  // nota_venta solo genera PDF interno — no necesita proveedor DTE real
  if (order.dteType === 'nota_venta') {
    await processNotaDeVenta(order, orderId, attempt, env, db)
    return
  }

  // boleta / factura → proveedor DTE
  await processDteReal(order, orderId, attempt, env, db)
}

async function processNotaDeVenta(
  order: typeof orders.$inferSelect,
  orderId: string,
  _attempt: number,
  env: Bindings,
  db: ReturnType<typeof getDb>
): Promise<void> {
  try {
    // Idempotencia: ya generada
    if (order.pdfUrl) return

    // Cargar items para el PDF
    const items = await db.select({
      name:      products.name,
      quantity:  orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      subtotal:  orderItems.subtotal,
      isBaes:    orderItems.isBaes,
    })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId))

    // Generar PDF usando el mismo builder de boleta (tipo = nota_venta)
    const boletaData: BoletaData = {
      folio:      String(order.number).padStart(6, '0'),
      fecha:      new Date(order.createdAt ?? Date.now()),
      channel:    order.channel,
      items:      items.map(i => ({
        name:      i.name ?? '—',
        quantity:  parseFloat(i.quantity),
        unitPrice: parseInt(i.unitPrice),
        subtotal:  parseInt(i.subtotal),
        isBaes:    i.isBaes ?? false,
      })),
      subtotal:     parseInt(order.subtotal),
      baesAmount:   parseInt(order.baesAmount ?? '0'),
      total:        parseInt(order.total),
      deliveryMode: order.deliveryMode,
      documentType: 'nota_venta',
    }

    const pdfBuffer = await generateBoletaBuffer(boletaData)
    const token = order.pdfToken ?? crypto.randomUUID().replace(/-/g, '').slice(0, 16)

    await env.PDF_BUCKET.put(`notas-venta/${token}.pdf`, pdfBuffer, {
      httpMetadata:   { contentType: 'application/pdf' },
      customMetadata: { orderId, type: 'nota_venta', number: String(order.number) },
    })

    const pdfUrl = buildPDFUrl(token)

    await db.update(orders)
      .set({ dteStatus: 'issued', pdfToken: token, pdfUrl, updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    console.info('[NOTA_VENTA_ISSUED]', { orderId, number: order.number, pdfUrl })

  } catch (err) {
    console.error('[NOTA_VENTA_FAILED]', { orderId, err })
    // No marcar como failed — la nota de venta es best-effort
    await db.update(orders)
      .set({ dteStatus: 'issued', updatedAt: new Date() })
      .where(eq(orders.id, orderId))
  }
}

async function processDteReal(
  order: typeof orders.$inferSelect,
  orderId: string,
  attempt: number,
  env: Bindings,
  db: ReturnType<typeof getDb>
): Promise<void> {
  // Idempotencia: no emitir si ya tiene folio
  if (order.dteFolio) return

  await db.update(orders)
    .set({ dteStatus: 'sending', updatedAt: new Date() })
    .where(eq(orders.id, orderId))

  // Cargar ítems y pagos
  const items = await db.select({
    name:      products.name,
    quantity:  orderItems.quantity,
    unitPrice: orderItems.unitPrice,
    subtotal:  orderItems.subtotal,
    isBaes:    orderItems.isBaes,
  })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId))

  const payments = await db.select()
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId))

  const req: DteRequest = {
    type:           order.dteType as 'boleta' | 'factura',
    idempotencyKey: `${orderId}-${attempt}`,
    emitter: {
      rut:         env.DTE_RUT_EMPRESA ?? '',
      razonSocial: 'SEOUL KIMS',
      giro:        'COMERCIO AL POR MENOR',
      direccion:   'CONFIRMAR DIRECCION',
      comuna:      'VIÑA DEL MAR',
    },
    ...(order.receiverRut ? {
      receiver: {
        rut:         order.receiverRut,
        razonSocial: order.receiverName ?? '',
        giro:        order.receiverGiro ?? '',
        direccion:   order.receiverAddress ?? '',
        comuna:      order.receiverComuna ?? '',
      },
    } : {}),
    items:      items.map(i => ({ name: i.name ?? '—', qty: parseFloat(i.quantity), unitPrice: parseInt(i.unitPrice) })),
    payments:   payments.map(p => ({ method: p.method, amount: parseInt(p.amount) })),
    totalNet:   parseInt(order.total),
    totalIva:   0,   // boleta consumidor final: exenta IVA
    totalGross: parseInt(order.total),
  }

  try {
    const provider = env.DTE_API_KEY ? 'openfactura' : 'mock'
    const dteResponse = await emitDte(req, env)

    await db.insert(dteEvents).values({
      orderId,
      attempt,
      status:          'sent',
      provider,
      requestPayload:  req as unknown as Record<string, unknown>,
      responsePayload: dteResponse as unknown as Record<string, unknown>,
    })

    // Generar PDF local si el proveedor no entrega PDF (mock)
    let finalPdfUrl = dteResponse.pdfUrl
    if (!finalPdfUrl) {
      const boletaItems: BoletaItem[] = items.map(i => ({
        name:      i.name ?? '—',
        quantity:  parseFloat(i.quantity),
        unitPrice: parseInt(i.unitPrice),
        subtotal:  parseInt(i.subtotal),
        isBaes:    i.isBaes ?? false,
      }))
      const boletaData: BoletaData = {
        folio:        String(dteResponse.folio),
        fecha:        new Date(order.createdAt ?? Date.now()),
        channel:      order.channel,
        items:        boletaItems,
        subtotal:     parseInt(order.subtotal),
        baesAmount:   parseInt(order.baesAmount ?? '0'),
        total:        parseInt(order.total),
        deliveryMode: order.deliveryMode,
        dteTimbre:    dteResponse.ted,   // TED XML string (no el Date de timbre)
      }
      const pdfBuffer = await generateBoletaBuffer(boletaData)
      const token = order.pdfToken ?? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      await env.PDF_BUCKET.put(`boletas/${token}.pdf`, pdfBuffer, {
        httpMetadata:   { contentType: 'application/pdf' },
        customMetadata: { orderId, folio: String(dteResponse.folio) },
      })
      finalPdfUrl = buildPDFUrl(token)
    }

    await db.update(orders)
      .set({
        dteStatus:  'issued',
        dteFolio:   String(dteResponse.folio),
        dteTrackId: dteResponse.trackId,
        dteProvider: env.DTE_API_KEY ? 'openfactura' : 'mock',
        pdfUrl:     finalPdfUrl ?? null,
        updatedAt:  new Date(),
      })
      .where(eq(orders.id, orderId))

    console.info('[DTE_ISSUED]', { orderId, folio: dteResponse.folio })

  } catch (err) {
    const isRetryable = err instanceof Error && err.name === 'DteRetryableError'
    const provider = env.DTE_API_KEY ? 'openfactura' : 'mock'

    await db.insert(dteEvents).values({
      orderId,
      attempt,
      status:       'error',
      provider,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorCode:    (err as { code?: string }).code,
    }).catch(() => {}) // no bloquear el flujo si falla el log

    if (isRetryable && attempt < 3) {
      await env.DTE_QUEUE.send(
        { orderId, attempt: attempt + 1 },
        { delaySeconds: 5 * Math.pow(5, attempt - 1) } // 5s, 25s, 125s
      )
      console.warn('[DTE_RETRY]', { orderId, attempt })
    } else {
      await db.update(orders)
        .set({ dteStatus: 'failed', updatedAt: new Date() })
        .where(eq(orders.id, orderId))
      console.error('[DTE_FAILED]', { orderId, attempt, err })
    }
  }
}

export { router as dteRouter }
