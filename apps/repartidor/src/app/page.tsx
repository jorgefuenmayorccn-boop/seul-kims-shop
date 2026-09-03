'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapPin, Phone, CheckCircle, Snowflake, Train, Truck,
  LogIn, Loader2, Camera, Package, Clock, User,
  LogOut, Wifi, WifiOff, AlertTriangle, ArrowLeft,
  Navigation, CheckCircle2,
} from 'lucide-react'
import { ColdChainAlert, formatCLP } from '@seul/ui'
import { useDeliveryEvents, type DispatchAlert } from '@/lib/delivery-events'
import { unlockAudio, startAlarm, stopAlarm } from '@/lib/audio-alarm'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

type Status = 'pending' | 'assigned' | 'accepted' | 'in_transit' | 'delivered' | 'failed'
type Tab    = 'activos' | 'historial' | 'perfil'

interface Assignment {
  id:               string
  orderId:          string
  status:           Status
  amountToCollect:  number | null
  paymentAtDoor:    string
  routeIndex:       number | null
  orderNumber:      number
  orderTotal:       string
  deliveryMode:     string
  deliveryAddress:  string | null
  metroStation:     string | null
  metroSlot:        string | null
  customerName:     string | null
  customerPhone:    string | null
  guestName:        string | null
  guestPhone:       string | null
  hasFrozen?:       boolean
  hasRefrigerated?: boolean
  deliveredAt?:     string | null
  failedAt?:        string | null
  failureReason?:   string | null
}

