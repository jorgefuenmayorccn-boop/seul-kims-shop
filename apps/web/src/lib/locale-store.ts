'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Locale = 'es' | 'ko' | 'en'

interface LocaleState {
  locale: Locale
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  setLocale: (l: Locale) => void
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'es',
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'seul-locale-v1',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

export const useLocaleHasHydrated = () => useLocaleStore(s => s.hasHydrated)
