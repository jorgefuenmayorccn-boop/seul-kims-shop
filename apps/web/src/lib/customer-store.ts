'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CustomerSession {
  id:              string
  email:           string
  name:            string
  emailVerified:   boolean
  mustChangePassword: boolean
  marketingOptIn:  boolean
}

interface CustomerState {
  customer: CustomerSession | null
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  setCustomer: (c: CustomerSession | null) => void
  logout: () => void
}

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set) => ({
      customer: null,
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      setCustomer: (customer) => set({ customer }),
      logout: () => set({ customer: null }),
    }),
    {
      name: 'seul-customer-v1',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

export const useCustomerHasHydrated = () => useCustomerStore(s => s.hasHydrated)
