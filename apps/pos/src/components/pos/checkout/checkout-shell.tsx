'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { formatCLP } from '@seul/ui'
import { ColdChainAlert } from '@seul/ui/pos/cold-chain-alert'
import { MethodPicker } from './method-picker'
import { PayCash } from './pay-cash'
import { PayCard } from './pay-card'
import { PayBAES } from './pay-baes'
import { PayQR } from './pay-qr'
import { PayMixed } from './pay-mixed'
import { TenderSummary } from './tender-summary'
import { IconClose, IconCheck, IconPrint } from '../../icons/pos-icons'
import { AlertTriangle } from 'lucide-react'
import { calcChange, tenderMethodLabel, type PaymentMethodId, type Tender } from '@/lib/payment-methods'
import type { BAESSession } from '@/lib/pos-store'
import { validateRut, formatRut } from '@seul/dte'
import { printTicket, getCachedMode } from '@/lib/print-service'
import type { TicketPayload, PrintStatus } from '@seul/pdf-templates/client'
import { STORE_INFO } from '@seul/pdf-templates/client'

type Step = 'method' | 'pay' | 'summary' | 'success'
type DteType = 'nota_venta' | 'boleta' | 'factura'
type DteStatus = 'pending' | 'sending' | 'issued' | 'accepted_sii' | 'rejected_sii' | 'failed'

interface Receiver {
  rut:         string
  razonSocial: string
  giro:        string
  direccion:   string
  comuna:      string
}

interface CheckoutShellProps {
  subtotal:           number
  baesAmount:         number
  total:              number
  hasFrozen:          boolean
  hasRefrigerated:    boolean
  baesSession:        BAESSession | null
  cashierName?:       string
  shiftNumber?:       number
  tillSessionNumber?: number
  deliveryMode?:      string   // 'rappi' → solo transferencia
  onBAESValidated:    (s: BAESSession | null) => void
  onConfirm:          (tenders: Tender[], dteType: DteType, receiver?: Receiver) => Promise<{ orderId: string; number: number; dteStatus?: string }>
  onClose:            () => void
  apiUrl:             string
  cartItems:          Array<{ id: string; name: string; quantity: number; unitPrice: number; isBaes?: boolean }>
}

const AUTO_DISMISS_MS = 5000

