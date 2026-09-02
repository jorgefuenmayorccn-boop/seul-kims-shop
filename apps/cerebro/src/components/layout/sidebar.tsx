'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Tag, Package, ClipboardList, Shield, Settings, LogOut, ShoppingCart, Globe, Users, Users2, Truck, Clock, Building2, History } from 'lucide-react'
import { cn } from '@seul/ui'
import type { SessionUser } from '@/lib/types'

// RBAC matrix (PLAN_MAESTRO_SEUL_KING_OS.md sección 6.1, S02):
//   owner: todo · admin: todo excepto Usuarios/Seguridad ·
//   staff: solo Comandas/Despacho/Turnos/Clientes · viewer: solo lectura Dashboard/Reportes.
// `delivery` never reaches this sidebar — apps/cerebro's own layout already
// gates the whole (admin) route group to ['owner','admin','staff'] before
// this component renders (see src/app/(admin)/layout.tsx).
type Role = SessionUser['role']

const nav: { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, roles: ['owner', 'admin', 'viewer'] },
  { href: '/products',   label: 'Productos',  icon: Tag,             roles: ['owner', 'admin'] },
  { href: '/inventory',  label: 'Inventario', icon: Package,         roles: ['owner', 'admin'] },
  { href: '/comandas',   label: 'Comandas',   icon: ClipboardList,   roles: ['owner', 'admin', 'staff'] },
  { href: '/clientes',   label: 'Clientes',   icon: Users2,          roles: ['owner', 'admin', 'staff'] },
  { href: '/despacho',   label: 'Despacho',   icon: Truck,           roles: ['owner', 'admin', 'staff'] },
  { href: '/turnos',     label: 'Turnos',     icon: Clock,           roles: ['owner', 'admin', 'staff'] },
  { href: '/b2b/solicitudes', label: 'B2B Crédito', icon: Building2, roles: ['owner', 'admin'] },
  { href: '/usuarios',   label: 'Usuarios',   icon: Users,           roles: ['owner'] },
  { href: '/seguridad',  label: 'Seguridad',  icon: Shield,          roles: ['owner'] },
  { href: '/auditoria',  label: 'Auditoría',  icon: History,         roles: ['owner'] },
  { href: '/ajustes',    label: 'Ajustes',    icon: Settings,        roles: ['owner', 'admin'] },
]

const externalNav = [
  { href: 'https://pos.seoulshop.cl', label: 'POS Caja',    icon: ShoppingCart },
  { href: 'https://shop.seoulshop.cl', label: 'Tienda Web',  icon: Globe },
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
        {nav.filter(item => item.roles.includes(user.role)).map(({ href, label, icon: Icon }) => {
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
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-brand text-text-on-brand">
            {(user.name || user.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text font-body truncate">{user.name || user.email}</p>
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
