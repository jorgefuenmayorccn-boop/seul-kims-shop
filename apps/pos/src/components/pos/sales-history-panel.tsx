'use client'
import { useEffect, useState, useRef } from 'react'
import { formatCLP } from '@seul/ui'
import { IconClose } from '@/components/icons/pos-icons'
import { Delete, ShoppingBag, Receipt, TrendingUp, CreditCard } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Payment { id: string; method: string; amount: string }

interface AnalyticsOrder {
  id:         string
  number:     number
  total:      string
  status:     string
  dteType:    string
  createdAt:  string
  voidedAt:   string | null
  voidReason: string | null
  payments:   Payment[]
}

interface KPIs {
  totalRevenue: number
  orderCount:   number
  avgTicket:    number
  byMethod:     Record<string, number>
}

interface SalesHistoryPanelProps {
  tillSessionId: string
  apiUrl:        string
  onClose:       () => void
}

// ─── PIN Modal ────────────────────────────────────────────────────────────────

function PinModal({ apiUrl, onUnlock, onClose }: { apiUrl: string; onUnlock: () => void; onClose: () => void }) {
  const [digits,  setDigits]  = useState<string[]>([])
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del']

  async function checkPin(pin: string) {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`${apiUrl}/api/analytics/pin-check`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ pin }),
      })
      const data = await res.json() as { ok: boolean }
      if (data.ok) {
        onUnlock()
      } else {
        setError('PIN incorrecto')
        setDigits([])
      }
    } catch {
      setError('Error de conexión')
      setDigits([])
    } finally {
      setLoading(false)
    }
  }

  function press(k: string) {
    if (loading) return
    if (k === 'del') {
      setDigits(d => d.slice(0, -1))
      setError('')
      return
    }
    if (k === '') return
    const next = [...digits, k].slice(0, 4)
    setDigits(next)
    if (next.length === 4) checkPin(next.join(''))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="flex flex-col items-center rounded-2xl px-8 py-8 gap-6"
        style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', width: 320 }}
      >
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <p className="font-headline font-semibold text-base" style={{ color: 'var(--color-text)' }}>Acceso a ventas</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface">
            <IconClose size={14} color="var(--color-text-muted)" />
          </button>
        </div>

        {/* Dot indicators */}
        <div className="flex gap-3">
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-150"
              style={{
                background: digits.length > i
                  ? error ? 'var(--color-error)' : 'var(--color-text)'
                  : 'var(--color-border)',
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs font-body" style={{ color: 'var(--color-error)', marginTop: -16 }}>{error}</p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {KEYS.map((k, i) => (
            <button
              key={i}
              onClick={() => press(k)}
              disabled={loading || k === ''}
              className="h-12 rounded-lg font-mono text-lg font-medium flex items-center justify-center transition-colors"
              style={{
                background: k === '' ? 'transparent' : 'var(--color-surface)',
                color:       k === 'del' ? 'var(--color-text-muted)' : 'var(--color-text)',
                border:      k === '' ? 'none' : '1px solid var(--color-border)',
                cursor:      k === '' ? 'default' : 'pointer',
              }}
            >
              {k === 'del' ? <Delete size={16} /> : k}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="flex-1 rounded-xl px-4 py-3 flex flex-col gap-0.5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="font-mono font-bold text-lg leading-tight" style={{ color: 'var(--color-text)' }}>{value}</p>
      {sub && <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
    </div>
  )
}

// ─── Void Confirm ─────────────────────────────────────────────────────────────

function VoidConfirm({
  order, apiUrl, onDone, onCancel,
}: {
  order:    AnalyticsOrder
  apiUrl:   string
  onDone:   () => void
  onCancel: () => void
}) {
  const [pin,     setPin]     = useState('')
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function submit() {
    if (!pin || !reason) { setError('PIN y motivo requeridos'); return }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`${apiUrl}/api/orders/${order.id}/void`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ pin, reason }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? `Error ${res.status}`)
        return
      }
      onDone()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="flex flex-col gap-4 rounded-2xl px-6 py-6"
        style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', width: 340 }}
      >
        <p className="font-headline font-semibold text-base" style={{ color: 'var(--color-text)' }}>
          Anular venta #{order.number}
        </p>
        <p className="font-mono text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          {formatCLP(Number(order.total))}
        </p>
        <div className="flex flex-col gap-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="PIN de anulación"
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <input
            type="text"
            maxLength={120}
            placeholder="Motivo de anulación"
            value={reason}
            onChange={e => { setReason(e.target.value); setError('') }}
            className="w-full px-3 py-2 rounded-lg text-sm font-body focus:outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>
        {error && <p className="text-xs font-body" style={{ color: 'var(--color-error)' }}>{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm font-body"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-body font-medium"
            style={{ background: 'var(--color-error)', color: '#fff' }}
          >
            {loading ? 'Anulando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Method label ─────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  debit:    'Débito',
  credit:   'Crédito',
  baes:     'BAES',
  qr:       'QR',
  transfer: 'Transferencia',
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function SalesHistoryPanel({ tillSessionId, apiUrl, onClose }: SalesHistoryPanelProps) {
  const [unlocked,    setUnlocked]    = useState(false)
  const [orders,      setOrders]      = useState<AnalyticsOrder[]>([])
  const [kpis,        setKpis]        = useState<KPIs | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [voidTarget,  setVoidTarget]  = useState<AnalyticsOrder | null>(null)

  const loadRef = useRef(0)

  async function load() {
    setLoading(true)
    const seq = ++loadRef.current
    try {
      const res  = await fetch(`${apiUrl}/api/analytics/sales?tillSessionId=${tillSessionId}`, { credentials: 'include' })
      if (!res.ok || seq !== loadRef.current) return
      const data = await res.json() as { kpis: KPIs; orders: AnalyticsOrder[] }
      setKpis(data.kpis)
      setOrders(data.orders)
    } catch { /* silent */ } finally {
      if (seq === loadRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (unlocked) load()
  }, [unlocked, tillSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  }

  const valid  = orders.filter(o => o.status !== 'cancelada')
  const voided = orders.filter(o => o.status === 'cancelada')

  return (
    <>
      {/* PIN gate */}
      {!unlocked && (
        <PinModal
          apiUrl={apiUrl}
          onUnlock={() => setUnlocked(true)}
          onClose={onClose}
        />
      )}

      {/* Drawer */}
      {unlocked && (
        <div
          className="fixed inset-0 flex items-end justify-end z-50"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <div
            className="flex flex-col h-full overflow-hidden"
            style={{ width: 480, background: 'var(--color-surface-elevated)', borderLeft: '1px solid var(--color-border)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div>
                <p className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>Ventas de caja</p>
                <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {valid.length} {valid.length === 1 ? 'venta' : 'ventas'} · {voided.length} anuladas
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface">
                <IconClose size={16} color="var(--color-text-muted)" />
              </button>
            </div>

            {/* KPIs */}
            {kpis && (
              <div className="px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex gap-3 mb-3">
                  <KPICard
                    label="Total vendido"
                    value={formatCLP(kpis.totalRevenue)}
                    sub={`${kpis.orderCount} ${kpis.orderCount === 1 ? 'venta' : 'ventas'}`}
                  />
                  <KPICard
                    label="Ticket promedio"
                    value={formatCLP(kpis.avgTicket)}
                  />
                </div>
                {/* Payment breakdown */}
                {Object.keys(kpis.byMethod).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(kpis.byMethod).map(([m, amt]) => (
                      <div
                        key={m}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                      >
                        <CreditCard size={11} color="var(--color-text-muted)" />
                        <span className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {METHOD_LABEL[m] ?? m}
                        </span>
                        <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                          {formatCLP(amt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Order list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>Cargando…</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <ShoppingBag size={32} color="var(--color-text-muted)" strokeWidth={1.25} />
                  <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin ventas en esta caja</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th className="px-5 py-2.5 text-left text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}>Hora</th>
                      <th className="px-3 py-2.5 text-left text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}>#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}>Método</th>
                      <th className="px-3 py-2.5 text-right text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}>Total</th>
                      <th className="px-5 py-2.5 text-right text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const isVoid    = o.status === 'cancelada'
                      const methods   = o.payments.map(p => METHOD_LABEL[p.method] ?? p.method).join(' + ')
                      return (
                        <tr
                          key={o.id}
                          style={{
                            borderBottom: '1px solid var(--color-border)',
                            opacity: isVoid ? 0.45 : 1,
                          }}
                        >
                          <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {formatTime(o.createdAt)}
                          </td>
                          <td className="px-3 py-3 font-mono text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                            #{o.number}
                            {isVoid && (
                              <span className="ml-2 font-body text-xs font-normal" style={{ color: 'var(--color-error)' }}>anulada</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {methods || '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                            {formatCLP(Number(o.total))}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {!isVoid && (
                              <button
                                onClick={() => setVoidTarget(o)}
                                className="w-7 h-7 flex items-center justify-center rounded ml-auto transition-colors hover:bg-surface"
                                title="Anular venta"
                              >
                                <Receipt size={13} color="var(--color-text-muted)" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Void confirm — rendered after drawer so DOM order + z-[60] both beat z-50 */}
      {voidTarget && (
        <VoidConfirm
          order={voidTarget}
          apiUrl={apiUrl}
          onDone={() => { setVoidTarget(null); load() }}
          onCancel={() => setVoidTarget(null)}
        />
      )}
    </>
  )
}
