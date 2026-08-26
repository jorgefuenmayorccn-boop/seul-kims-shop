import type { DteRequest, DteResponse } from '../types'
import { DteRetryableError, DteFatalError } from '../errors'

// OpenFactura / Haulmer — proveedor DTE recomendado para Chile retail
// Docs: https://developers.haulmer.com/openfactura
// Activar: set DTE_API_KEY via wrangler secret put
export async function openFacturaEmit(
  req:    DteRequest,
  apiKey: string,
  rutEmisor: string,
): Promise<DteResponse> {
  const res = await fetch('https://api.haulmer.com/v2/dte/document', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'apikey':          apiKey,
      'Idempotency-Key': req.idempotencyKey,
    },
    body: JSON.stringify({
      dte: {
        Encabezado: {
          IdDoc: {
            TipoDTE: req.type === 'factura' ? 33 : 39,  // 39=boleta, 33=factura
            Folio:   0,   // el proveedor asigna folio
            FchEmis: new Date().toISOString().split('T')[0],
          },
          Emisor: {
            RUTEmisor: rutEmisor,
          },
          ...(req.receiver ? {
            Receptor: {
              RUTRecep:   req.receiver.rut,
              RznSocRecep: req.receiver.razonSocial,
              GiroRecep:   req.receiver.giro,
              DirRecep:    req.receiver.direccion,
              CmnaRecep:   req.receiver.comuna,
            },
          } : {}),
          Totales: {
            MntNeto: req.totalNet,
            TasaIVA: req.type === 'factura' ? 19 : 0,
            IVA:     req.totalIva,
            MntTotal: req.totalGross,
          },
        },
        Detalle: req.items.map((item, i) => ({
          NroLinDet: i + 1,
          NmbItem:   item.name.slice(0, 80),
          QtyItem:   item.qty,
          PrcItem:   item.unitPrice,
          MontoItem: item.qty * item.unitPrice,
        })),
      },
    }),
  })

  if (res.status === 429 || res.status >= 500) {
    throw new DteRetryableError(`OpenFactura ${res.status}`, String(res.status))
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new DteFatalError(`OpenFactura ${res.status}: ${body}`, String(res.status))
  }

  const data = await res.json() as {
    folio:   number
    trackId: string
    ted:     string
    urlPdf?: string
    timbre:  string
  }

  return {
    folio:   data.folio,
    trackId: data.trackId,
    ted:     data.ted,
    pdfUrl:  data.urlPdf,
    timbre:  new Date(data.timbre),
  }
}
