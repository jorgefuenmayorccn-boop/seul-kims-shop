import type { Metadata } from 'next'
import { CartButton } from '@/components/shop/cart-button'
import { CartDrawer } from '@/components/shop/cart-drawer'
import { AuthSlot } from '@/components/shop/auth-slot'
import { LanguageSwitcher } from '@/components/shop/language-switcher'
import { LocaleNav } from '@/components/shop/locale-nav'
import { MobileMenu } from '@/components/shop/mobile-menu'

export const metadata: Metadata = {
  title: {
    default: 'SEOUL SHOP — Tienda coreana en Viña del Mar',
    template: '%s | SEOUL SHOP',
  },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Header editorial */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: 'rgba(245,245,242,0.96)',
          borderBottom: 'var(--border-editorial)',
        }}
      >
        <div className="flex items-center justify-between px-6 md:px-12 h-14 gap-4">
          {/* Menú mobile + Logotipo */}
          <div className="flex items-center gap-3 shrink-0">
            <MobileMenu />
            <a href="/" className="flex items-baseline gap-2.5 group shrink-0">
            <span
              className="font-korean font-black text-xl leading-none transition-colors"
              style={{ color: 'var(--color-seoul-red)' }}
            >
              서울킴스
            </span>
            <span
              className="font-body font-semibold text-sm tracking-widest hidden sm:block"
              style={{ color: 'var(--color-heuk)', opacity: 0.55, letterSpacing: '0.16em' }}
            >
              SEOUL SHOP
            </span>
            </a>
          </div>

          {/* Nav central — locale-aware */}
          <LocaleNav />

          {/* Derecha: idioma + auth + carrito */}
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <AuthSlot />
            <CartButton />
          </div>
        </div>
      </header>

      <main className="min-h-screen" style={{ background: 'var(--color-baek-pure, var(--baek-50))' }}>
        {children}
      </main>

      {/* ChatWidget oculto (adición post-entrega, 3-sep-2026) — el "Asistente
          Seoul Shop" nunca tuvo backend real (POST /api/chat no existe),
          siempre caía a un mensaje de error con WhatsApp. Decisión del
          dueño: ocultarlo hasta que haya un asistente real conectado. El
          componente sigue en packages/ui/src/chat/chat-widget.tsx — reactivar
          es reimportar y volver a montar <ChatWidget />. */}
      <CartDrawer />
    </>
  )
}
