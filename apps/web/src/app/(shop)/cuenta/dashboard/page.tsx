'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerStore } from '@/lib/customer-store'
import { ShopFooter } from '@seul/ui/shop/shop-footer'
import Link from 'next/link'
import { Package, User, LogOut } from '@seul/icons'

export default function DashboardPage() {
  const { customer, logout } = useCustomerStore()
  const router = useRouter()

  useEffect(() => {
    if (!customer) router.replace('/cuenta/login')
  }, [customer, router])

  if (!customer) return null

  const firstName = customer.name.split(' ')[0]

  return (
    <div style={{ background: 'var(--color-baek-pure, var(--baek-50))' }}>
      {/* Header */}
      <section
        className="px-8 md:px-16 py-12 border-b"
        style={{ borderColor: 'var(--color-border-editorial)' }}
      >
        <span
          className="font-korean text-xs font-medium block mb-2"
          style={{ color: 'var(--color-celadon)', letterSpacing: '0.2em' }}
        >
          내 계정
        </span>
        <h1
          className="font-headline font-bold"
          style={{ fontSize: 'clamp(24px, 4vw, 40px)', color: 'var(--color-heuk)' }}
        >
          Hola, {firstName}
        </h1>
        <p className="font-body text-sm mt-1" style={{ color: 'var(--color-heuk)', opacity: 0.5 }}>
          {customer.email}
        </p>
      </section>

      {/* Grid accesos */}
      <div className="px-8 md:px-16 py-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        {[
          { href: '/cuenta/pedidos',   icon: Package, label: 'Mis pedidos',   ko: '주문 내역',   desc: 'Historial y estado de entregas' },
          { href: '/cuenta/perfil',    icon: User,    label: 'Mi perfil',     ko: '프로필',      desc: 'Datos personales y contraseña' },
          { href: '/devoluciones',     icon: Package, label: 'Devoluciones',  ko: '반품',        desc: 'Solicitar devolución o cambio' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-3 p-6 border transition-colors hover:bg-black/[0.02] group"
            style={{ borderColor: 'var(--color-border-editorial)' }}
          >
            <item.icon
              size={20}
              color="var(--color-celadon)"
              className="opacity-70 group-hover:opacity-100 transition-opacity"
            />
            <div>
              <p className="font-body font-semibold text-sm" style={{ color: 'var(--color-heuk)' }}>
                {item.label}
              </p>
              <p className="font-korean text-xs mt-0.5" style={{ color: 'var(--color-celadon)', opacity: 0.7 }}>
                {item.ko}
              </p>
              <p className="font-body text-xs mt-1" style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
                {item.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Logout */}
      <div className="px-8 md:px-16 pb-12">
        <button
          onClick={async () => {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'}/api/customer/logout`, {
              method: 'POST',
              credentials: 'include',
            })
            logout()
            router.replace('/')
          }}
          className="flex items-center gap-2 font-body text-xs tracking-wide"
          style={{ color: 'var(--color-heuk)', opacity: 0.4, letterSpacing: '0.1em' }}
        >
          <LogOut size={14} color="var(--color-heuk)" className="opacity-60" />
          CERRAR SESIÓN
        </button>
      </div>

      <ShopFooter />
    </div>
  )
}
