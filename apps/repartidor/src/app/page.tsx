'use client'
import { useState, useEffect } from 'react'
import { MapPin, Phone, QrCode, CheckCircle, Snowflake, AlertTriangle, Train, Truck } from 'lucide-react'
import { StatusPill, ColdChainAlert, cn, formatCLP } from '@seul/ui'

type DeliveryMode = 'rappi' | 'metro' | 'pickup'
interface Route {
  id:           string
  number:       number
  customerName: string
  address?:     string
  phone?:       string
  deliveryMode: DeliveryMode
  metroStation: string | null
  metroSlot:    string | null
  total:        number
  hasFrozen:    boolean
  hasRefrigerated: boolean
  status:       'pendiente' | 'en_camino' | 'entregado'
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'
const MOCK_ROUTES: Route[] = [
  { id: '1', number: 1042, customerName: 'María González', deliveryMode: 'metro', metroStation: 'Miramar', metroSlot: '15:00–17:00', total: 12780, hasFrozen: false, hasRefrigerated: true, status: 'pendiente', phone: '+56936451991' },
  { id: '2', number: 1043, customerName: 'Jorge Fuentes', deliveryMode: 'rappi', address: 'Av. Libertad 1234, Viña del Mar', total: 8990, hasFrozen: true, hasRefrigerated: false, status: 'pendiente', phone: '+56912345678' },
  { id: '3', number: 1044, customerName: 'Ana Martínez', deliveryMode: 'metro', metroStation: 'Viña del Mar', metroSlot: '17:00–19:00', total: 5490, hasFrozen: false, hasRefrigerated: false, status: 'pendiente', phone: '+56987654321' },
]

export default function RepartidorPage() {
  const [routes, setRoutes] = useState<Route[]>(MOCK_ROUTES)
  const [active, setActive] = useState<Route | null>(null)
  const [scanning, setScanning] = useState(false)

  const pending = routes.filter(r => r.status === 'pendiente')
  const done    = routes.filter(r => r.status === 'entregado')

  function markDelivered(id: string) {
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, status: 'entregado' as const } : r))
    setActive(null)
    fetch(`${API}/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'entregada' }),
    }).catch(() => {/* retry offline */})
  }

  // Vista de entrega activa
  if (active) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="px-4 py-4 bg-brand text-white flex items-center gap-3">
          <button onClick={() => setActive(null)} className="text-white/80 hover:text-white">←</button>
          <div>
            <p className="font-headline font-bold">Entrega #{active.number}</p>
            <p className="text-sm text-white/80 font-body">{active.customerName}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Destino */}
          <div className="bg-elevated rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-start gap-3">
              {active.deliveryMode === 'metro' ? <Train size={20} className="text-[var(--color-channel-metro)] mt-0.5 shrink-0" /> : <Truck size={20} className="text-[var(--color-channel-rappi)] mt-0.5 shrink-0" />}
              <div>
                {active.deliveryMode === 'metro' ? (
                  <>
                    <p className="font-semibold font-body text-text">Estación {active.metroStation}</p>
                    <p className="text-sm text-text-muted font-mono">{active.metroSlot}</p>
                  </>
                ) : (
                  <p className="font-semibold font-body text-text">{active.address}</p>
                )}
              </div>
            </div>
          </div>

          {/* Alerta cadena de frío */}
          <ColdChainAlert hasFrozen={active.hasFrozen} hasRefrigerated={active.hasRefrigerated} />

          {active.hasFrozen && (
            <div className="flex items-center gap-2 p-3 bg-cold-frozen-bg rounded-xl text-cold-frozen text-sm font-body">
              <Snowflake size={16} />
              <strong>Entregar este pedido primero</strong> — contiene congelados
            </div>
          )}

          {/* Total */}
          <div className="bg-elevated rounded-xl border border-[var(--color-border)] p-4 flex justify-between items-center">
            <p className="font-body text-text-muted text-sm">Total del pedido</p>
            <p className="font-mono font-bold text-xl text-text">{formatCLP(active.total)}</p>
          </div>

          {/* Contacto */}
          {active.phone && (
            <a
              href={`tel:${active.phone}`}
              className="flex items-center gap-3 p-4 bg-elevated rounded-xl border border-[var(--color-border)] hover:bg-surface transition-colors"
            >
              <Phone size={18} className="text-text-muted" />
              <div>
                <p className="text-sm font-semibold font-body text-text">Llamar cliente</p>
                <p className="text-xs font-mono text-text-muted">{active.phone}</p>
              </div>
            </a>
          )}

          {/* QR Scanner hint */}
          <button
            onClick={() => setScanning(true)}
            className={cn(
              'w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-dashed',
              scanning ? 'border-brand text-brand' : 'border-[var(--color-border)] text-text-muted',
              'hover:border-brand hover:text-brand transition-colors font-body font-medium',
            )}
          >
            <QrCode size={20} />
            {scanning ? 'Escaneando QR…' : 'Escanear QR de confirmación'}
          </button>
        </div>

        {/* Botón entregado */}
        <div className="p-4 border-t border-[var(--color-border)]">
          <button
            onClick={() => markDelivered(active.id)}
            className="w-full py-4 rounded-xl bg-success text-white font-headline font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <CheckCircle size={22} />
            Entrega confirmada
          </button>
        </div>
      </div>
    )
  }

  // Lista de rutas
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-4 bg-brand text-white">
        <p className="font-headline font-bold text-lg">Seoul Kims · Ruta</p>
        <p className="text-sm text-white/80 font-body">
          {pending.length} pendiente{pending.length !== 1 ? 's' : ''} · {done.length} entregado{done.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
            <CheckCircle size={48} className="text-success opacity-50" />
            <p className="font-body">¡Todas las entregas completadas!</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {pending.map((route, i) => (
              <button
                key={route.id}
                onClick={() => setActive(route)}
                className="w-full text-left bg-elevated rounded-xl border border-[var(--color-border)] p-4 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-brand text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold font-body text-text text-sm">{route.customerName}</p>
                      <p className="text-xs font-mono text-text-muted">#{route.number}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-sm text-text">{formatCLP(route.total)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  {route.deliveryMode === 'metro' ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-channel-metro)] font-body">
                      <Train size={12} />
                      {route.metroStation} · {route.metroSlot}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-channel-rappi)] font-body">
                      <Truck size={12} />
                      {route.address}
                    </div>
                  )}
                </div>

                {(route.hasFrozen || route.hasRefrigerated) && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-cold-frozen font-body">
                    <Snowflake size={11} />
                    {route.hasFrozen ? 'Congelados — entregar primero' : 'Refrigerados'}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
