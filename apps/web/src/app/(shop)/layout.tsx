import type { Metadata } from 'next'
import { WhatsAppCTA } from '@seul/ui'

export const metadata: Metadata = {
  title: {
    default: 'Seoul Kims — Tienda coreana en Viña del Mar',
    template: '%s | Seoul Kims',
  },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-elevated/95 backdrop-blur border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-headline font-bold text-brand text-xl">SEOUL KIMS</a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-body text-text-muted">
            <a href="/productos" className="hover:text-text transition-colors">Productos</a>
            <a href="/b2b" className="hover:text-text transition-colors">Mayorista</a>
            <a href="/cuenta" className="hover:text-text transition-colors">Mi cuenta</a>
          </nav>
          <a
            href="/checkout"
            className="flex items-center gap-1.5 text-sm font-body font-medium text-text hover:text-brand transition-colors"
          >
            🛒 Carrito
          </a>
        </div>
      </header>

      <main className="min-h-screen bg-background">
        {children}
      </main>

      <footer className="bg-[var(--ink-900)] text-[var(--cream-500)] py-12 mt-16">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8">
          <div>
            <p className="font-headline font-bold text-xl text-white mb-2">SEOUL KIMS</p>
            <p className="text-sm opacity-70 font-body">Tienda coreana en Viña del Mar, Chile.<br />Importadores directos desde Corea del Sur.</p>
            <p className="text-xs opacity-50 font-mono mt-3">@seulshopcl · seoulkims.cl</p>
          </div>
          <div>
            <p className="font-semibold font-body mb-3">Entrega</p>
            <ul className="space-y-1 text-sm opacity-70 font-body">
              <li>🚉 Retiro Metro Merval — gratis</li>
              <li>🛵 Rappi — Viña, Reñaca, Concón</li>
              <li>🏪 Retiro en tienda</li>
              <li>📦 Despacho a regiones</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold font-body mb-3">Legal</p>
            <ul className="space-y-1 text-sm opacity-70 font-body">
              <li><a href="/privacidad" className="hover:opacity-100 transition-opacity">Política de privacidad</a></li>
              <li><a href="/terminos" className="hover:opacity-100 transition-opacity">Términos y condiciones</a></li>
              <li><a href="/arcop" className="hover:opacity-100 transition-opacity">Solicitud ARCOP (Ley 21.719)</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-8 mt-8 border-t border-white/10 text-xs opacity-40 font-body">
          © {new Date().getFullYear()} Seoul Kims · Viña del Mar, Chile · RUT por confirmar
        </div>
      </footer>

      {/* WhatsApp flotante en toda la tienda */}
      <WhatsAppCTA variant="floating" />
    </>
  )
}
