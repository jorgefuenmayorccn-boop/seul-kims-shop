'use client'
import { useState, useRef, useCallback } from 'react'
import type { DeliveryOrderInfo } from '@/lib/pos-store'

interface CustomerResult {
  id:       string
  name:     string
  email:    string | null
  phone:    string | null
  address:  string | null
  commune:  string | null
}

interface DeliveryOrderModalProps {
  apiUrl:    string
  total:     number
  onConfirm: (info: DeliveryOrderInfo) => void
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

const labelStyle: React.CSSProperties = {
  fontSize:    12,
  fontWeight:  600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color:       'var(--color-text-muted)',
  marginBottom: 6,
  display:     'block',
}

export function DeliveryOrderModal({ apiUrl, total, onConfirm, onClose }: DeliveryOrderModalProps) {
  const [phase, setPhase]         = useState<'search' | 'found' | 'manual'>('search')
  const [query, setQuery]         = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults]     = useState<CustomerResult[]>([])
  const [selected, setSelected]   = useState<CustomerResult | null>(null)

  // Form fields (manual entry or override)
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [email,   setEmail]   = useState('')
  const [address, setAddress] = useState('')
  const [floor,   setFloor]   = useState('')
  const [apt,     setApt]     = useState('')
  const [refs,    setRefs]    = useState('')
  const [mode,    setMode]    = useState<'delivery' | 'rappi'>('delivery')
  const [cod,     setCod]     = useState(false) // Cash on Delivery

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (q.trim().length < 2) { setResults([]); return }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`${apiUrl}/api/customers/search?q=${encodeURIComponent(q)}`, {
          credentials: 'include',
        })
        const data = await res.json() as { customers: CustomerResult[] }
        setResults(data.customers ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [apiUrl])

  function selectCustomer(c: CustomerResult) {
    setSelected(c)
    setName(c.name)
    setPhone(c.phone ?? '')
    setEmail(c.email ?? '')
    setAddress([c.address, c.commune].filter(Boolean).join(', '))
    setFloor('')
    setApt('')
    setRefs('')
    setPhase('found')
  }

  function goManual() {
    setSelected(null)
    setResults([])
    setPhase('manual')
  }

  function handleConfirm() {
    const finalName    = name.trim()
    const finalPhone   = phone.trim()
    const finalAddress = address.trim()
    if (!finalName || !finalPhone || !finalAddress) return

    onConfirm({
      customerId:      selected?.id,
      guestName:       selected ? undefined : finalName,
      guestPhone:      selected ? undefined : finalPhone,
      guestEmail:      selected ? undefined : (email.trim() || undefined),
      deliveryAddress: finalAddress,
      deliveryFloor:   floor.trim() || undefined,
      deliveryApt:     apt.trim() || undefined,
      deliveryRefs:    refs.trim() || undefined,
      deliveryMode:    mode,
      paymentAtDoor:   cod,
    })
  }

  const canConfirm = name.trim() && phone.trim() && address.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onKeyDown={e => e.key === 'Escape' && onClose()}
      tabIndex={-1}
    >
      <div
        className="relative flex flex-col rounded-lg shadow-2xl"
        style={{
          width:      480,
          maxHeight:  '90vh',
          background: 'var(--color-surface-elevated)',
          border:     '1px solid var(--color-border)',
          overflow:   'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <p className="font-headline text-base font-bold" style={{ color: 'var(--color-text)' }}>
              Pedido Delivery
            </p>
            <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Busque el cliente o ingrese los datos manualmente
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--color-text-muted)', lineHeight: 1 }}
            className="text-lg font-light hover:opacity-70 transition-opacity"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Búsqueda CRM */}
          <div>
            <label style={labelStyle}>Buscar cliente</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Teléfono, nombre o correo..."
                value={query}
                onChange={e => handleSearch(e.target.value)}
                style={inputStyle}
                autoFocus
              />
              {searching && (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Buscando...
                </span>
              )}
            </div>

            {/* Resultados */}
            {results.length > 0 && phase === 'search' && (
              <div
                className="mt-2 rounded border overflow-hidden"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {results.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:opacity-80 transition-opacity border-b last:border-b-0"
                    style={{
                      background:  'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {c.name}
                    </p>
                    <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {[c.phone, c.email].filter(Boolean).join(' · ')}
                    </p>
                    {c.address && (
                      <p className="font-body text-xs mt-0.5" style={{ color: 'var(--color-text-disabled)' }}>
                        {[c.address, c.commune].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {query.trim().length >= 2 && results.length === 0 && !searching && phase === 'search' && (
              <p className="font-body text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                No se encontraron clientes.{' '}
                <button onClick={goManual} style={{ color: 'var(--color-brand)', textDecoration: 'underline' }}>
                  Ingresar manualmente
                </button>
              </p>
            )}
          </div>

          {/* Formulario — visible en 'found' (confirmación del cliente) o 'manual' */}
          {(phase === 'found' || phase === 'manual') && (
            <>
              {phase === 'found' && selected && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded"
                  style={{ background: 'var(--color-success-subtle)', border: '1px solid var(--color-success-border)' }}
                >
                  <div style={{ flex: 1 }}>
                    <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {selected.name}
                    </p>
                    <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {[selected.phone, selected.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelected(null); setPhase('search'); setResults([]); setQuery('') }}
                    className="text-xs hover:opacity-70"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Cambiar
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Nombre *</label>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={inputStyle}
                    readOnly={phase === 'found'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Teléfono *</label>
                  <input
                    type="tel"
                    placeholder="+56 9 ..."
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Correo{' '}
                  <span style={{ fontWeight: 400, opacity: 0.7 }}>(para notificaciones)</span>
                </label>
                <input
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                />
                {!email.trim() && (
                  <p className="font-body text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Sin correo no se enviarán notificaciones automáticas.
                  </p>
                )}
              </div>

              <div>
                <label style={labelStyle}>Dirección de entrega *</label>
                <input
                  type="text"
                  placeholder="Calle 123, Viña del Mar"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Piso / Depto</label>
                  <input
                    type="text"
                    placeholder="Ej: Piso 3, Depto 4B"
                    value={apt}
                    onChange={e => setApt(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Torre / Block</label>
                  <input
                    type="text"
                    placeholder="Ej: Torre A"
                    value={floor}
                    onChange={e => setFloor(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Referencias</label>
                <input
                  type="text"
                  placeholder="Ej: Casa azul, portón negro, timbrar"
                  value={refs}
                  onChange={e => setRefs(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Modalidad de despacho */}
              <div>
                <label style={labelStyle}>Despacho via</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['delivery', 'rappi'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="py-3 rounded font-body text-sm font-medium transition-all"
                      style={{
                        border:     `2px solid ${mode === m ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        background: mode === m ? 'var(--color-brand-subtle)' : 'var(--color-surface)',
                        color:      mode === m ? 'var(--color-brand)' : 'var(--color-text)',
                      }}
                    >
                      {m === 'delivery' ? 'Flota Interna' : 'Rappi'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modalidad de pago */}
              <div>
                <label style={labelStyle}>Pago</label>
                <button
                  onClick={() => setCod(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded text-left transition-all"
                  style={{
                    border:     `2px solid ${cod ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    background: cod ? 'var(--color-brand-subtle)' : 'var(--color-surface)',
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: cod ? 'var(--color-brand)' : 'var(--color-border)' }}
                  >
                    {cod && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-brand)' }} />}
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      Pago al recibir (Cash on Delivery)
                    </p>
                    <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      El repartidor cobra al entregar
                    </p>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Botón para ir a ingreso manual cuando no se buscó */}
          {phase === 'search' && query.trim().length < 2 && (
            <button
              onClick={goManual}
              className="font-body text-sm underline hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Ingresar datos manualmente
            </button>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 font-body text-sm py-3 rounded transition-opacity hover:opacity-70"
            style={{
              border:     '1px solid var(--color-border)',
              background: 'transparent',
              color:      'var(--color-text-muted)',
            }}
          >
            Cancelar
          </button>
          {(phase === 'found' || phase === 'manual') && (
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-[2] font-headline font-bold text-sm py-3 rounded transition-all"
              style={{
                background: canConfirm ? 'var(--color-brand)' : 'var(--color-border)',
                color:      canConfirm ? '#fff' : 'var(--color-text-disabled)',
                cursor:     canConfirm ? 'pointer' : 'not-allowed',
              }}
            >
              Confirmar datos y continuar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
