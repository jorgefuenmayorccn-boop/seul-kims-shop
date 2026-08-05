'use client'
import { Truck, Train, Store, Package } from 'lucide-react'
import { cn } from '../lib/utils'

export type DeliveryMode = 'rappi' | 'metro' | 'pickup' | 'shipping'

// Estaciones Merval (actualizar con dueño)
export const MERVAL_STATIONS = [
  'Viña del Mar',
  'Miramar',
  'Chorrillos',
  'El Salto',
  'Recreo',
  'Barón',
  'Puerto',
  'Bellavista',
  'Francia',
] as const

export const MERVAL_SLOTS = [
  '09:00–11:00',
  '11:00–13:00',
  '13:00–15:00',
  '15:00–17:00',
  '17:00–19:00',
  '19:00–21:00',
] as const

interface DeliveryPickerProps {
  mode: DeliveryMode
  station?: string
  slot?: string
  hasColdChain?: boolean
  onChange: (mode: DeliveryMode, station?: string, slot?: string) => void
}

const OPTIONS: { id: DeliveryMode; label: string; sublabel: string; icon: typeof Truck; color: string }[] = [
  {
    id: 'rappi',
    label: 'Rappi Express',
    sublabel: '30–60 min · Viña, Reñaca, Concón',
    icon: Truck,
    color: 'text-[var(--color-channel-rappi)]',
  },
  {
    id: 'metro',
    label: 'Retiro Metro Merval',
    sublabel: 'Gratis · Elegir estación y franja',
    icon: Train,
    color: 'text-[var(--color-channel-metro)]',
  },
  {
    id: 'pickup',
    label: 'Retiro en tienda',
    sublabel: 'Gratis · Viña del Mar',
    icon: Store,
    color: 'text-text-muted',
  },
  {
    id: 'shipping',
    label: 'Despacho a regiones',
    sublabel: 'Chilexpress · 3–5 días hábiles',
    icon: Package,
    color: 'text-text-muted',
  },
]

export function DeliveryPicker({ mode, station, slot, hasColdChain, onChange }: DeliveryPickerProps) {
  return (
    <div className="space-y-3">
      {OPTIONS.map(opt => {
        const active = mode === opt.id
        const blocked = hasColdChain && opt.id === 'shipping'

        return (
          <div key={opt.id}>
            <button
              onClick={() => !blocked && onChange(opt.id)}
              disabled={blocked}
              className={cn(
                'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                active
                  ? 'border-brand bg-brand/5 shadow-sm'
                  : 'border-[var(--color-border)] bg-elevated hover:bg-surface',
                blocked && 'opacity-40 cursor-not-allowed',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                active ? 'bg-brand/10' : 'bg-surface',
              )}>
                <opt.icon size={18} className={active ? 'text-brand' : opt.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('font-semibold text-sm font-body', active ? 'text-brand' : 'text-text')}>
                  {opt.label}
                </p>
                <p className="text-xs text-text-muted font-body mt-0.5">{opt.sublabel}</p>
                {blocked && (
                  <p className="text-xs text-error font-body mt-1">
                    No disponible — tu pedido tiene productos con cadena de frío
                  </p>
                )}
              </div>
              <div className={cn(
                'w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors',
                active ? 'border-brand bg-brand' : 'border-[var(--color-border)]',
              )} />
            </button>

            {/* Selección de estación Merval */}
            {active && opt.id === 'metro' && (
              <div className="mt-2 ml-4 space-y-3 pl-3 border-l-2 border-brand/20">
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide font-body block mb-1.5">
                    Estación
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MERVAL_STATIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => onChange('metro', s, slot)}
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-full border transition-colors font-body',
                          station === s
                            ? 'bg-[var(--color-channel-metro)] text-white border-[var(--color-channel-metro)]'
                            : 'border-[var(--color-border)] text-text-muted hover:text-text hover:bg-surface',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {station && (
                  <div>
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide font-body block mb-1.5">
                      Franja horaria
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {MERVAL_SLOTS.map(s => (
                        <button
                          key={s}
                          onClick={() => onChange('metro', station, s)}
                          className={cn(
                            'text-xs px-3 py-1.5 rounded-full border font-mono transition-colors',
                            slot === s
                              ? 'bg-[var(--color-channel-metro)] text-white border-[var(--color-channel-metro)]'
                              : 'border-[var(--color-border)] text-text-muted hover:text-text hover:bg-surface',
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
