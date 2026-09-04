'use client'
import { useEffect, useState } from 'react'
import { AlertCircle, KeyRound, CheckCircle, Building2, Plus, X } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

function PinChangeForm() {
  const [pin1,    setPin1]    = useState('')
  const [pin2,    setPin2]    = useState('')
  const [status,  setStatus]  = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [error,   setError]   = useState('')

  async function save() {
    setError('')
    if (!/^\d{4}$/.test(pin1)) { setError('El PIN debe ser exactamente 4 dígitos'); return }
    if (pin1 !== pin2)          { setError('Los PINs no coinciden'); return }
    setStatus('saving')
    try {
      const res = await fetch(`${API_URL}/api/tienda-config/analytics_pin`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ value: pin1 }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? `Error ${res.status}`)
        setStatus('error')
        return
      }
      setStatus('ok')
      setPin1('')
      setPin2('')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setError('Error de conexión')
      setStatus('error')
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={16} />
        <h2 className="font-semibold">PIN de Analytics POS</h2>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Protege el acceso a la tab de ventas en el POS. PIN de 4 dígitos. Solo visible para cajeros que lo conozcan.
      </p>

      {status === 'ok' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3 mb-4">
          <CheckCircle size={14} />
          <span>PIN actualizado correctamente</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3 mb-4">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 max-w-xs">
        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Nuevo PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pin1}
            onChange={e => { setPin1(e.target.value.replace(/\D/g, '')); setError('') }}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Confirmar PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pin2}
            onChange={e => { setPin2(e.target.value.replace(/\D/g, '')); setError('') }}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none"
          />
        </div>
        <button
          onClick={save}
          disabled={status === 'saving'}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-brand)' }}
        >
          {status === 'saving' ? 'Guardando…' : 'Actualizar PIN'}
        </button>
      </div>
    </div>
  )
}

// ── Configuración por local (Fase 3 multilocal, 3-sep-2026) ────────────────
// Reemplaza los 3 bloques placeholder que antes decían "confirmar con el
// dueño" / "editar el código fuente" — ahora es un formulario real que edita
// la tabla `locations`. El mismo formulario sirve para Viña del Mar hoy y
// para cualquier local nuevo (ej. Valparaíso) que el dueño cree con el
// botón "Crear local nuevo" — no hay dos pantallas distintas.

interface LocationSummary { id: string; name: string; slug: string; orderPrefix: string }
interface LocationDetail {
  id: string; name: string; slug: string; orderPrefix: string
  address: string | null; commune: string | null; rut: string | null; giro: string | null
  phone: string | null; whatsapp: string | null; instagram: string | null; email: string | null
  metroStationName: string | null; dteProvider: string | null; dteApiKey: string | null; dteRutEmpresa: string | null
  isActive: boolean
}

const emptyNewLocation = { name: '', slug: '', orderPrefix: '' }

