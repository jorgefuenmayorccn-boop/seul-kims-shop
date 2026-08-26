'use client'
import { EditorialHero } from '@seul/ui/shop/editorial-hero'
import { useLocaleStore } from '@/lib/locale-store'
import { getDictionary } from '@/lib/i18n/dictionaries'

export function LocaleHero() {
  const { locale } = useLocaleStore()
  const t = getDictionary(locale)

  return (
    <EditorialHero
      headline={t.hero.headline}
      subheadline={t.hero.sub}
      ctaLabel={t.hero.cta}
      ctaHref="/productos"
    />
  )
}