interface Driver { id: string; name: string; email: string; role: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapLink(address: string) {
  const q = encodeURIComponent(address)
  return `https://maps.google.com/maps?q=${q}`
}
function wazeLink(address: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (d: Driver) => void }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ email, password }),
      })
      if (!r.ok) { setError('Credenciales inválidas'); return }
      const d = await r.json() as { user: Driver }
      if (d.user.role !== 'delivery' && d.user.role !== 'owner' && d.user.role !== 'admin') {
        setError('Acceso solo para repartidores')
        return
      }
      onLogin(d.user)
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full px-6"
      style={{ background: 'var(--color-background)' }}
      onClick={unlockAudio}
    >
      <p className="font-headline font-black text-4xl mb-1" style={{ color: 'var(--color-brand)' }}>서울킴스</p>
      <p className="text-sm font-body mb-10" style={{ color: 'var(--color-text-muted)' }}>Repartidor</p>
      <form onSubmit={handleLogin} className="w-full max-w-xs space-y-3">
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" autoComplete="email"
          className="w-full px-4 py-3.5 rounded-xl text-sm font-body focus:outline-none"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
        <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Contraseña" autoComplete="current-password"
          className="w-full px-4 py-3.5 rounded-xl text-sm font-body focus:outline-none"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
        {error && <p className="text-sm text-center font-body" style={{ color: 'var(--color-error)' }}>{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3.5 rounded-xl font-headline font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: 'var(--color-brand)' }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

// ── Dispatch Alert Overlay ────────────────────────────────────────────────────

function DispatchAlertOverlay({
  alert, onAccept, onReject,
}: {
  alert:    DispatchAlert
  onAccept: () => Promise<void>
  onReject: () => void
}) {
  const [accepting, setAccepting] = useState(false)
  const [pulse,     setPulse]     = useState(true)

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 600)
    return () => clearInterval(t)
  }, [])

  async function handleAccept() {
    setAccepting(true)
    await onAccept()
    setAccepting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      {/* Pulsing top bar */}
      <div
        className="h-1.5 w-full transition-opacity duration-300"
        style={{ background: 'var(--color-brand)', opacity: pulse ? 1 : 0.2 }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {/* Icon pulsante */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center transition-transform duration-300"
          style={{ background: 'var(--color-brand)', transform: pulse ? 'scale(1.08)' : 'scale(1)' }}
        >
          <Package size={36} color="#fff" />
        </div>

        <div className="text-center">
          <p className="font-headline font-black text-2xl text-white mb-1">
            ¡Nuevo pedido!
          </p>
          <p className="font-mono font-bold text-3xl text-white">
            #{alert.orderNumber}
          </p>
        </div>

        {/* Detalle */}
        <div
          className="w-full rounded-2xl p-5 space-y-3"
          style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex justify-between items-center">
            <span className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>Total del pedido</span>
            <span className="font-mono font-bold text-lg" style={{ color: 'var(--color-text)' }}>
              {formatCLP(Number(alert.total))}
            </span>
          </div>
          {Number(alert.amountToCollect) > 0 && (
            <div
              className="flex justify-between items-center px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <span className="font-body text-sm font-semibold" style={{ color: '#b45309' }}>Cobrar en puerta</span>
              <span className="font-mono font-bold text-lg" style={{ color: '#b45309' }}>
                {formatCLP(Number(alert.amountToCollect))}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {alert.deliveryMode === 'metro'
              ? <Train size={14} color="var(--color-text-muted)" />
              : <Truck size={14} color="var(--color-text-muted)" />
            }
            <span className="font-body text-sm capitalize" style={{ color: 'var(--color-text-muted)' }}>
              {alert.deliveryMode === 'metro' ? 'Retiro Metro' : 'Despacho a domicilio'}
            </span>
          </div>
        </div>

        {/* CTAs */}
        <div className="w-full space-y-3">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-5 rounded-2xl font-headline font-black text-xl text-white flex items-center justify-center gap-3 disabled:opacity-60"
            style={{ background: 'var(--color-brand)', minHeight: 72 }}
          >
            {accepting
              ? <Loader2 size={24} className="animate-spin" />
              : <CheckCircle2 size={24} />
            }
            {accepting ? 'Aceptando…' : 'ACEPTAR VIAJE'}
          </button>
          <button
            onClick={onReject}
            className="w-full py-3 font-body text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No puedo tomar este pedido
          </button>
        </div>
      </div>

      <div className="h-1.5 w-full" style={{ background: 'var(--color-brand)', opacity: pulse ? 0.2 : 1 }} />
    </div>
  )
}

// ── Active Delivery Screen ────────────────────────────────────────────────────

function ActiveDeliveryScreen({
  assignment, onBack, onStatusUpdate,
}: {
  assignment:     Assignment
  onBack:         () => void
  onStatusUpdate: (id: string, status: Status, extra?: { amountCollected?: number; paymentMethod?: string }) => Promise<void>
}) {
  const [updating,    setUpdating]    = useState(false)
  const [podFile,     setPodFile]     = useState<File | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [codConfirmed, setCodConfirmed] = useState(false)
  const [gpsError,    setGpsError]    = useState(false)

  const hasCOD = assignment.paymentAtDoor === 'pending' && Number(assignment.amountToCollect) > 0

  // GPS pinging — activo cuando el repartidor está en tránsito
  useEffect(() => {
    if (assignment.status !== 'in_transit') return
    if (!navigator.geolocation) return

    let watchId: number | null = null

    const ping = (lat: number, lng: number, accuracy: number) => {
      fetch(`${API}/api/delivery/location`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignment.id, latitude: lat, longitude: lng, accuracy }),
      }).catch(() => {})
    }

    watchId = navigator.geolocation.watchPosition(
      pos => {
        setGpsError(false)
        ping(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy))
      },
      () => setGpsError(true),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 },
    )

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [assignment.id, assignment.status])

  async function advance(status: Status) {
    setUpdating(true)
    const extra = (status === 'delivered' && hasCOD && codConfirmed)
      ? { amountCollected: Number(assignment.amountToCollect), paymentMethod: 'cash' }
      : undefined
    await onStatusUpdate(assignment.id, status, extra)
    setUpdating(false)
  }

  async function uploadPod() {
    if (!podFile) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', podFile)
    await new Promise<void>(resolve => {
      if (!navigator.geolocation) { resolve(); return }
      navigator.geolocation.getCurrentPosition(
        pos => { fd.append('lat', pos.coords.latitude.toString()); fd.append('lng', pos.coords.longitude.toString()); resolve() },
        () => resolve(),
        { timeout: 3000 },
      )
    })
    await fetch(`${API}/api/delivery/assignments/${assignment.id}/pod`, { method: 'POST', credentials: 'include', body: fd })
    setUploading(false)
    setPodFile(null)
    advance('delivered')
  }

  const canPickUp  = assignment.status === 'accepted'
  const canDeliver = assignment.status === 'in_transit'
  const address    = assignment.deliveryAddress ?? ''

  const stepIndex = ['assigned','accepted','in_transit','delivered'].indexOf(assignment.status)
  const steps     = ['Asignado','Recogido','En camino','Entregado']

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div className="px-4 pt-safe-top pb-4 flex items-center gap-3 text-white" style={{ background: 'var(--color-brand)' }}>
        <button onClick={onBack} className="p-1 rounded-lg opacity-80 hover:opacity-100">
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-headline font-bold text-lg leading-tight">Entrega #{assignment.orderNumber}</p>
          <p className="text-sm font-body text-white/75 truncate">{assignment.customerName ?? assignment.guestName ?? 'Cliente'}</p>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="flex items-center px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: i <= stepIndex ? 'var(--color-brand)' : 'var(--color-border)' }}
              >
                {i < stepIndex
                  ? <CheckCircle size={12} color="#fff" />
                  : <span className="w-2 h-2 rounded-full" style={{ background: i === stepIndex ? '#fff' : 'transparent' }} />
                }
              </div>
              <span className="text-[10px] font-body" style={{ color: i <= stepIndex ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px mx-1 mb-4" style={{ background: i < stepIndex ? 'var(--color-brand)' : 'var(--color-border)' }} />
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Destino */}
        <div className="rounded-2xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-start gap-3 mb-3">
            {assignment.deliveryMode === 'metro'
              ? <Train size={18} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
              : <MapPin size={18} style={{ color: 'var(--color-brand)', flexShrink: 0, marginTop: 2 }} />
            }
            <div className="flex-1 min-w-0">
              {assignment.deliveryMode === 'metro' ? (
                <>
                  <p className="font-semibold font-body text-sm" style={{ color: 'var(--color-text)' }}>
                    Estación {assignment.metroStation}
                  </p>
                  <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{assignment.metroSlot}</p>
                </>
              ) : (
                <p className="font-semibold font-body text-sm" style={{ color: 'var(--color-text)' }}>{address}</p>
              )}
            </div>
          </div>
          {address && assignment.deliveryMode !== 'metro' && (
            <div className="flex gap-2">
              <a href={mapLink(address)} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl text-xs font-body font-semibold text-center flex items-center justify-center gap-1.5"
                style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                <Navigation size={12} /> Maps
              </a>
              <a href={wazeLink(address)} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl text-xs font-body font-semibold text-center flex items-center justify-center gap-1.5"
                style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                <Navigation size={12} /> Waze
              </a>
            </div>
          )}
        </div>

        <ColdChainAlert hasFrozen={assignment.hasFrozen ?? false} hasRefrigerated={assignment.hasRefrigerated ?? false} />

        {gpsError && assignment.status === 'in_transit' && (
          <div className="rounded-2xl border px-4 py-3 flex items-center gap-2"
            style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
            <AlertTriangle size={14} color="#b45309" />
            <p className="text-xs font-body" style={{ color: '#b45309' }}>GPS no disponible — la distancia se estimará manualmente</p>
          </div>
        )}

        {/* Total + COD */}
        <div className="rounded-2xl border p-4 flex justify-between items-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <span className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>Total del pedido</span>
          <span className="font-mono font-bold text-xl" style={{ color: 'var(--color-text)' }}>
            {formatCLP(Number(assignment.orderTotal))}
          </span>
        </div>

        {Number(assignment.amountToCollect) > 0 && (
          <div className="rounded-2xl border p-4 flex justify-between items-center"
            style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
            <span className="font-body text-sm font-semibold" style={{ color: '#b45309' }}>Cobrar en puerta</span>
            <span className="font-mono font-bold text-xl" style={{ color: '#b45309' }}>
              {formatCLP(Number(assignment.amountToCollect))}
            </span>
          </div>
        )}

        {/* Contacto — fallback guest_phone */}
        {(assignment.customerPhone ?? assignment.guestPhone) && (
          <a href={`tel:${assignment.customerPhone ?? assignment.guestPhone}`}
            className="flex items-center gap-3 p-4 rounded-2xl border transition-opacity active:opacity-70"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <Phone size={18} style={{ color: 'var(--color-text-muted)' }} />
            <div>
              <p className="text-sm font-semibold font-body" style={{ color: 'var(--color-text)' }}>
                Llamar al cliente {assignment.guestName ? `(${assignment.guestName})` : ''}
              </p>
              <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                {assignment.customerPhone ?? assignment.guestPhone}
              </p>
            </div>
          </a>
        )}

        {/* PoD */}
        {canDeliver && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-semibold font-body" style={{ color: 'var(--color-text)' }}>Foto de comprobante</p>
            <label className="flex items-center gap-2 text-sm font-body cursor-pointer active:opacity-70"
              style={{ color: 'var(--color-text-muted)' }}>
              <Camera size={16} />
              {podFile ? podFile.name : 'Tomar o seleccionar foto'}
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => setPodFile(e.target.files?.[0] ?? null)} />
            </label>
            {podFile && (
              <button onClick={uploadPod} disabled={uploading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--color-brand)' }}>
                {uploading ? 'Subiendo…' : 'Confirmar entrega con foto'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="p-4 space-y-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        {canPickUp && (
          <button onClick={() => advance('in_transit')} disabled={updating}
            className="w-full py-4 rounded-2xl font-headline font-bold text-lg text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--color-brand)' }}>
            {updating ? <Loader2 size={20} className="animate-spin" /> : <Truck size={20} />}
            Ya recogí el pedido
          </button>
        )}

        {/* COD: repartidor debe confirmar cobro antes de marcar entregado */}
        {canDeliver && hasCOD && !codConfirmed && (
          <button onClick={() => setCodConfirmed(true)}
            className="w-full py-4 rounded-2xl font-headline font-bold text-lg flex items-center justify-center gap-2"
            style={{ background: '#f59e0b', color: '#fff' }}>
            <CheckCircle2 size={20} />
            Confirmar cobro en puerta
          </button>
        )}

        {canDeliver && !podFile && (!hasCOD || codConfirmed) && (
          <button onClick={() => advance('delivered')} disabled={updating}
            className="w-full py-4 rounded-2xl font-headline font-bold text-lg text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: '#16a34a' }}>
            {updating ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
            Entrega confirmada
          </button>
        )}
        <button onClick={() => advance('failed')} disabled={updating}
          className="w-full py-2.5 rounded-xl text-sm font-body font-medium transition-colors"
          style={{ color: 'var(--color-text-muted)' }}>
          Reportar fallo
        </button>
      </div>
    </div>
  )
}

// ── Tab: Activos ──────────────────────────────────────────────────────────────

function ActivesTab({
  assignments, loading, onSelectActive, onRefresh,
}: {
  assignments:    Assignment[]
  loading:        boolean
  onSelectActive: (a: Assignment) => void
  onRefresh:      () => void
}) {
  const pending = assignments.filter(a => !['delivered','failed'].includes(a.status))

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
    </div>
  )

  if (pending.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <CheckCircle size={52} strokeWidth={1.25} style={{ color: '#16a34a', opacity: 0.5 }} />
      <p className="font-body text-base font-semibold" style={{ color: 'var(--color-text)' }}>¡Todo al día!</p>
      <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin entregas pendientes</p>
      <button onClick={onRefresh} className="text-sm font-body" style={{ color: 'var(--color-brand)' }}>
        Actualizar
      </button>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {pending.map((a, i) => {
        const statusColor = a.status === 'in_transit' ? '#16a34a' : 'var(--color-brand)'
        const statusLabels: Record<Status, string> = { assigned: 'Asignado', accepted: 'Listo para recoger', in_transit: 'En camino', pending: 'Pendiente', delivered: 'Entregado', failed: 'Fallido' }
        const statusLabel = statusLabels[a.status] ?? a.status

        return (
          <button key={a.id} onClick={() => onSelectActive(a)}
            className="w-full text-left rounded-2xl border p-4 space-y-3 transition-all active:scale-[0.98]"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full font-mono text-sm font-bold flex items-center justify-center text-white shrink-0"
                  style={{ background: statusColor }}>
                  {i + 1}
                </span>
                <div>
                  <p className="font-body font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                    {a.customerName ?? 'Cliente'}
                  </p>
                  <p className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>#{a.orderNumber}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                  {formatCLP(Number(a.orderTotal))}
                </p>
                <span
                  className="text-[11px] font-body px-2 py-0.5 rounded-full"
                  style={{ background: `${statusColor}18`, color: statusColor }}>
                  {statusLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-body" style={{ color: 'var(--color-text-muted)' }}>
              {a.deliveryMode === 'metro'
                ? <><Train size={11} style={{ color: '#2563eb' }} />{a.metroStation} · {a.metroSlot}</>
                : <><MapPin size={11} />{a.deliveryAddress ?? 'Ver dirección'}</>
              }
            </div>

            {(a.hasFrozen || a.hasRefrigerated) && (
              <div className="flex items-center gap-1.5 text-xs font-body" style={{ color: '#2563eb' }}>
                <Snowflake size={11} />
                {a.hasFrozen ? 'Congelados — entregar primero' : 'Refrigerados'}
              </div>
            )}

            {Number(a.amountToCollect) > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-body font-semibold" style={{ color: '#b45309' }}>
                <AlertTriangle size={11} />
                Cobrar {formatCLP(Number(a.amountToCollect))} en puerta
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Tab: Historial ─────────────────────────────────────────────────────────────

function HistorialTab({ assignments }: { assignments: Assignment[] }) {
  const done = assignments.filter(a => a.status === 'delivered' || a.status === 'failed')

  if (done.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Clock size={40} strokeWidth={1.25} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
      <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin entregas completadas hoy</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th className="px-4 py-3 text-left text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}>#</th>
            <th className="px-3 py-3 text-left text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}>Cliente</th>
            <th className="px-3 py-3 text-right text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}>Total</th>
            <th className="px-4 py-3 text-right text-xs font-body font-medium" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {done.map(a => (
            <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td className="px-4 py-3 font-mono text-sm font-bold" style={{ color: 'var(--color-text)' }}>#{a.orderNumber}</td>
              <td className="px-3 py-3 font-body text-sm" style={{ color: 'var(--color-text)' }}>{a.customerName ?? '—'}</td>
              <td className="px-3 py-3 text-right font-mono text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatCLP(Number(a.orderTotal))}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className="text-xs font-body px-2 py-0.5 rounded-full"
                  style={{
                    background: a.status === 'delivered' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                    color:      a.status === 'delivered' ? '#16a34a' : '#dc2626',
                  }}>
                  {a.status === 'delivered' ? 'Entregado' : 'Fallido'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab: Perfil ───────────────────────────────────────────────────────────────

function PerfilTab({
  driver, onLogout, onShift, onToggleShift,
}: {
  driver:        Driver
  onLogout:      () => void
  onShift:       boolean | null
  onToggleShift: () => void
}) {
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch { /* silencioso */ }
    onLogout()
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-brand)' }}>
            <User size={24} color="#fff" />
          </div>
          <div>
            <p className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>{driver.name}</p>
            <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>{driver.email}</p>
            <span
              className="inline-block mt-1 text-xs font-body px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-brand)', color: '#fff' }}>
              Repartidor
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onToggleShift}
        disabled={onShift === null}
        className="w-full py-3.5 rounded-2xl text-sm font-body font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        style={{
          background: onShift ? 'var(--color-error-subtle, #fee2e2)' : 'var(--color-brand)',
          color: onShift ? 'var(--color-error, #dc2626)' : '#fff',
        }}>
        <Clock size={16} />
        {onShift === null ? 'Cargando turno…' : onShift ? 'Terminar turno' : 'Iniciar turno'}
      </button>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full py-3.5 rounded-2xl text-sm font-body font-medium flex items-center justify-center gap-2 border disabled:opacity-60"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
        <LogOut size={16} />
        {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}

// ── Bottom Nav ─────────────────────────────────────────────────────────────────

function BottomNav({
  tab, pending, onChange,
}: {
  tab:      Tab
  pending:  number
  onChange: (t: Tab) => void
}) {
  const items: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'activos',   icon: <Package size={22} />,  label: 'Activos'   },
    { id: 'historial', icon: <Clock size={22} />,    label: 'Historial' },
    { id: 'perfil',    icon: <User size={22} />,     label: 'Perfil'    },
  ]

  return (
    <nav
      className="flex items-stretch border-t shrink-0"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
    >
      {items.map(it => {
        const active = tab === it.id
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative transition-opacity"
            style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
          >
            {it.icon}
            <span className="text-[10px] font-body">{it.label}</span>
            {it.id === 'activos' && pending > 0 && (
              <span
                className="absolute top-2 right-[calc(50%-16px)] w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ background: 'var(--color-brand)' }}>
                {pending}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function RepartidorPage() {
  const [driver,       setDriver]       = useState<Driver | null>(null)
  const [assignments,  setAssignments]  = useState<Assignment[]>([])
  const [loading,      setLoading]      = useState(false)
  const [tab,          setTab]          = useState<Tab>('activos')
  const [activeDetail, setActiveDetail] = useState<Assignment | null>(null)
  const [alert,        setAlert]        = useState<DispatchAlert | null>(null)
  const [online,       setOnline]       = useState(true)
  // Turno de repartidor (adición post-entrega, 3-sep-2026) — null mientras se
  // resuelve el estado real del turno al cargar/recargar la app.
  const [onShift,      setOnShift]      = useState<boolean | null>(null)

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/delivery/assignments/mine`, { credentials: 'include' })
      if (r.status === 401) { setDriver(null); return }
      const d = await r.json() as { assignments: Assignment[] }
      setAssignments(d.assignments ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  // Restore session on mount
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then(r => r.json() as Promise<{ user: Driver | null }>)
      .then(d => { if (d.user) setDriver(d.user) })
      .catch(() => {})
  }, [])

  useEffect(() => { if (driver) loadAssignments() }, [driver, loadAssignments])

  // Estado real del turno al cargar/recargar (por si cerró la app sin
  // terminar turno y vuelve a abrir).
  useEffect(() => {
    if (!driver) return
    fetch(`${API}/api/driver/shifts/mine`, { credentials: 'include' })
      .then(r => r.json() as Promise<{ shift: { id: string } | null }>)
      .then(d => setOnShift(!!d.shift))
      .catch(() => setOnShift(false))
  }, [driver])

  async function toggleShift() {
    const startingShift = !onShift
    setOnShift(startingShift) // optimista
    try {
      await fetch(`${API}/api/driver/shifts/${startingShift ? 'start' : 'end'}`, {
        method: 'POST', credentials: 'include',
      })
    } catch {
      setOnShift(!startingShift) // revertir si falló
    }
  }

  // GPS ping every 30s
  const activeAssignmentIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    activeAssignmentIdRef.current = assignments.find(a => a.status === 'in_transit')?.id
  }, [assignments])

  useEffect(() => {
    if (!driver) return
    const id = setInterval(() => {
      const assignmentId = activeAssignmentIdRef.current
      if (!assignmentId) return
      navigator.geolocation?.getCurrentPosition(pos => {
        fetch(`${API}/api/delivery/location`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ assignmentId, latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
        }).catch(() => {})
      })
    }, 30_000)
    return () => clearInterval(id)
  }, [driver])

  // Online/offline indicator
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // SSE delivery events — solo cuando hay sesión activa
  const handleDispatchAlert = useCallback((incoming: DispatchAlert) => {
    setAlert(incoming)
    startAlarm()
  }, [])

  useDeliveryEvents(driver ? API : '', handleDispatchAlert)

  // Unlock audio en primer tap
  const handleFirstTap = useCallback(() => { unlockAudio() }, [])

  async function handleStatusUpdate(id: string, status: Status, extra?: { amountCollected?: number; paymentMethod?: string }) {
    const body: Record<string, unknown> = { status }
    if (extra?.amountCollected) { body.amountCollected = extra.amountCollected; body.paymentMethod = extra.paymentMethod ?? 'cash' }
    await fetch(`${API}/api/delivery/assignments/${id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(body),
    })
    await loadAssignments()
    if (status === 'delivered' || status === 'failed') setActiveDetail(null)
    else setActiveDetail(prev => prev ? { ...prev, status } : null)
  }

  async function handleAcceptAlert() {
    if (!alert?.assignmentId) {
      stopAlarm()
      setAlert(null)
      await loadAssignments()
      return
    }
    await fetch(`${API}/api/delivery/assignments/${alert.assignmentId}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ status: 'accepted' }),
    })
    stopAlarm()
    setAlert(null)
    await loadAssignments()
    setTab('activos')
  }

  function handleRejectAlert() {
    stopAlarm()
    setAlert(null)
  }

  if (!driver) return <LoginScreen onLogin={d => setDriver(d)} />

  const pending = assignments.filter(a => !['delivered','failed'].includes(a.status)).length

  // Detail view — full screen override
  if (activeDetail) return (
    <div className="flex flex-col h-full" onClick={handleFirstTap}>
      {alert && (
        <DispatchAlertOverlay alert={alert} onAccept={handleAcceptAlert} onReject={handleRejectAlert} />
      )}
      <ActiveDeliveryScreen
        assignment={activeDetail}
        onBack={() => setActiveDetail(null)}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-background)' }} onClick={handleFirstTap}>
      {/* Dispatch alert overlay — z-index máximo */}
      {alert && (
        <DispatchAlertOverlay alert={alert} onAccept={handleAcceptAlert} onReject={handleRejectAlert} />
      )}

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 pt-safe-top pb-3 border-b shrink-0"
        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}
      >
        <div>
          <p className="font-headline font-bold text-base" style={{ color: 'var(--color-text)' }}>SEUL DRIVE</p>
          <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>Hola, {driver.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {onShift !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: onShift ? '#16a34a' : 'var(--color-text-muted)' }} />
              <span className="font-body text-xs" style={{ color: onShift ? '#16a34a' : 'var(--color-text-muted)' }}>
                {onShift ? 'En turno' : 'Fuera de turno'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {online
              ? <Wifi size={14} style={{ color: '#16a34a' }} />
              : <WifiOff size={14} style={{ color: 'var(--color-error)' }} />
            }
            <span className="font-body text-xs" style={{ color: online ? '#16a34a' : 'var(--color-error)' }}>
              {online ? 'En línea' : 'Sin conexión'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === 'activos' && (
          <ActivesTab
            assignments={assignments}
            loading={loading}
            onSelectActive={setActiveDetail}
            onRefresh={loadAssignments}
          />
        )}
        {tab === 'historial' && <HistorialTab assignments={assignments} />}
        {tab === 'perfil'    && <PerfilTab driver={driver} onLogout={() => setDriver(null)} onShift={onShift} onToggleShift={toggleShift} />}
      </div>

      {/* Bottom nav */}
      <BottomNav tab={tab} pending={pending} onChange={setTab} />
    </div>
  )
}
