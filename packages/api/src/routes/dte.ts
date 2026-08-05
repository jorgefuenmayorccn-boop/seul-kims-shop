import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../lib/db'
import type { Bindings } from '../index'
import { orders } from '@seul/db/schema'

const router = new Hono<{ Bindings: Bindings }>()

// Cloudflare Queue consumer — procesa DTE
// Se llama desde el queue handler en index.ts, no como ruta HTTP
export async function processDTEMessage(
  orderId: string,
  attempt: number,
  env: Bindings
): Promise<void> {
  const db = getDb(env)

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  if (!order) return

  try {
    // Llamada al proveedor DTE (Bsale / Toku / Haulmer)
    // Configurado en tiendaConfig.dte_provider
    const dteResponse = await callDTEProvider(order, env)

    await db.update(orders)
      .set({
        dteStatus: 'issued',
        dteFolio: dteResponse.folio,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))

    // Generar PDF con timbre SII y subir a R2
    await uploadBoletaToR2(order, dteResponse, env)

  } catch (err) {
    const nextAttempt = attempt + 1
    if (nextAttempt <= 3) {
      // Reencolar con delay exponencial
      await env.DTE_QUEUE.send(
        { orderId, attempt: nextAttempt },
        { delaySeconds: Math.pow(2, attempt) * 30 }
      )
    } else {
      // 3 intentos fallidos → marcar como fallido (visible en dashboard)
      await db.update(orders)
        .set({ dteStatus: 'failed', updatedAt: new Date() })
        .where(eq(orders.id, orderId))

      // Sentry alert — crítico
      console.error('[DTE_FAILED]', { orderId, attempt, err })
    }
  }
}

async function callDTEProvider(order: typeof orders.$inferSelect, env: Bindings) {
  // Placeholder — implementar según proveedor elegido (Bsale/Toku/Haulmer)
  // La firma debe ser idéntica para que sea swappable
  const provider = 'bsale' // leer de tiendaConfig.dte_provider en producción
  void provider

  // Bsale example:
  // POST https://api.bsale.cl/v1/documents.json
  // Authorization: access_token env.DTE_API_KEY

  throw new Error('DTE provider not configured — set DTE_API_KEY and choose provider')
}

async function uploadBoletaToR2(
  order: typeof orders.$inferSelect,
  dteResponse: { folio: string; timbre: string },
  env: Bindings
) {
  // Generar PDF con PDFKit en Worker (Edge runtime)
  // El Worker no puede usar Node.js pdfkit directamente
  // Opción: usar jsPDF (browser-compatible) o servicio externo
  // Implementar en Fase 2.5
  void order; void dteResponse; void env
}

export { router as dteRouter }
