'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerStore, useCustomerHasHydrated } from '@/lib/customer-store'

export default function CuentaPage() {
  const { customer } = useCustomerStore()
  const hasHydrated = useCustomerHasHydrated()
  const router = useRouter()

  // Hallazgo S17 (auditoría visual final): mismo guard de hidratación que
  // dashboard/pedidos/perfil — sin esto, /cuenta mandaba a un cliente ya
  // logueado a /cuenta/login en cada carga fresca de página.
  useEffect(() => {
    if (!hasHydrated) return
    if (customer) {
      router.replace('/cuenta/dashboard')
    } else {
      router.replace('/cuenta/login')
    }
  }, [hasHydrated, customer, router])

  return null
}
