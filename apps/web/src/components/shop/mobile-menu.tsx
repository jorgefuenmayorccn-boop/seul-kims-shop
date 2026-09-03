'use client'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useLocaleStore } from '@/lib/locale-store'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { LanguageSwitcher } from './language-switcher'

// LocaleNav (Productos/Mayorista) vive en "hidden md:flex" sin ningún
// reemplazo mobile — en un celular esos links quedaban inalcanzables, no
// solo apretados (adición post-entrega, 3-sep-2026 — el dueño pidió adaptar
// las 4 apps a mobile/tablet después de mandar una captura de cerebro roto
// en su celular; auditoría del mismo día encontró este gap en la tienda).
export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const { locale } = useLocaleStore()
  const t = getDictionary(locale)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const links = [
    { href: '/productos', label: t.nav.products, ko: '상품' },
    { href: '/b2b',       label: t.nav.wholesale, ko: '도매' },
  ]

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="p-1.5 -ml-1.5"
        style={{ color: 'var(--color-heuk)', opacity: 0.7 }}
      >
        <Menu size={20} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(10,10,10,0.4)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed top-0 left-0 right-0 z-50 px-6 py-5"
            style={{ background: 'var(--color-baek-pure, #f5f5f2)', borderBottom: 'var(--border-editorial)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-korean font-black text-lg" style={{ color: 'var(--color-seoul-red)' }}>서울킴스</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú" style={{ color: 'var(--color-heuk)', opacity: 0.6 }}>
                <X size={20} />
              </button>
            </div>

            <nav className="flex flex-col gap-4 mb-6">
              {links.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline gap-2.5"
                >
                  <span className="font-body text-sm font-semibold tracking-widest" style={{ color: 'var(--color-heuk)', letterSpacing: '0.14em' }}>
                    {item.label}
                  </span>
                  <span className="font-korean text-xs" style={{ color: 'var(--color-celadon)', opacity: 0.7 }}>
                    {item.ko}
                  </span>
                </a>
              ))}
            </nav>

            <div className="pt-4" style={{ borderTop: 'var(--border-editorial)' }}>
              <LanguageSwitcher />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
