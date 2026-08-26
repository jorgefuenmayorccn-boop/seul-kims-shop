'use client'
import { useState, useCallback, useRef } from 'react'
import { Search, UserPlus, Phone, MapPin, Clock, X } from 'lucide-react'
import { setDeliveryCustomer, type DeliveryCustomer } from '@/lib/delivery-mode-store'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface ApiCustomer {
  id:           string
  name:         string
  phone:        string | null
  address:      string | null
  commune:      string | null
  addressNotes: string | null
  orderCount:   number
  lastOrderAt:  string | null
}

function clp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function timeAgo(iso: string | null) {
  if (!iso) return null
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'ayer'
  return `hace ${diff} días`
}

export function CustomerSearchPanel({ onClose }: { onClose: () => void }) {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<ApiCustomer[]>([])
  const [searching, setSearching] = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.length < 3) { setResults([]); return }

    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const params = /^\d/.test(value) ? `phone=${encodeURIComponent(value)}` : `q=${encodeURIComponent(value)}`
        const res = await fetch(`${API}/api/customers/search?${params}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json() as { customers: ApiCustomer[] }
          setResults(data.customers)
          if (data.customers.length === 0) setShowForm(true)
        }
      } catch { /* silent */ }
      finally { setSearching(false) }
    }, 350)
  }, [])

  const selectCustomer = useCallback((c: ApiCustomer) => {
    setDeliveryCustomer({
      id:           c.id,
      name:         c.name,
      phone:        c.phone ?? '',
      address:      c.address ?? '',
      commune:      c.commune ?? '',
      addressNotes: c.addressNotes ?? '',
    })
    onClose()
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-elevated)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <p className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>
            Cliente de entrega
          </p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:opacity-70">
            <X size={16} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <Search size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              autoFocus
              type="text"
              placeholder="Teléfono o nombre del cliente…"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none font-body text-sm"
              style={{ color: 'var(--color-text)' }}
            />
            {searching && <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-text-muted)' }} />}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {results.length > 0 && (
            <div>
              {results.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className="w-full text-left px-5 py-3.5 border-b hover:opacity-80 transition-opacity"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{c.name}</p>
                      {c.phone && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone size={11} style={{ color: 'var(--color-text-muted)' }} />
                          <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.phone}</span>
                        </div>
                      )}
                      {c.address && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={11} style={{ color: 'var(--color-text-muted)' }} />
                          <span className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.address}{c.commune ? `, ${c.commune}` : ''}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {c.orderCount > 0 && (
                        <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {c.orderCount} pedido{c.orderCount !== 1 ? 's' : ''}
                        </p>
                      )}
                      {c.lastOrderAt && (
                        <div className="flex items-center gap-1 justify-end">
                          <Clock size={10} style={{ color: 'var(--color-text-muted)' }} />
                          <span className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(c.lastOrderAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Quick create form */}
          {(showForm || (query.length >= 3 && results.length === 0 && !searching)) && (
            <CustomerQuickCreateForm initialPhone={/^\d/.test(query) ? query : ''} initialName={!/^\d/.test(query) ? query : ''} onCreated={onClose} />
          )}

          {query.length < 3 && results.length === 0 && !showForm && (
            <div className="px-5 py-8 text-center">
              <Phone size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--color-text-muted)' }} />
              <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Ingresa el teléfono o nombre del cliente
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 flex items-center gap-1.5 mx-auto font-body text-xs px-3 py-1.5 rounded transition-colors hover:opacity-70"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                <UserPlus size={13} />
                Crear cliente nuevo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Formulario de creación rápida ─────────────────────────────────────────────

function CustomerQuickCreateForm({
  initialPhone,
  initialName,
  onCreated,
}: { initialPhone: string; initialName: string; onCreated: () => void }) {
  const [form,    setForm]    = useState({ name: initialName, phone: initialPhone, address: '', commune: '', addressNotes: '' })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function handleSave() {
    if (!form.name.trim() || !form.phone.trim()) { setError('Nombre y teléfono son obligatorios'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/customers`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(form),
      })
      const data = await res.json() as { customer: { id: string; name: string; phone: string | null; address: string | null; commune: string | null; addressNotes: string | null } }
      setDeliveryCustomer({
        id:           data.customer.id,
        name:         data.customer.name,
        phone:        data.customer.phone ?? form.phone,
        address:      data.customer.address ?? form.address,
        commune:      data.customer.commune ?? form.commune,
        addressNotes: data.customer.addressNotes ?? form.addressNotes,
      })
      onCreated()
    } catch {
      setError('Error al guardar el cliente')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--color-surface)',
    border:     '1px solid var(--color-border)',
    color:      'var(--color-text)',
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <p className="font-body text-xs font-semibold tracking-widest" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.12em' }}>
        NUEVO CLIENTE
      </p>

      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Nombre *" value={form.name}    onChange={field('name')}    className="col-span-2 px-3 py-2 rounded-lg font-body text-sm outline-none" style={inputStyle} />
        <input placeholder="Teléfono *" value={form.phone}  onChange={field('phone')}   className="px-3 py-2 rounded-lg font-mono text-sm outline-none"   style={inputStyle} />
        <input placeholder="Dirección"  value={form.address} onChange={field('address')} className="px-3 py-2 rounded-lg font-body text-sm outline-none"   style={inputStyle} />
        <input placeholder="Comuna"     value={form.commune} onChange={field('commune')} className="px-3 py-2 rounded-lg font-body text-sm outline-none"   style={inputStyle} />
        <input placeholder="Instrucciones (ej. Dpto 4B)" value={form.addressNotes} onChange={field('addressNotes')} className="px-3 py-2 rounded-lg font-body text-sm outline-none" style={inputStyle} />
      </div>

      {error && <p className="font-body text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-lg font-headline font-bold text-sm transition-all"
        style={{
          background: saving ? 'var(--color-border)' : 'var(--heuk-950, #0a0a0a)',
          color:      saving ? 'var(--color-text-muted)' : '#f5f5f2',
        }}
      >
        {saving ? 'Guardando…' : 'Guardar y usar este cliente'}
      </button>
    </div>
  )
}
