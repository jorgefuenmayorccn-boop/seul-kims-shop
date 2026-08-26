import type { Metadata } from 'next'
import Link from 'next/link'
import { ShoppingBag, LayoutDashboard, BookOpen, LogIn } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Portal B2B — SEUL SHOP',
  description: 'Portal mayorista SEUL SHOP — precios netos, crédito y gestión de pedidos',
}

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface-sunken)]">
      {/* Barra superior */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-[var(--color-brand)]">SEUL SHOP</span>
            <span className="rounded bg-[var(--color-brand)]/10 px-1.5 py-0.5 text-xs font-semibold text-[var(--color-brand)]">B2B</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/b2b/catalogo"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
            >
              <BookOpen className="size-4" />
              Catálogo
            </Link>
            <Link
              href="/b2b/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
            >
              <LayoutDashboard className="size-4" />
              Mi Cuenta
            </Link>
            <Link
              href="/b2b/login"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
            >
              <LogIn className="size-4" />
              Iniciar sesión
            </Link>
            <Link
              href="/b2b/registro"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <ShoppingBag className="size-4" />
              Solicitar cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="mt-16 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 text-center text-xs text-[var(--color-text-secondary)]">
        <p>SEUL SHOP @seulshopcl — Portal Mayorista · Viña del Mar, Chile</p>
        <p className="mt-1">Consultas: <a href="https://wa.me/56936451991" className="underline hover:text-[var(--color-brand)]">+56 9 3645 1991</a></p>
        <p className="mt-2 opacity-50">Creado por VÉRTICE Productions</p>
      </footer>
    </div>
  )
}
