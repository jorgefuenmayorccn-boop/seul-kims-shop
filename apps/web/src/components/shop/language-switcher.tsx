'use client'
import { useLocaleStore, type Locale } from '@/lib/locale-store'

const LANGS: { id: Locale; label: string; ko: string }[] = [
  { id: 'es', label: 'ES', ko: '스페인어' },
  { id: 'ko', label: 'KO', ko: '한국어' },
  { id: 'en', label: 'EN', ko: '영어' },
]

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocaleStore()

  return (
    <div className="flex items-center gap-1" aria-label="Idioma">
      {LANGS.map((lang, i) => (
        <span key={lang.id} className="flex items-center gap-1">
          {i > 0 && (
            <span
              className="text-[10px] select-none"
              style={{ color: 'var(--color-heuk)', opacity: 0.25 }}
            >
              /
            </span>
          )}
          <button
            onClick={() => setLocale(lang.id)}
            className="font-body text-[10px] font-semibold tracking-widest transition-opacity"
            style={{
              color: 'var(--color-heuk)',
              opacity: locale === lang.id ? 0.9 : 0.35,
              letterSpacing: '0.12em',
            }}
            aria-label={lang.ko}
            aria-pressed={locale === lang.id}
          >
            {lang.label}
          </button>
        </span>
      ))}
    </div>
  )
}
