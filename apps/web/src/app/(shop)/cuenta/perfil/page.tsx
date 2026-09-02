'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerStore, useCustomerHasHydrated } from '@/lib/customer-store'
import { ShopFooter } from '@seul/ui/shop/shop-footer'

export default function PerfilPage() {
  const { customer } = useCustomerStore()
  const hasHydrated = useCustomerHasHydrated()
  const router = useRouter()

  // Hallazgo S17 (auditoría visual final, mismo patrón que dashboard/pedidos):
  // esperar a que zustand/persist termine de hidratar desde localStorage antes
  // de decidir "no hay sesión".
  useEffect(() => {
    if (hasHydrated && !customer) router.replace('/cuenta/login')
  }, [hasHydrated, customer, router])

  if (!hasHydrated || !customer) return null

  return (
    <div style={{ background: 'var(--color-baek-pure)', minHeight: '100vh' }}>
      <section className="px-8 md:px-16 py-12 border-b" style={{ borderColor: 'var(--color-border-editorial)' }}>
        <a href="/cuenta"
          className="font-body text-xs tracking-widest hover:opacity-80 transition-opacity block mb-4"
          style={{ color: 'var(--color-heuk)', opacity: 0.4, letterSpacing: '0.12em' }}>
          ← MI CUENTA
        </a>
        <span className="font-korean text-xs font-medium block mb-2"
          style={{ color: 'var(--color-celadon)', letterSpacing: '0.2em' }}>
          프로필
        </span>
        <h1 className="font-headline font-bold" style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', color: 'var(--color-heuk)' }}>
          Mi perfil
        </h1>
      </section>

      <div className="px-8 md:px-16 py-10 max-w-lg">
        <dl className="divide-y" style={{ borderColor: 'var(--color-border-editorial)' }}>
          {[
            { label: 'Nombre',               value: customer.name },
            { label: 'Correo electrónico',   value: customer.email },
            { label: 'Verificación de email', value: customer.emailVerified ? 'Verificado' : 'Pendiente de verificación' },
          ].map(row => (
            <div key={row.label} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <dt className="font-body text-xs font-semibold" style={{ color: 'var(--color-heuk)', opacity: 0.5, letterSpacing: '0.06em' }}>
                {row.label.toUpperCase()}
              </dt>
              <dd className="font-body text-sm" style={{ color: 'var(--color-heuk)' }}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border-editorial)' }}>
          <a href="/cuenta/cambiar-clave"
            className="inline-block font-body text-xs font-semibold tracking-widest py-3 px-6 border hover:bg-black/[0.02] transition-colors"
            style={{ borderColor: 'var(--color-border-editorial)', color: 'var(--color-heuk)', letterSpacing: '0.12em' }}>
            CAMBIAR CONTRASEÑA
          </a>
        </div>
      </div>

      <ShopFooter />
    </div>
  )
}
