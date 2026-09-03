'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Tag, Package, ClipboardList, Shield, Settings, LogOut, ShoppingCart, Globe, Users, Users2, Truck, Clock, Building2, History, Menu, X, Bike } from 'lucide-react'
import { cn } from '@seul/ui'
import type { SessionUser } from '@/lib/types'

// RBAC matrix (PLAN_MAESTRO_SEUL_KING_OS.md sección 6.1, S02):
//   owner: todo · admin: todo excepto Usuarios/Seguridad ·
//   manager (Gerente de local, agregado 3-sep-2026, Fase 2 multilocal):
//     lo mismo que staff + Productos (pedido explícito del dueño — ver/
//     agregar/modificar, trazado en Auditoría vía audit_log) ·
//   staff: solo Comandas/Despacho/Turnos/Clientes · viewer: solo lectura Dashboard/Reportes.
// `delivery` never reaches this sidebar — apps/cerebro's own layout already
// gates the whole (admin) route group to ['owner','admin','manager','staff']
// before this component renders (see src/app/(admin)/layout.tsx).
type Role = SessionUser['role']

const nav: { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, roles: ['owner', 'admin', 'viewer'] },
  { href: '/products',   label: 'Productos',  icon: Tag,             roles: ['owner', 'admin', 'manager'] },
  { href: '/inventory',  label: 'Inventario', icon: Package,         roles: ['owner', 'admin'] },
  { href: '/comandas',   label: 'Comandas',   icon: ClipboardList,   roles: ['owner', 'admin', 'manager', 'staff'] },
  { href: '/clientes',   label: 'Clientes',   icon: Users2,          roles: ['owner', 'admin', 'manager', 'staff'] },
  { href: '/despacho',   label: 'Despacho',   icon: Truck,           roles: ['owner', 'admin', 'manager', 'staff'] },
  { href: '/turnos-delivery', label: 'Turnos Delivery', icon: Bike,  roles: ['owner', 'admin', 'manager', 'staff'] },
  { href: '/turnos',     label: 'Turnos',     icon: Clock,           roles: ['owner', 'admin', 'manager', 'staff'] },
  { href: '/b2b/solicitudes', label: 'B2B Crédito', icon: Building2, roles: ['owner', 'admin'] },
  { href: '/usuarios',   label: 'Usuarios',   icon: Users,           roles: ['owner'] },
  { href: '/seguridad',  label: 'Seguridad',  icon: Shield,          roles: ['owner'] },
  { href: '/auditoria',  label: 'Auditoría',  icon: History,         roles: ['owner'] },
  // Ajustes pasó a owner-only (Fase 3 multilocal, 3-sep-2026) — ahora
  // incluye credenciales DTE por local, mismo criterio que Usuarios/
  // Seguridad/Auditoría.
  { href: '/ajustes',    label: 'Ajustes',    icon: Settings,        roles: ['owner'] },
]

const externalNav = [
  { href: 'https://pos.seoulshop.cl', label: 'POS Caja',    icon: ShoppingCart },
  { href: 'https://shop.seoulshop.cl', label: 'Tienda Web',  icon: Globe },
]

interface Props { user: SessionUser }

export function Sidebar({ user }: Props) {
  const path = usePathname()
  // Drawer mobile (adición post-entrega, 3-sep-2026 — el dueño mandó una
  // captura real de Comandas en su celular: el sidebar de 224px fijos se
  // comía media pantalla). Debajo de `md` el <aside> vive fuera del flujo
  // (fixed) y se desliza con un botón hamburguesa; desde `md` para arriba
  // el comportamiento es exactamente el de antes (estático, siempre visible).
  const [open, setOpen] = useState(false)

  // Cerrar el drawer automáticamente al navegar — si no, un tap en un link
  // deja el overlay abierto tapando la pantalla nueva.
  useEffect(() => { setOpen(false) }, [path])

  return (
    <>
      {/* Barra superior mobile — el <aside> es `fixed` en mobile (fuera del
          flujo), así que sin esto no habría ningún punto de entrada visible
          para abrir el menú en una pantalla angosta. */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center justify-between px-4 bg-elevated border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="p-1.5 -ml-1.5 text-text-muted hover:text-text transition-colors"
        >
          <Menu size={20} />
        </button>
        <Link href="/dashboard" className="font-headline font-bold text-brand text-sm">SEUL KING OS</Link>
        <div className="w-8" />
      </div>

      {/* Backdrop mobile */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={cn(
        'w-64 md:w-56 shrink-0 bg-elevated border-r border-[var(--color-border)] flex flex-col h-full',
        'fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:z-auto md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <Link href="/dashboard">
            <p className="font-headline font-bold text-brand text-lg leading-tight">SEUL KING OS</p>
            <p className="font-mono text-[10px] text-text-muted tracking-widest">V1.0</p>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="md:hidden p-1 text-text-muted hover:text-text transition-colors"
          >
            <X size={18} />
          </button>
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
    </>
  )
}
