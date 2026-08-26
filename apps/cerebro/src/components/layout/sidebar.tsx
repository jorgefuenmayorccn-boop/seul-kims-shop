'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Tag, Package, ClipboardList, Shield, Settings, LogOut, ShoppingCart, Globe, Users, Users2, Truck, Clock, Building2 } from 'lucide-react'
import { cn } from '@seul/ui'
import type { SessionUser } from '@/lib/types'

const nav = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/products',   label: 'Productos',  icon: Tag },
  { href: '/inventory',  label: 'Inventario', icon: Package },
  { href: '/comandas',   label: 'Comandas',   icon: ClipboardList },
  { href: '/clientes',   label: 'Clientes',   icon: Users2 },
  { href: '/despacho',   label: 'Despacho',   icon: Truck },
  { href: '/turnos',     label: 'Turnos',     icon: Clock },
  { href: '/b2b/solicitudes', label: 'B2B Crédito', icon: Building2 },
  { href: '/usuarios',   label: 'Usuarios',   icon: Users },
  { href: '/seguridad',  label: 'Seguridad',  icon: Shield },
  { href: '/ajustes',    label: 'Ajustes',    icon: Settings },
]

const externalNav = [
  { href: 'http://localhost:3001', label: 'POS Caja',    icon: ShoppingCart },
  { href: 'http://localhost:3000', label: 'Tienda Web',  icon: Globe },
]

interface Props { user: SessionUser }

export function Sidebar({ user }: Props) {
  const path = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-elevated border-r border-[var(--color-border)] flex flex-col h-full">
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <Link href="/dashboard">
          <p className="font-headline font-bold text-brand text-lg leading-tight">SEUL KING OS</p>
          <p className="font-mono text-[10px] text-text-muted tracking-widest">V1.0</p>
        </Link>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-5 py-2.5 text-sm font-body transition-colors',
                active
                  ? 'bg-brand/5 text-brand font-semibold border-r-2 border-brand'
                  : 'text-text-muted hover:text-text hover:bg-surface',
              )}>
              <Icon size={16} />
              {label}
            </Link>
          )
        })}

        <div className="mx-5 my-2 border-t border-[var(--color-border)]" />

        {externalNav.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-5 py-2.5 text-sm font-body text-text-muted hover:text-text hover:bg-surface transition-colors">
            <Icon size={16} />
            {label}
            <span className="ml-auto text-[10px] opacity-40">↗</span>
          </a>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{ background: 'var(--color-brand)', color: '#fff' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text font-body truncate">{user.name}</p>
            <p className="text-[10px] text-text-muted font-mono capitalize">{user.role}</p>
          </div>
        </div>
        <button type="button"
          className="flex items-center gap-2 w-full text-[11px] text-text-muted hover:text-error transition-colors"
          onClick={async () => {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'}/api/auth/logout`, { method: 'POST', credentials: 'include' })
            window.location.href = '/login'
          }}>
          <LogOut size={12} />
          Cerrar sesión
        </button>
        <p className="text-[9px] text-text-muted font-mono mt-3 opacity-40">Creado por VÉRTICE Productions</p>
      </div>
    </aside>
  )
}
