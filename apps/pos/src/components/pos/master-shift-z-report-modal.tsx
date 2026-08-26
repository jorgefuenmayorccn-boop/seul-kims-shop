'use client'
import { useState, useEffect, useCallback } from 'react'
import { formatCLP } from '@seul/ui'
import { IconClose, IconPrint } from '../icons/pos-icons'
import { printZReport } from '@/lib/print-service'
import type { MasterZReport } from '@/lib/types'

interface MasterShiftZReportModalProps {
  shiftId:  string
  apiUrl:   string
  onClose:  () => void
  onLogout: () => void
}

type PrintStatus = 'idle' | 'printing' | 'success' | 'error'

export function MasterShiftZReportModal({ shiftId, apiUrl, onClose, onLogout }: MasterShiftZReportModalProps) {
  const [report,      setReport]      = useState<MasterZReport | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [closing,     setClosing]     = useState(false)
  const [closed,      setClosed]      = useState(false)
  const [printStatus, setPrintStatus] = useState<PrintStatus>('idle')
  const [printError,  setPrintError]  = useState('')
  const [error,       setError]       = useState('')

  useEffect(() => {
    fetch(`${apiUrl}/api/shifts/${shiftId}/z-report`, { credentials: 'include' })
      .then(r => r.json() as Promise<{ masterReport: MasterZReport }>)
      .then(d => setReport(d.masterReport))
      .catch(() => setError('No se pudo cargar el reporte maestro'))
      .finally(() => setLoading(false))
  }, [apiUrl, shiftId])

  const handleClose = useCallback(async () => {
    if (closing || closed) return
    setClosing(true)
    setError('')

    try {
      const res  = await fetch(`${apiUrl}/api/shifts/${shiftId}/close`, {
        method:      'POST',
        credentials: 'include',
      })
      const data = await res.json() as { masterReport: MasterZReport; openTillIds?: string[]; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Error al cerrar turno')
        return
      }

      setReport(data.masterReport)
      setClosed(true)

      setPrintStatus('printing')
      const result = await printZReport(data.masterReport)
      setPrintStatus(result.ok ? 'success' : 'error')
      if (!result.ok) setPrintError(result.error ?? 'Error de impresora')
    } catch {
      setError('Error de conexión')
    } finally {
      setClosing(false)
    }
  }, [apiUrl, shiftId, closing, closed])

  async function handleReprint() {
    if (!report) return
    setPrintStatus('printing')
    setPrintError('')
    const result = await printZReport(report)
    setPrintStatus(result.ok ? 'success' : 'error')
    if (!result.ok) setPrintError(result.error ?? 'Error de impresora')
  }

  const METHOD_LABELS: Record<string, string> = {
    cash: 'Efectivo', debit: 'Débito', credit: 'Crédito',
    baes: 'BAES', qr: 'QR / Transfer', transfer: 'Transferencia',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="relative flex flex-col w-full max-w-md mx-4 rounded-xl shadow-2xl max-h-[90vh]"
        style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="font-headline font-bold text-lg" style={{ color: 'var(--color-text)' }}>Cierre de Turno (Maestro)</p>
            {report && (
              <p className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Turno #{report.shiftNumber} · {report.tillCount} caja(s)
              </p>
            )}
          </div>
          {!closed && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded" aria-label="Cancelar">
              <IconClose size={16} color="var(--color-text-muted)" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'var(--color-surface)' }} />
              ))}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded text-sm font-body"
              style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}>
              {error}
            </div>
          )}

          {report && (
            <>
              {/* Per-till summary */}
              {report.tills.length > 0 && (
                <div>
                  <p className="font-body text-[10px] font-semibold tracking-widest mb-2.5"
                     style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}>RESUMEN POR CAJA</p>
                  <div className="space-y-1.5">
                    {report.tills.map(t => (
                      <Row
                        key={t.tillId}
                        label={`Caja #${t.tillSessionNumber} — ${t.cashierName}`}
                        value={formatCLP(t.netTotal)}
                      />
                    ))}
                  </div>
                </div>
              )}
              <Divider />

              <div className="space-y-1.5">
                <Row label="Total tickets"    value={String(report.totalTickets)} />
                {report.totalVoids   > 0 && <Row label="Anulaciones"  value={String(report.totalVoids)} muted />}
                {report.totalRefunds > 0 && <Row label="Devoluciones" value={String(report.totalRefunds)} muted />}
              </div>
              <Divider />

              <div className="space-y-1.5">
                <Row label="Venta bruta"   value={formatCLP(report.grossTotal)} />
                {report.refundTotal > 0 && <Row label="(−) Devoluciones" value={formatCLP(report.refundTotal)} muted />}
                <Row label="VENTA NETA TURNO" value={formatCLP(report.netTotal)} bold />
              </div>
              <Divider />

              <div>
                <p className="font-body text-[10px] font-semibold tracking-widest mb-2.5"
                   style={{ color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}>DESGLOSE POR MÉTODO</p>
                <div className="space-y-1.5">
                  {(Object.entries(report.byMethod) as [string, number][])
                    .filter(([, v]) => v > 0)
                    .map(([method, amount]) => (
                      <Row key={method} label={METHOD_LABELS[method] ?? method} value={formatCLP(amount)} />
                    ))}
                </div>
              </div>

              {printStatus !== 'idle' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded text-sm font-body"
                  style={{
                    background: printStatus === 'success' ? 'var(--color-baes-applied-bg)'
                              : printStatus === 'error'   ? 'var(--color-error-subtle)'
                              : 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color:  printStatus === 'success' ? 'var(--color-baes-eligible)'
                          : printStatus === 'error'   ? 'var(--color-error)'
                          : 'var(--color-text-muted)',
                  }}>
                  {printStatus === 'printing' && <span className="w-2 h-2 rounded-full animate-pulse bg-current" />}
                  <span>
                    {printStatus === 'printing' && 'Imprimiendo Z-Maestro…'}
                    {printStatus === 'success'  && '✓ Z-Maestro impreso'}
                    {printStatus === 'error'    && (printError || 'Error de impresora')}
                  </span>
                  {printStatus === 'error' && (
                    <button onClick={handleReprint} className="ml-auto font-body text-xs underline">Reintentar</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {!closed ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded font-body text-sm transition-all"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                Cancelar
              </button>
              <button
                onClick={handleClose}
                disabled={closing || loading}
                className="flex-1 py-2.5 rounded font-headline font-bold text-base transition-all active:scale-[0.98]"
                style={{
                  background: closing || loading ? 'var(--color-border)' : 'var(--color-brand)',
                  color:      closing || loading ? 'var(--color-text-disabled)' : '#fff',
                  cursor:     closing || loading ? 'not-allowed' : 'pointer',
                }}>
                {closing ? 'Cerrando turno…' : 'Cerrar turno e imprimir Z-Maestro'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReprint}
                disabled={printStatus === 'printing'}
                className="flex items-center gap-2 px-4 py-2.5 rounded font-body text-sm transition-all"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                <IconPrint size={14} color="var(--color-text-muted)" />
                Reimprimir
              </button>
              <button
                onClick={onLogout}
                className="flex-1 py-2.5 rounded font-headline font-bold text-base transition-all active:scale-[0.98]"
                style={{ background: 'var(--heuk-950, #0a0a0a)', color: '#f5f5f2' }}>
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="font-body text-sm" style={{ color: muted ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{label}</span>
      <span className={`font-mono text-sm ${bold ? 'font-black text-base' : 'font-medium'}`}
        style={{ color: bold ? 'var(--color-text)' : muted ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  )
}

function Divider() {
  return <div className="h-px" style={{ background: 'var(--color-border)' }} />
}
