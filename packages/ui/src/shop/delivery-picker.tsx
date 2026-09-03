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

// Próximos 7 días para elegir fecha de retiro Metro (adición post-entrega,
// 3-sep-2026) — antes solo se elegía la franja horaria (ej. "11:00–13:00")
// sin decir NINGÚN día, así que un pedido no tenía forma de saber si era
// para hoy, mañana o la semana que viene. yyyy-mm-dd en horario de Chile.
export function nextDeliveryDates(count = 7): { value: string; label: string }[] {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const value = d.toISOString().slice(0, 10)
    const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ value, label })
  }
  return out
}

interface DeliveryPickerProps {
  mode: DeliveryMode
  station?: string
  slot?: string
  date?: string
  hasColdChain?: boolean
  onChange: (mode: DeliveryMode, station?: string, slot?: string, date?: string) => void
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

// Rappi suspendido temporalmente (adición post-entrega, 3-sep-2026) — nunca
// hubo una integración real con la API de Rappi (POST /api/delivery/dispatch-rappi
// es solo un formulario donde el staff anota a mano que despachó afuera, no
// llama a ningún API real). El dueño pidió sacarlo de las opciones de
// checkout hasta que se pueda conectar de verdad. Queda todo el código
// intacto — reactivar es borrar esta constante.
const RAPPI_SUSPENDED = true

export function DeliveryPicker({ mode, station, slot, date, hasColdChain, onChange }: DeliveryPickerProps) {
  const dates = nextDeliveryDates()
  return (
    <div className="space-y-3">
      {OPTIONS.map(opt => {
        const active = mode === opt.id
        const blocked = (hasColdChain && opt.id === 'shipping') || (RAPPI_SUSPENDED && opt.id === 'rappi')

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
                    {RAPPI_SUSPENDED && opt.id === 'rappi'
                      ? 'Temporalmente no disponible'
                      : 'No disponible — tu pedido tiene productos con cadena de frío'}
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
                    Fecha de retiro
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {dates.map(d => (
                      <button
                        key={d.value}
                        onClick={() => onChange('metro', station, slot, d.value)}
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-full border transition-colors font-body',
                          date === d.value
                            ? 'bg-[var(--color-channel-metro)] text-white border-[var(--color-channel-metro)]'
                            : 'border-[var(--color-border)] text-text-muted hover:text-text hover:bg-surface',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide font-body block mb-1.5">
                    Estación
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MERVAL_STATIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => onChange('metro', s, slot, date)}
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
                          onClick={() => onChange('metro', station, s, date)}
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
