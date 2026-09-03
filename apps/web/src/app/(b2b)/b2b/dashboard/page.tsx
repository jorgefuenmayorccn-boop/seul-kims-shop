'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { TierBadge } from '@seul/ui/b2b/tier-badge'
import { CreditGauge } from '@seul/ui/b2b/credit-gauge'
import { InvoiceRow } from '@seul/ui/b2b/invoice-row'
import { formatRUT } from '@seul/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface Empresa {
  id:             string
  razonSocial:    string
  rut:            string
  tier:           'hoobae' | 'sunbae' | 'hyung'
  status:         'pending' | 'approved' | 'rejected' | 'suspended'
  creditLimitClp: number
  creditUsedClp:  number
  paymentDays:    number
  customerId:     string
  creditPct:      number
}

interface Pedido {
  id:        string
  number:    number
  total:     string
  status:    'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  dteStatus: 'pending' | 'emitted' | 'dte-failed'
  dteFolio:  number | null
  createdAt: string
}

export default function DashboardB2BPage() {
  const router  = useRouter()
  const [empresa,  setEmpresa]  = useState<Empresa | null>(null)
  const [pedidos,  setPedidos]  = useState<Pedido[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch(`${API}/api/b2b/empresa/me`, { credentials: 'include' })
        if (res.status === 401) { router.replace('/b2b/login'); return }
        const data = await res.json() as Empresa & { error?: string }
        if (!res.ok) { setError(data.error ?? 'Error al cargar tu cuenta'); return }

        setEmpresa(data)

        const pedRes  = await fetch(`${API}/api/b2b/pedidos/${data.id}`, { credentials: 'include' })
        const pedData = await pedRes.json() as { pedidos: Pedido[] }
        setPedidos(pedData.pedidos ?? [])
      } catch {
        setError('Error de conexión. Recarga la página.')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="size-6 animate-spin text-[var(--color-brand)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md mt-12">
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold mb-1">No se pudo cargar tu cuenta</p>
            <p>{error}</p>
            <a href="/b2b/registro" className="mt-3 inline-block text-[var(--color-brand)] underline font-medium">
              Solicitar cuenta B2B
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!empresa) return null

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Mi cuenta B2B</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Crédito, tier y pedidos de tu empresa.
        </p>
      </div>

      {/* Tarjeta empresa */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold leading-tight">{empresa.razonSocial}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{formatRUT(empresa.rut)}</p>
          </div>
          <TierBadge tier={empresa.tier} size="md" />
        </div>

        <div className="mt-6">
          <CreditGauge
            limitClp={empresa.creditLimitClp}
            usedClp={empresa.creditUsedClp}
          />
        </div>

        {empresa.paymentDays > 0 && (
          <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
            Condición de pago: <span className="font-semibold text-[var(--color-text)]">{empresa.paymentDays} días</span>
          </p>
        )}
      </div>

      {/* Historial pedidos */}
      <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <h3 className="mb-4 font-semibold">Últimos pedidos</h3>

        {pedidos.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
            Sin pedidos registrados aún.
          </p>
        ) : (
          <div className="space-y-2">
            {pedidos.map(p => (
              <InvoiceRow
                key={p.id}
                number={p.number}
                total={parseInt(p.total, 10)}
                status={p.status}
                dteStatus={p.dteStatus}
                dteFolio={p.dteFolio}
                createdAt={p.createdAt}
              />
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
        Para hacer un pedido, andá al{' '}
        <a href="/b2b/catalogo" className="underline hover:text-[var(--color-brand)]">catálogo mayorista</a>
      </p>
    </div>
  )
}
