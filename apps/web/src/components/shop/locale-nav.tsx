'use client'
import { useLocaleStore } from '@/lib/locale-store'
import { getDictionary } from '@/lib/i18n/dictionaries'

export function LocaleNav() {
  const { locale } = useLocaleStore()
  const t = getDictionary(locale)

  const links = [
    { href: '/productos', label: t.nav.products, ko: '상품' },
    { href: '/b2b',       label: t.nav.wholesale, ko: '도매' },
  ]

  return (
    <nav className="hidden md:flex items-center gap-8">
      {links.map(item => (
        <a
          key={item.href}
          href={item.href}
          className="flex flex-col items-center gap-0.5 group"
        >
          <span
            className="font-body text-[10px] font-semibold tracking-widest transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--color-heuk)', opacity: 0.55, letterSpacing: '0.16em' }}
          >
            {item.label}
          </span>
          <span
            className="font-korean text-[10px] transition-colors"
            style={{ color: 'var(--color-celadon)', opacity: 0.6 }}
          >
            {item.ko}
          </span>
        </a>
      ))}
    </nav>
  )
}
