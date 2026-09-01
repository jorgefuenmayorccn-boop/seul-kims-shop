'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCLP } from '@seul/ui'
import { Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface Empresa {
  id:               string
  razonSocial:      string
  walletBalanceClp: number
  creditLimitClp:   number | null
  creditUsedClp:    number | null
}

interface LedgerRow {
  id:            string
  type:          'credit' | 'debit' | 'adjustment'
  amountClp:     number
  balanceAfter:  number
  notes:         string | null
  createdAt:     string
}

const TYPE_LABELS = { credit: 'Crédito acreditado', debit: 'Débito', adjustment: 'Ajuste' }
const TYPE_COLORS = { credit: 'text-green-700', debit: 'text-red-700', adjustment: 'text-amber-700' }

// Empresa se resuelve SIEMPRE de la sesión activa (seul_customer_session) —
// nunca de un ID tecleado a mano. Antes esta pantalla dejaba que cualquier
// visitante escribiera un UUID de empresa ajeno; ahora carga automáticamente
// la propia (GET /api/b2b/empresa/me → GET /api/b2b/wallet/:id con ese id), y
// el backend además verifica que el :id coincida con la empresa de la sesión.
export default function EstadoCuentaPage() {
  const router = useRouter()
  const [empresa,   setEmpresa]   = useState<Empresa | null>(null)
  const [ledger,    setLedger]    = useState<LedgerRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch(`${API}/api/b2b/empresa/me`, { credentials: 'include' })
        if (meRes.status === 401 || meRes.status === 403) { router.replace('/b2b/login'); return }
        const me = await meRes.json() as { id?: string; error?: string }
        if (!meRes.ok || !me.id) { setError(me.error ?? 'No se pudo cargar tu cuenta'); return }

        const res = await fetch(`${API}/api/b2b/wallet/${me.id}`, { credentials: 'include' })
        if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? 'No encontrado'); return }
        const data = await res.json() as { empresa: Empresa; ledger: LedgerRow[] }
        setEmpresa(data.empresa)
        setLedger(data.ledger)
      } catch {
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="size-6 animate-spin text-[var(--color-brand)]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-2xl font-bold mb-2">Estado de cuenta</h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Consulta tu wallet B2B y el historial de movimientos.
      </p>

      {error && (
        <p className="mb-4 px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</p>
      )}

      {empresa && (
        <>
          <div className="rounded-xl border border-[var(--color-border)] p-5 mb-6">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
              {empresa.razonSocial}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Wallet disponible</p>
                <p className="text-xl font-mono font-bold text-green-700">{formatCLP(empresa.walletBalanceClp)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Límite crédito</p>
                <p className="text-xl font-mono font-bold">{formatCLP(empresa.creditLimitClp ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Crédito usado</p>
                <p className="text-xl font-mono font-bold">{formatCLP(empresa.creditUsedClp ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Monto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Saldo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {ledger.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-sm text-[var(--color-text-muted)]">Sin movimientos</td></tr>
                ) : ledger.map(row => (
                  <tr key={row.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-3">
                      <p className={`text-xs font-semibold ${TYPE_COLORS[row.type]}`}>{TYPE_LABELS[row.type]}</p>
                      {row.notes && <p className="text-[10px] text-[var(--color-text-muted)]">{row.notes}</p>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${row.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                      {row.type === 'credit' ? '+' : '-'}{formatCLP(Math.abs(row.amountClp))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{formatCLP(row.balanceAfter)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{fmt(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
