'use client'
import { useState, useEffect } from 'react'
import { formatCLP } from '@seul/ui'
import {
  IconAll, IconRamen, IconKimchi, IconSnacks,
  IconDrink, IconSauce, IconFrozen, IconBeauty,
} from '../icons/pos-icons'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface ApiCategory {
  id:        string
  name:      string
  slug:      string
  emoji?:    string | null
  sortOrder?: number | null
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {
  ramen:      IconRamen,
  kimchi:     IconKimchi,
  snacks:     IconSnacks,
  bebidas:    IconDrink,
  salsas:     IconSauce,
  congelados: IconFrozen,
  kbeauty:    IconBeauty,
}

interface CategoryRailProps {
  active:        string | null
  onSelect:      (id: string | null) => void
  totalSold?:    number
  ticketCount?:  number
  tillReady?:    boolean
  onCloseTill?:  () => void
  onCloseShift?: () => void
}

export function CategoryRail({
  active, onSelect, totalSold = 0, ticketCount = 0, tillReady, onCloseTill, onCloseShift,
}: CategoryRailProps) {
  const [categories, setCategories] = useState<ApiCategory[]>([])

  useEffect(() => {
    fetch(`${API}/api/products/meta/categories`, { credentials: 'include' })
      .then(r => r.json() as Promise<{ categories: ApiCategory[] }>)
      .then(d => setCategories(d.categories ?? []))
      .catch(() => { /* silencioso — muestra solo "Todo" */ })
  }, [])

  return (
    <aside
      className="flex flex-col shrink-0 border-r"
      style={{
        width: 'var(--pos-category-width)',
        background:  'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <nav className="flex-1 overflow-y-auto py-2">
        {/* "Todo" siempre primero */}
        <CategoryButton
          id={null}
          label="Todo"
          ko="전체"
          Icon={IconAll}
          active={active === null}
          onSelect={onSelect}
        />

        {categories.map(cat => {
          const Icon = ICON_MAP[cat.slug] ?? IconAll
          return (
            <CategoryButton
              key={cat.id}
              id={cat.id}
              label={cat.name}
              ko={cat.emoji ?? ''}
              Icon={Icon}
              active={active === cat.id}
              onSelect={onSelect}
            />
          )
        })}
      </nav>

      {/* Footer turno */}
      <div
        className="px-4 py-3 border-t space-y-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {totalSold > 0 && (
          <div>
            <p className="font-mono text-xs font-bold" style={{ color: 'var(--color-text)' }}>
              {formatCLP(totalSold)}
            </p>
            <p className="font-body text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {ticketCount} {ticketCount === 1 ? 'venta' : 'ventas'} hoy
            </p>
          </div>
        )}
        {tillReady && onCloseTill && (
          <button
            onClick={onCloseTill}
            className="w-full text-left font-body text-xs py-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cerrar Caja
          </button>
        )}
        {!tillReady && onCloseShift && (
          <button
            onClick={onCloseShift}
            className="w-full text-left font-body text-xs py-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cerrar Turno
          </button>
        )}
      </div>
    </aside>
  )
}

interface CategoryButtonProps {
  id:       string | null
  label:    string
  ko:       string
  Icon:     React.ComponentType<{ size?: number; color?: string; className?: string }>
  active:   boolean
  onSelect: (id: string | null) => void
}

function CategoryButton({ id, label, ko, Icon, active, onSelect }: CategoryButtonProps) {
  return (
    <button
      onClick={() => onSelect(id)}
      className="w-full flex items-center gap-3 px-4 transition-colors"
      style={{
        minHeight: 'var(--pos-hit-area-min)',
        background:  active ? 'var(--color-brand-subtle, rgba(215,38,61,0.06))' : 'transparent',
        borderRight: active ? '2px solid var(--color-brand)' : '2px solid transparent',
        color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
      }}
      aria-current={active ? 'true' : undefined}
    >
      <Icon
        size={18}
        color={active ? 'var(--color-brand)' : 'var(--color-text-muted)'}
      />
      <div className="text-left">
        <p
          className="font-body text-sm font-medium leading-tight"
          style={{ color: active ? 'var(--color-brand)' : 'var(--color-text)' }}
        >
          {label}
        </p>
        {ko && (
          <p
            className="font-korean text-[10px]"
            style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-muted)', opacity: 0.7 }}
          >
            {ko}
          </p>
        )}
      </div>
    </button>
  )
}