export function CheckoutShell({
  subtotal, baesAmount, total,
  hasFrozen, hasRefrigerated,
  baesSession, onBAESValidated,
  onConfirm, onClose, apiUrl,
  cartItems, cashierName, shiftNumber, tillSessionNumber,
  deliveryMode,
}: CheckoutShellProps) {
  const isRappi = deliveryMode === 'rappi'
  const [step,         setStep]         = useState<Step>('method')
  const [method,       setMethod]       = useState<PaymentMethodId | null>(null)
  const [tenders,      setTenders]      = useState<Tender[]>([])
  const [payReady,     setPayReady]     = useState(false)
  const [cashReceived, setCashReceived] = useState(0)
  const [loading,      setLoading]      = useState(false)

  // DTE state — default y única opción real hoy es 'nota_venta' (ver botones
  // DOCUMENTO más abajo: Boleta/Factura están deshabilitadas hasta que se
  // conecte un proveedor DTE real, decisión de negocio pendiente post-v1.0).
  const [dteType,   setDteType]   = useState<DteType>('nota_venta')
  const [receiver,  setReceiver]  = useState<Receiver>({ rut: '', razonSocial: '', giro: '', direccion: '', comuna: '' })
  const [rutError,  setRutError]  = useState('')

  // Post-confirm
  const [orderId,      setOrderId]      = useState<string | null>(null)
  const [orderNumber,  setOrderNumber]  = useState<number | null>(null)
  const [dteStatus,    setDteStatus]    = useState<DteStatus>('pending')
  const [dteFolio,     setDteFolio]     = useState<string | null>(null)
  const [pdfUrl,       setPdfUrl]       = useState<string | null>(null)

  // Impresión
  const [printStatus,  setPrintStatus]  = useState<PrintStatus>('idle')
  const [printError,   setPrintError]   = useState('')

  // Error modal
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)

  // Countdown auto-dismiss
  const [countdown,    setCountdown]    = useState(AUTO_DISMISS_MS)
  const [paused,       setPaused]       = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // DTE polling
  useEffect(() => {
    if (!orderId || dteStatus === 'issued' || dteStatus === 'accepted_sii' || dteStatus === 'failed') return
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${apiUrl}/api/orders/${orderId}/dte-status`)
        const data = await res.json() as { status: DteStatus; folio?: string; pdfUrl?: string }
        setDteStatus(data.status)
        if (data.folio)  setDteFolio(data.folio)
        if (data.pdfUrl) setPdfUrl(data.pdfUrl)
      } catch { /* silent */ }
    }, 2000)
    const maxPoll = setTimeout(() => clearInterval(interval), 30_000)
    return () => { clearInterval(interval); clearTimeout(maxPoll) }
  }, [orderId, dteStatus, apiUrl])

  // Countdown + auto-dismiss (solo en success, no si error de impresión)
  useEffect(() => {
    if (step !== 'success') return
    if (printStatus === 'error') return   // no cerrar con error de impresión
    if (paused) return

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 100) {
          clearInterval(countdownRef.current!)
          onClose()
          return 0
        }
        return prev - 100
      })
    }, 100)

    return () => clearInterval(countdownRef.current!)
  }, [step, paused, printStatus, onClose])

  const change = method === 'cash' || method === 'mixed'
    ? calcChange(cashReceived, total)
    : 0

  function buildTenders(): Tender[] {
    if (tenders.length > 0) return tenders
    if (!method || method === 'mixed' || method === 'baes') return []
    return [{ method: method as Tender['method'], amount: total }]
  }

  const handleSelectMethod = (m: PaymentMethodId) => {
    setMethod(m)
    setPayReady(false)
    setTenders([])
    setCashReceived(0)
    setStep('pay')
  }

  const handlePayReady = useCallback((received?: number) => {
    setPayReady(true)
    if (received !== undefined) setCashReceived(received)
  }, [])

  const handlePayNotReady = useCallback(() => setPayReady(false), [])

  const isReceiverValid = dteType !== 'factura' || (
    receiver.rut !== '' && validateRut(receiver.rut) &&
    receiver.razonSocial !== '' && receiver.giro !== '' &&
    receiver.direccion !== '' && receiver.comuna !== ''
  )

  function buildTicketPayload(result: { orderId: string; number: number; dteStatus?: string }): TicketPayload {
    const finalTenders = buildTenders()
    return {
      orderId:            result.orderId,
      ticketType:         dteType,
      number:             result.number,
      date:               new Date().toISOString(),
      cashier:            cashierName,
      shiftNumber,
      tillSessionNumber,
      dteStatus:          result.dteStatus,
      items:        cartItems.map(i => ({
        name:      i.name,
        qty:       i.quantity,
        unitPrice: i.unitPrice,
        subtotal:  i.unitPrice * i.quantity,
        isBaes:    i.isBaes ?? false,
      })),
      subtotal,
      baesAmount,
      total,
      payments: finalTenders.map(t => ({
        method: t.method,
        amount: t.amount,
        label:  tenderMethodLabel(t.method),
      })),
      cashReceived: cashReceived > 0 ? cashReceived : undefined,
      change:       change > 0 ? change : undefined,
      receiver:     dteType === 'factura' ? receiver : undefined,
      storeInfo:    { ...STORE_INFO },
    }
  }

  async function handleConfirm() {
    if (loading || !isReceiverValid) return
    setLoading(true)
    try {
      const result = await onConfirm(
        buildTenders(),
        dteType,
        dteType === 'factura' ? receiver : undefined,
      )
      setOrderId(result.orderId)
      setOrderNumber(result.number)
      setDteStatus('pending')
      setStep('success')
      setCountdown(AUTO_DISMISS_MS)

      // Imprimir automáticamente en paralelo
      const payload = buildTicketPayload(result)
      setPrintStatus('printing')
      printTicket(payload).then(res => {
        if (res.ok) {
          setPrintStatus('success')
        } else {
          setPrintStatus('error')
          setPrintError(res.error ?? 'Error de impresora')
          setPaused(true)  // no auto-dismiss con error de impresión
        }
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar la venta')
    } finally {
      setLoading(false)
    }
  }

  async function handleReprint() {
    if (!orderNumber || !orderId) return
    const payload = buildTicketPayload({ orderId: orderId!, number: orderNumber! })
    setPrintStatus('printing')
    setPrintError('')
    const res = await printTicket({ ...payload, isReprint: true })
    if (res.ok) {
      setPrintStatus('success')
      setPaused(false)
    } else {
      setPrintStatus('error')
      setPrintError(res.error ?? 'Error de impresora')
    }
  }

  const STEP_LABELS = { method: 'Método', pay: 'Pago', summary: 'Resumen' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center"
      style={{ background: 'var(--color-surface-overlay)' }}
    >
      <div
        className="relative flex flex-col w-full max-w-lg mx-auto shadow-2xl"
        style={{ background: 'var(--color-surface-elevated)' }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {step !== 'success' ? (
            <>
              {/* Total */}
              <div>
                <p
                  className="font-body text-[10px] font-semibold tracking-widest"
                  style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
                >
                  TOTAL A COBRAR
                </p>
                <p className="font-mono font-black text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
                  {formatCLP(total)}
                </p>
              </div>

              {/* Stepper */}
              {step !== 'method' && (
                <div className="flex items-center gap-1">
                  {(['method', 'pay', 'summary'] as const).map((s, i) => {
                    const steps = ['method', 'pay', 'summary'] as const
                    const current = steps.indexOf(step)
                    const done = i < current
                    const active = i === current
                    return (
                      <div key={s} className="flex items-center gap-1">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold"
                          style={{
                            background: done || active ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-border)',
                            color: done || active ? '#f5f5f2' : 'var(--color-text-muted)',
                          }}
                        >
                          {done ? <IconCheck size={12} color="#f5f5f2" /> : i + 1}
                        </div>
                        {i < 2 && (
                          <div
                            className="w-6 h-px"
                            style={{ background: done ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-border)' }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Cerrar */}
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded transition-colors hover:bg-surface"
                aria-label="Cerrar checkout"
              >
                <IconClose size={18} color="var(--color-text-muted)" />
              </button>
            </>
          ) : (
            <>
              <span className="font-korean font-black text-base" style={{ color: 'var(--color-brand)' }}>
                감사합니다
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded font-headline font-bold text-sm transition-all active:scale-[0.97]"
                style={{ background: 'var(--heuk-950, #0a0a0a)', color: '#f5f5f2' }}
              >
                Nueva venta →
              </button>
            </>
          )}
        </div>

        {/* ── Body scrolleable ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Alertas cadena de frío */}
          {(hasFrozen || hasRefrigerated) && step !== 'success' && (
            <div className="mb-4">
              <ColdChainAlert hasFrozen={hasFrozen} hasRefrigerated={hasRefrigerated} />
            </div>
          )}

          {/* STEP: method */}
          {step === 'method' && (
            <>
              {isRappi && (
                <div className="mb-3 px-3 py-2 rounded text-xs font-body font-semibold"
                  style={{ background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', border: '1px solid var(--color-brand)' }}>
                  Delivery Rappi — solo transferencia / QR
                </div>
              )}
              <MethodPicker
                selected={isRappi ? 'qr' : method}
                onSelect={isRappi ? () => {} : handleSelectMethod}
                hasBaes={!!baesSession}
                rappiOnly={isRappi}
              />

              {/* Selector tipo de documento — Boleta/Factura quedan deshabilitadas
                  hasta que se conecte un proveedor DTE real (Haulmer/OpenFactura/
                  SimpleAPI, decisión de negocio pendiente, ver PLAN_MAESTRO_SEUL_KING_OS.md).
                  Se dejan visibles (no se ocultan) para que el layout de 3 columnas
                  ya esté listo el día que se activen — solo "enchufar", sin rediseñar. */}
              <div className="mt-5">
                <p
                  className="font-body text-[10px] font-semibold tracking-widest mb-3"
                  style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
                >
                  DOCUMENTO
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'nota_venta' as DteType, label: 'Nota de venta', sub: 'Disponible',    disabled: false },
                    { id: 'boleta'     as DteType, label: 'Boleta',        sub: 'Próximamente',   disabled: true },
                    { id: 'factura'    as DteType, label: 'Factura',       sub: 'Próximamente',   disabled: true },
                  ]).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && setDteType(opt.id)}
                      title={opt.disabled ? 'Disponible cuando se conecte la boleta electrónica SII' : undefined}
                      className="flex flex-col items-center px-3 py-3 rounded border text-center transition-all"
                      style={{
                        borderColor: dteType === opt.id ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-border)',
                        background:  dteType === opt.id ? 'var(--heuk-950, #0a0a0a)' : 'transparent',
                        color:       dteType === opt.id ? '#f5f5f2' : 'var(--color-text)',
                        opacity:     opt.disabled ? 0.4 : 1,
                        cursor:      opt.disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span className="font-headline font-bold text-sm">{opt.label}</span>
                      <span className="font-body text-[10px] opacity-60 mt-0.5">{opt.sub}</span>
                    </button>
                  ))}
                </div>

                {/* Formulario receptor — solo para factura */}
                {dteType === 'factura' && (
                  <div className="mt-4 space-y-3">
                    <p
                      className="font-body text-[10px] font-semibold tracking-widest"
                      style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}
                    >
                      DATOS DEL RECEPTOR
                    </p>
                    <div>
                      <input
                        type="text"
                        placeholder="RUT (ej: 12.345.678-9)"
                        value={receiver.rut}
                        onChange={e => {
                          setReceiver(r => ({ ...r, rut: e.target.value }))
                          setRutError('')
                        }}
                        onBlur={() => {
                          if (receiver.rut && !validateRut(receiver.rut)) {
                            setRutError('RUT inválido')
                          } else if (receiver.rut) {
                            setReceiver(r => ({ ...r, rut: formatRut(r.rut) }))
                          }
                        }}
                        className="w-full px-3 py-2 rounded text-sm font-mono focus:outline-none"
                        style={{
                          background: 'var(--color-surface)',
                          border: `1px solid ${rutError ? 'var(--color-error)' : 'var(--color-border)'}`,
                          color: 'var(--color-text)',
                        }}
                      />
                      {rutError && (
                        <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>{rutError}</p>
                      )}
                    </div>
                    {(['razonSocial', 'giro', 'direccion', 'comuna'] as const).map(field => (
                      <input
                        key={field}
                        type="text"
                        placeholder={{
                          razonSocial: 'Razón social',
                          giro:        'Giro comercial',
                          direccion:   'Dirección',
                          comuna:      'Comuna',
                        }[field]}
                        value={receiver[field]}
                        onChange={e => setReceiver(r => ({ ...r, [field]: e.target.value }))}
                        className="w-full px-3 py-2 rounded text-sm font-body focus:outline-none"
                        style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP: pay */}
          {step === 'pay' && method && (
            <>
              {method === 'cash' && (
                <PayCash
                  total={total}
                  onReady={handlePayReady}
                  onNotReady={handlePayNotReady}
                />
              )}
              {method === 'debit' && (
                <PayCard
                  total={total}
                  type="debit"
                  onReady={() => handlePayReady()}
                />
              )}
              {method === 'credit' && (
                <PayCard
                  total={total}
                  type="credit"
                  onReady={() => handlePayReady()}
                />
              )}
              {method === 'baes' && (
                <PayBAES
                  baesTotal={baesAmount}
                  remainder={total - baesAmount}
                  baesSession={baesSession}
                  onBAES={onBAESValidated}
                  onReady={(secondMethod, received) => {
                    setTenders(baesAmount > 0
                      ? [{ method: secondMethod, amount: total - baesAmount }]
                      : []
                    )
                    if (received !== undefined) setCashReceived(received)
                    setPayReady(true)
                  }}
                  onNotReady={handlePayNotReady}
                />
              )}
              {method === 'qr' && (
                <PayQR
                  total={total}
                  onReady={() => handlePayReady()}
                  onNotReady={handlePayNotReady}
                />
              )}
              {method === 'mixed' && (
                <PayMixed
                  total={total}
                  tenders={tenders}
                  onAddTender={(t) => setTenders(prev => [...prev, t])}
                  onRemoveTender={(i) => setTenders(prev => prev.filter((_, idx) => idx !== i))}
                  onReady={() => handlePayReady()}
                  onNotReady={handlePayNotReady}
                />
              )}
            </>
          )}

          {/* STEP: summary */}
          {step === 'summary' && (
            <TenderSummary
              subtotal={subtotal}
              baesAmount={baesAmount}
              total={total}
              tenders={buildTenders()}
              baesSession={baesSession}
              change={change}
            />
          )}

          {/* STEP: success — diseño inspirado en Square/Toast */}
          {step === 'success' && (
            <div
              className="flex flex-col items-center py-6 gap-4"
              onClick={() => setPaused(true)}
            >
              {/* Barra countdown */}
              {printStatus !== 'error' && (
                <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(countdown / AUTO_DISMISS_MS) * 100}%`,
                      background: 'var(--color-baes-eligible)',
                      transitionDuration: '100ms',
                    }}
                  />
                </div>
              )}

              {/* Check + número */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--color-baes-applied-bg)' }}
                >
                  <IconCheck size={44} color="var(--color-baes-eligible)" />
                </div>
                {orderNumber && (
                  <p className="font-mono font-black text-lg tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                    N° {String(orderNumber).padStart(6, '0')}
                  </p>
                )}
              </div>

              {/* Vuelto — información #1 si hay efectivo */}
              {change > 0 && (
                <div className="text-center">
                  <p className="font-body text-xs font-semibold tracking-widest" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}>
                    VUELTO
                  </p>
                  <p className="font-mono font-black leading-none" style={{ fontSize: 56, color: 'var(--color-baes-eligible)', lineHeight: 1.1 }}>
                    {formatCLP(change)}
                  </p>
                </div>
              )}

              {/* Badges en fila: impresión + DTE */}
              <div className="flex items-center gap-2 flex-wrap justify-center">

                {/* Badge impresión */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{
                    background: printStatus === 'success' ? 'var(--color-baes-applied-bg)'
                              : printStatus === 'error'   ? 'var(--color-error-subtle)'
                              : 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {printStatus === 'printing' && (
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-text-muted)' }} />
                  )}
                  {printStatus === 'success' && <IconCheck size={11} color="var(--color-baes-eligible)" />}
                  <span className="font-body text-xs font-semibold" style={{
                    color: printStatus === 'success' ? 'var(--color-baes-eligible)'
                         : printStatus === 'error'   ? 'var(--color-error)'
                         : 'var(--color-text-muted)',
                  }}>
                    {printStatus === 'idle'     && <><IconPrint size={11} className="inline mr-1" />Imprimiendo...</>}
                    {printStatus === 'printing' && <><IconPrint size={11} className="inline mr-1" />Imprimiendo...</>}
                    {printStatus === 'success'  && `✓ Impresa${getCachedMode() === 'fallback' ? ' (PDF)' : ''}`}
                    {printStatus === 'error'    && `Sin impresora`}
                  </span>
                </div>

                {/* Badge DTE (solo boleta/factura) */}
                {dteType !== 'nota_venta' && (
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{
                      background: dteStatus === 'issued' || dteStatus === 'accepted_sii'
                        ? 'var(--color-baes-applied-bg)'
                        : dteStatus === 'failed' || dteStatus === 'rejected_sii'
                          ? 'var(--color-error-subtle)'
                          : 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {(dteStatus === 'pending' || dteStatus === 'sending') && (
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-text-muted)' }} />
                    )}
                    {(dteStatus === 'issued' || dteStatus === 'accepted_sii') && <IconCheck size={11} color="var(--color-baes-eligible)" />}
                    <span className="font-body text-xs font-semibold" style={{
                      color: dteStatus === 'issued' || dteStatus === 'accepted_sii'
                        ? 'var(--color-baes-eligible)'
                        : dteStatus === 'failed' || dteStatus === 'rejected_sii'
                          ? 'var(--color-error)'
                          : 'var(--color-text-muted)',
                    }}>
                      {dteStatus === 'pending'      && 'Emitiendo DTE…'}
                      {dteStatus === 'sending'      && 'Emitiendo DTE…'}
                      {dteStatus === 'issued'       && `${dteType === 'boleta' ? 'Boleta' : 'Factura'} #${dteFolio ?? '—'}`}
                      {dteStatus === 'accepted_sii' && `SII ✓ #${dteFolio ?? '—'}`}
                      {dteStatus === 'failed'       && 'DTE fallido'}
                      {dteStatus === 'rejected_sii' && 'DTE rechazado'}
                    </span>
                    {pdfUrl && (dteStatus === 'issued' || dteStatus === 'accepted_sii') && (
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                        className="font-body text-xs underline ml-1"
                        style={{ color: 'var(--color-baes-eligible)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        Ver
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Error de impresión — prominente */}
              {printStatus === 'error' && (
                <div className="w-full rounded-lg p-3 text-center" style={{ background: 'var(--color-error-subtle)', border: '1px solid var(--color-error)' }}>
                  <p className="font-body text-sm font-semibold mb-1" style={{ color: 'var(--color-error)' }}>
                    {printError || 'Impresora no disponible'}
                  </p>
                  <p className="font-body text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    La venta está guardada. Puede reimprimir cuando la impresora esté lista.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={e => { e.stopPropagation(); handleReprint() }}
                      className="px-4 py-2 rounded font-body font-semibold text-sm"
                      style={{ background: 'var(--color-error)', color: '#fff' }}
                    >
                      Reintentar
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setPaused(false) }}
                      className="px-4 py-2 rounded font-body text-sm"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    >
                      Continuar sin imprimir
                    </button>
                  </div>
                </div>
              )}

              {/* Total pagado + pie */}
              <div className="text-center">
                <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Total · {formatCLP(total)}
                </p>
                <p className="font-korean text-xs mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>
                  또 오세요
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Error modal (checkout fallido) ── */}
        {errorMsg && (
          <div
            className="mx-6 mb-0 mt-2 rounded-lg p-4 flex gap-3 items-start"
            style={{ background: 'var(--color-error-subtle)', border: '1px solid var(--color-error)' }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 1 }} />
            <div className="flex-1 min-w-0">
              <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-error)' }}>
                Error al procesar la venta
              </p>
              <p className="font-body text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {errorMsg}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => setErrorMsg(null)}
                className="px-3 py-1.5 rounded font-body font-semibold text-xs transition-all"
                style={{ background: 'var(--color-error)', color: '#fff' }}
              >
                Reintentar
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded font-body text-xs transition-all"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Cancelar cobro
              </button>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {step !== 'success' && (
          <div
            className="px-6 py-4 border-t flex gap-3 shrink-0"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {/* Atrás */}
            {step !== 'method' && (
              <button
                onClick={() => setStep(step === 'summary' ? 'pay' : 'method')}
                className="px-4 py-3 rounded font-body font-semibold text-sm transition-all"
                style={{
                  background: 'var(--color-surface)',
                  border:     '1px solid var(--color-border)',
                  color:      'var(--color-text)',
                }}
              >
                Atras
              </button>
            )}

            {/* Acción principal */}
            {step === 'pay' && (
              <button
                onClick={() => setStep('summary')}
                disabled={!payReady}
                className="flex-1 py-3 rounded font-headline font-bold text-base transition-all active:scale-[0.98]"
                style={{
                  background: payReady ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-border)',
                  color:      payReady ? '#f5f5f2' : 'var(--color-text-disabled)',
                  cursor:     payReady ? 'pointer' : 'not-allowed',
                }}
              >
                Continuar
              </button>
            )}

            {step === 'method' && method && (
              <button
                onClick={() => isReceiverValid && setStep('pay')}
                disabled={!isReceiverValid}
                className="flex-1 py-3 rounded font-headline font-bold text-base transition-all active:scale-[0.98]"
                style={{
                  background: isReceiverValid ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-border)',
                  color:      isReceiverValid ? '#f5f5f2' : 'var(--color-text-disabled)',
                  cursor:     isReceiverValid ? 'pointer' : 'not-allowed',
                }}
              >
                Siguiente
              </button>
            )}

            {step === 'summary' && (
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-3 rounded font-headline font-bold text-base transition-all active:scale-[0.98]"
                style={{
                  background: loading ? 'var(--color-border)' : 'var(--heuk-950, #0a0a0a)',
                  color:      loading ? 'var(--color-text-disabled)' : '#f5f5f2',
                }}
              >
                {loading ? 'Procesando...' : `Confirmar ${formatCLP(total)}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