function NewLocationForm({ onCreated, onCancel }: { onCreated: (loc: LocationSummary) => void; onCancel: () => void }) {
  const [form,    setForm]    = useState(emptyNewLocation)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function create() {
    if (!form.name || !form.slug || !form.orderPrefix) { setError('Nombre, slug y prefijo son obligatorios'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`${API_URL}/api/locations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      })
      const d = await res.json() as { ok?: boolean; location?: LocationSummary; error?: string }
      if (!res.ok || !d.location) { setError(d.error ?? 'Error al crear el local'); setSaving(false); return }
      onCreated({ ...d.location, orderPrefix: form.orderPrefix })
    } catch {
      setError('Error de conexión'); setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-brand bg-brand/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Crear local nuevo</h3>
        <button onClick={onCancel} className="text-text-muted hover:text-text"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Nombre</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Valparaíso" className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Slug (sin espacios)</label>
          <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
            placeholder="valparaiso" className="w-full px-3 py-2 rounded-lg text-sm font-mono border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Prefijo de pedido</label>
          <input value={form.orderPrefix} onChange={e => setForm(p => ({ ...p, orderPrefix: e.target.value.toUpperCase().slice(0, 4) }))}
            placeholder="VA" maxLength={4} className="w-full px-3 py-2 rounded-lg text-sm font-mono border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none" />
        </div>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <button onClick={create} disabled={saving}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--color-brand)' }}>
        {saving ? 'Creando…' : 'Crear local'}
      </button>
      <p className="text-xs text-text-muted">Después de crearlo puedes completar dirección, RUT, teléfono, WhatsApp, Instagram, correo y DTE abajo.</p>
    </div>
  )
}

function LocationConfigForm({ locationId }: { locationId: string }) {
  const [loc,     setLoc]     = useState<LocationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [status,  setStatus]  = useState<'idle' | 'ok' | 'error'>('idle')
  const [error,   setError]   = useState('')

  useEffect(() => {
    setLoading(true); setLoc(null)
    fetch(`${API_URL}/api/locations/${locationId}`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: { location?: LocationDetail }) => setLoc(d.location ?? null))
      .catch(() => setError('No se pudo cargar el local'))
      .finally(() => setLoading(false))
  }, [locationId])

  async function save() {
    if (!loc) return
    setSaving(true); setStatus('idle'); setError('')
    try {
      const res = await fetch(`${API_URL}/api/locations/${locationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(loc),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? 'Error al guardar'); setStatus('error'); setSaving(false); return
      }
      setStatus('ok')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setError('Error de conexión'); setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  function field(key: keyof LocationDetail, label: string, placeholder = '', type = 'text') {
    return (
      <div>
        <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">{label}</label>
        <input
          type={type}
          value={(loc?.[key] as string) ?? ''}
          placeholder={placeholder}
          onChange={e => setLoc(p => p ? { ...p, [key]: e.target.value } : p)}
          className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none"
        />
      </div>
    )
  }

  if (loading) return <p className="text-sm text-text-muted py-6">Cargando…</p>
  if (!loc) return <p className="text-sm text-error py-6">No se pudo cargar el local.</p>

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Building2 size={16} />Datos del local (boleta, contacto)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('name', 'Nombre')}
          {field('rut', 'RUT', '76.XXX.XXX-X')}
          {field('giro', 'Giro', 'Comercio al por menor')}
          {field('address', 'Dirección', 'Av. Libertad 1305')}
          {field('commune', 'Comuna', 'Viña del Mar')}
          {field('metroStationName', 'Estación Metro Merval')}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <h2 className="font-semibold">Contacto</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('phone', 'Teléfono', '+56 9 XXXX XXXX')}
          {field('whatsapp', 'WhatsApp', '+56 9 XXXX XXXX')}
          {field('instagram', 'Instagram', '@seoulshopcl')}
          {field('email', 'Correo', 'hola@seoulshop.cl', 'email')}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <h2 className="font-semibold">Boleta Electrónica SII (DTE)</h2>
        <p className="text-xs text-text-muted -mt-2">
          Hoy el sistema emite Nota de Venta (sin timbre SII). Completa esto cuando tengas cuenta con el proveedor —
          ver el manual para los datos que necesitas reunir.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Proveedor</label>
            <select value={loc.dteProvider ?? ''} onChange={e => setLoc(p => p ? { ...p, dteProvider: e.target.value } : p)}
              className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none">
              <option value="">Sin configurar (Nota de Venta)</option>
              <option value="openfactura">OpenFactura / Haulmer</option>
            </select>
          </div>
          {field('dteRutEmpresa', 'RUT empresa (DTE)', '76.XXX.XXX-X')}
          {field('dteApiKey', 'API Key del proveedor', '', 'password')}
        </div>
      </div>

      {status === 'ok' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
          <CheckCircle size={14} /><span>✓ Cambios guardados</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
          <AlertCircle size={14} /><span>{error}</span>
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--color-brand)' }}>
        {saving ? 'Guardando…' : 'Guardar cambios del local'}
      </button>
    </div>
  )
}

function LocationsSection() {
  const [locations,  setLocations]  = useState<LocationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading,    setLoading]    = useState(true)
  const [showNew,    setShowNew]    = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/locations`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: { locations?: LocationSummary[] }) => {
        const list = d.locations ?? []
        setLocations(list)
        if (list.length > 0) setSelectedId(list[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleCreated(loc: LocationSummary) {
    setLocations(p => [...p, loc])
    setSelectedId(loc.id)
    setShowNew(false)
  }

  if (loading) return <p className="text-sm text-text-muted py-6">Cargando locales…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">Editando:</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none">
            {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.orderPrefix})</option>)}
          </select>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-[var(--color-border)] text-text hover:bg-surface transition-colors">
          <Plus size={14} />Crear local nuevo
        </button>
      </div>

      {showNew && <NewLocationForm onCreated={handleCreated} onCancel={() => setShowNew(false)} />}

      {selectedId && <LocationConfigForm key={selectedId} locationId={selectedId} />}
    </div>
  )
}

export default function AjustesPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Configuración de tus locales — cada local tiene su propia dirección, contacto y datos de boleta.
        </p>
      </div>

      <div className="grid gap-4">
        <PinChangeForm />
        <LocationsSection />
      </div>
    </div>
  )
}
