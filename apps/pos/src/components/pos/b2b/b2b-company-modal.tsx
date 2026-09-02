'use client'
import { useState, useCallback, useRef } from 'react'
import { X, Search, Building2, Loader2, AlertTriangle } from 'lucide-react'
import type { B2BCompanyInfo } from '@/lib/pos-store'

interface B2BCompanyModalProps {
  apiUrl:    string
  onSelect:  (company: B2BCompanyInfo) => void
  onClose:   () => void
}

const inputStyle: React.CSSProperties = {
  width:         '100%',
  padding:       '10px 12px',
  border:        '1px solid var(--color-border)',
  borderRadius:  4,
  background:    'var(--color-surface)',
  color:         'var(--color-text)',
  fontSize:      14,
  fontFamily:    'var(--font-body)',
  outline:       'none',
  boxSizing:     'border-box',
}

// Búsqueda/selección de empresa B2B para venta presencial en POS (adición
// post-entrega, punto 6 del flujo de aprobación de crédito B2B pedido por el
// dueño). Busca por RUT o razón social contra GET /api/b2b/companies (nuevo,
// staff owner/admin/staff). Al seleccionar, pos-store.addProduct empieza a
// usar priceB2B en vez de priceRetail para los productos que se agreguen
// DESPUÉS de este punto — los que ya estaban en el carrito NO se
// recalculan automáticamente (evita sorpresas de precio en un carrito que
// el cajero ya venía armando).
export function B2BCompanyModal({ apiUrl, onSelect, onClose }: B2BCompanyModalProps) {
  const [query, setQuery]         = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults]     = useState<B2BCompanyInfo[]>([])
  const [error, setError]         = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const res = await fetch(`${apiUrl}/api/b2b/companies?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' })
        if (!res.ok) throw new Error('Error al buscar')
        const data = await res.json() as { companies: B2BCompanyInfo[] }
        setResults(data.companies ?? [])
      } catch {
        setError('No se pudo buscar empresas')
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [apiUrl])

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg shadow-xl overflow-hidden"
        style={{ background: 'var(--color-surface-elevated, var(--color-surface))', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Building2 size={16} color="var(--color-brand)" />
            <h2 className="font-headline font-bold text-sm" style={{ color: 'var(--color-text)' }}>Venta B2B — seleccionar empresa</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 rounded hover:bg-surface">
            <X size={16} color="var(--color-text-muted)" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" color="var(--color-text-muted)" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => search(e.target.value)}
              placeholder="Buscar por RUT o razón social…"
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>

          {error && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-error)' }}>
              <AlertTriangle size={12} /> {error}
            </p>
          )}

          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {searching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin" color="var(--color-text-muted)" />
              </div>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                Sin resultados. ¿La empresa está registrada en el Portal B2B?
              </p>
            )}
            {results.map(c => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="w-full text-left px-3 py-2.5 rounded transition-colors hover:bg-surface"
                style={{ border: '1px solid var(--color-border)' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{c.razonSocial}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.rut}</span>
                  {c.status !== 'approved' && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--color-warning-subtle, #fef3c7)', color: 'var(--color-warning, #92400e)' }}
                    >
                      {c.status === 'pending' ? 'pendiente de aprobación' : c.status}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
