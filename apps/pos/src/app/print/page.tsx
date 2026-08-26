'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Suspense } from 'react'

// Los datos llegan por searchParams (pasados por CheckoutShell al confirmar)
// En F3 (DTE real) esta página consumirá el PDF de R2 directamente.

interface PrintData {
  number:      string
  date:        string
  items:       string   // JSON
  subtotal:    string
  baesAmount?: string
  total:       string
  payments:    string   // JSON
  cashReceived?: string
  change?:     string
  cashier?:    string
}

function PrintContent() {
  const params    = useSearchParams()
  const printedRef = useRef(false)

  const number      = params.get('number') ?? '000000'
  const date        = params.get('date') ?? new Date().toISOString()
  const itemsRaw    = params.get('items') ?? '[]'
  const subtotal    = Number(params.get('subtotal') ?? 0)
  const baesAmount  = Number(params.get('baesAmount') ?? 0)
  const total       = Number(params.get('total') ?? 0)
  const paymentsRaw = params.get('payments') ?? '[]'
  const cashReceived = Number(params.get('cashReceived') ?? 0)
  const change      = Number(params.get('change') ?? 0)
  const cashier     = params.get('cashier') ?? ''

  type Item     = { name: string; quantity: number; unitPrice: number; isBaes?: boolean }
  type Payment  = { method: string; amount: number }

  let items:    Item[]    = []
  let payments: Payment[] = []

  try { items    = JSON.parse(decodeURIComponent(itemsRaw))    } catch { /**/ }
  try { payments = JSON.parse(decodeURIComponent(paymentsRaw)) } catch { /**/ }

  const dateObj = new Date(date)
  const dateStr = dateObj.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  function formatCLP(n: number) {
    return '$' + n.toLocaleString('es-CL')
  }

  function methodLabel(m: string) {
    const map: Record<string, string> = {
      cash: 'Efectivo', debit: 'Debito',
      credit: 'Credito', qr: 'Transferencia', baes: 'BAES',
    }
    return map[m] ?? m
  }

  // Auto-imprimir al cargar
  useEffect(() => {
    if (printedRef.current) return
    printedRef.current = true
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="nota-wrapper">
      {/* Encabezado tienda */}
      <div className="center bold">SEOUL KIMS</div>
      <div className="center">COMERCIO AL POR MENOR</div>
      <div className="center small">CONFIRMAR DIRECCION</div>
      <div className="center small">RUT: XX.XXX.XXX-X</div>
      <div className="center small">seoulkims.cl</div>

      <div className="line" />
      <div className="center bold">*** NOTA DE VENTA ***</div>
      <div className="center small">(No es documento tributario)</div>
      <div className="line" />

      <div className="row">
        <span>N° {number.toString().padStart(6, '0')}</span>
        <span>{dateStr}</span>
      </div>
      {cashier && <div className="small">Cajera: {cashier}</div>}

      <div className="line-thin" />

      {/* Items */}
      {items.map((item, i) => (
        <div key={i} className="item-block">
          <div className="item-name">
            {item.name}{item.isBaes ? ' [BAES]' : ''}
          </div>
          <div className="row small">
            <span>{item.quantity} x {formatCLP(item.unitPrice)}</span>
            <span className="bold">{formatCLP(item.quantity * item.unitPrice)}</span>
          </div>
        </div>
      ))}

      <div className="line-thin" />

      {/* Totales */}
      {baesAmount > 0 && (
        <>
          <div className="row"><span>Subtotal:</span><span>{formatCLP(subtotal)}</span></div>
          <div className="row"><span>Subsidio BAES:</span><span>- {formatCLP(baesAmount)}</span></div>
          <div className="line-thin" />
        </>
      )}
      <div className="row bold"><span>TOTAL:</span><span>{formatCLP(total)}</span></div>

      <div className="spacer" />

      {/* Pagos */}
      {payments.map((p, i) => (
        <div key={i} className="row small">
          <span>{methodLabel(p.method)}:</span>
          <span>{formatCLP(p.amount)}</span>
        </div>
      ))}
      {cashReceived > 0 && (
        <div className="row small"><span>Recibido:</span><span>{formatCLP(cashReceived)}</span></div>
      )}
      {change > 0 && (
        <div className="row bold"><span>VUELTO:</span><span>{formatCLP(change)}</span></div>
      )}

      <div className="line" />

      {/* Pie */}
      <div className="spacer" />
      <div className="center korean">감사합니다</div>
      <div className="center small">Gracias por su compra</div>
      <div className="center small">또 오세요 — Vuelva pronto</div>
      <div className="spacer" />
      <div className="center small">@seulshopcl</div>
      <div className="spacer" />
      <div className="center small">* Documento sin valor tributario *</div>
      <div className="center small">Boleta electronica disponible pronto</div>
      <div className="spacer" />
      <div className="cut-line" />
    </div>
  )
}

export default function PrintPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.4;
          color: #000;
          background: #fff;
        }

        .nota-wrapper {
          width: 72mm;
          margin: 0 auto;
          padding: 4mm 0;
        }

        .center { text-align: center; }
        .bold   { font-weight: bold; }
        .small  { font-size: 9px; }
        .korean {
          font-family: 'Noto Sans KR', sans-serif;
          font-weight: 700;
          font-size: 16px;
          text-align: center;
          margin: 2mm 0;
        }

        .line      { border-top: 1px solid #000; margin: 2mm 0; }
        .line-thin { border-top: 1px dashed #555; margin: 1.5mm 0; }
        .spacer    { height: 2mm; }
        .cut-line  {
          border-top: 1px dashed #999;
          margin-top: 4mm;
          position: relative;
        }
        .cut-line::after {
          content: '✂';
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: #999;
          background: #fff;
          padding: 0 2px;
        }

        .row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin: 0.5mm 0;
        }

        .item-block { margin: 1mm 0; }
        .item-name  { font-size: 10px; font-weight: bold; }

        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body { -webkit-print-color-adjust: exact; }
          .cut-line { display: none; }
        }

        @media screen {
          body { background: #f0f0f0; }
          .nota-wrapper {
            margin: 10mm auto;
            background: #fff;
            padding: 8mm;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
          }
        }
      `}</style>

      <Suspense fallback={<div style={{ padding: 16, fontFamily: 'monospace' }}>Preparando nota de venta...</div>}>
        <PrintContent />
      </Suspense>
    </>
  )
}
