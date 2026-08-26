'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerStore } from '@/lib/customer-store'

export default function CuentaPage() {
  const { customer } = useCustomerStore()
  const router = useRouter()

  useEffect(() => {
    if (customer) {
      router.replace('/cuenta/dashboard')
    } else {
      router.replace('/cuenta/login')
    }
  }, [customer, router])

  return null
}
