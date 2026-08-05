'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart,
  ClipboardList, Truck, Shield, ArrowLeftRight, Settings,
} from 'lucide-react'
import { cn } from '@seul/ui'

const nav = [
  { href: '/cerebro/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/cerebro/inventory',  label: 'Inventario',  icon: Package },
  { href: '/cerebro/pos',        label: 'POS Caja',    icon: ShoppingCart },
  { href: '/cerebro/comandas',   label: 'Comandas',    icon: ClipboardList },
  { href: '/cerebro/logistics',  label: 'Logística',   icon: Truck },
  { href: '/cerebro/returns',    label: 'Devoluciones',icon: ArrowLeftRight },
  { href: '/cerebro/security',   label: 'Seguridad',   icon: Shield },
  { href: '/cerebro/settings',   label: 'Ajustes',     icon: Settings },
]

export function CerebroSidebar() {
  const path = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-elevated border-r border-[var(--color-border)] flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <p className="font-headline font-bold text-brand text-lg leading-tight">SEUL KING</p>
        <p className="font-mono text-[10px] text-text-muted tracking-widest">OS v1.0</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-5 py-2.5 text-sm font-body transition-colors',
                active
                  ? 'bg-brand/5 text-brand font-semibold border-r-2 border-brand'
                  : 'text-text-muted hover:text-text hover:bg-surface',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer — info tienda */}
      <div className="px-5 py-4 border-t border-[var(--color-border)]">
        <p className="text-xs font-semibold text-text font-body">Seoul Kims</p>
        <p className="text-[11px] text-text-muted font-body">Viña del Mar</p>
        <p className="text-[11px] text-text-muted font-mono">@seulshopcl</p>
      </div>
    </aside>
  )
}
