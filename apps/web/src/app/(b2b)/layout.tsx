import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { B2BAuthNav } from '@/components/b2b/b2b-auth-nav'

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
            {/* "Mi Cuenta" (link estático a /b2b/dashboard) se reemplazó por
                B2BAuthNav: ese link ya vive dentro de ella cuando hay sesión
                (nombre de la empresa → /b2b/dashboard), y sin sesión el
                dashboard solo rebota a /b2b/login de todas formas. */}
            <B2BAuthNav />
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
