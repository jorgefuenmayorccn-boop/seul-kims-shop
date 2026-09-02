'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCustomerStore } from '@/lib/customer-store'
import { useLocaleStore } from '@/lib/locale-store'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { User, LogOut, ChevronDown } from '@seul/icons'

export function AuthSlot() {
  const { customer, logout } = useCustomerStore()
  const locale = useLocaleStore(s => s.locale)
  const t = getDictionary(locale).nav
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <div className="w-24 h-8" />

  if (!customer) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/cuenta/login"
          className="font-body text-[10px] font-semibold tracking-widest transition-opacity hover:opacity-100"
          style={{ color: 'var(--color-heuk)', opacity: 0.55, letterSpacing: '0.14em' }}
        >
          {t.login}
        </Link>
        <Link
          href="/cuenta/registro"
          className="font-body text-[10px] font-semibold tracking-widest px-3 py-1.5 transition-colors"
          style={{
            background: 'var(--color-seoul-red)',
            color: '#fff',
            letterSpacing: '0.12em',
          }}
        >
          {t.register}
        </Link>
      </div>
    )
  }

  const firstName = customer.name.split(' ')[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 group"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <User
          size={14}
          color="var(--color-heuk)"
          className="opacity-60 group-hover:opacity-90 transition-opacity"
        />
        <span
          className="font-body text-[10px] font-semibold tracking-widest transition-opacity group-hover:opacity-90"
          style={{ color: 'var(--color-heuk)', opacity: 0.7, letterSpacing: '0.12em' }}
        >
          {firstName.toUpperCase()}
        </span>
        <ChevronDown
          size={10}
          color="var(--color-heuk)"
          className={`opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 z-50 min-w-[160px] py-1 shadow-lg"
            style={{
              background: 'var(--color-baek-pure, #f5f5f2)',
              border: 'var(--border-editorial)',
            }}
          >
            <Link
              href="/cuenta"
              className="flex items-center gap-2 px-4 py-2.5 font-body text-[11px] tracking-wide hover:bg-black/5 transition-colors"
              style={{ color: 'var(--color-heuk)', letterSpacing: '0.1em' }}
              onClick={() => setOpen(false)}
            >
              <User size={12} color="var(--color-heuk)" className="opacity-50" />
              {t.account}
            </Link>
            <div className="border-t my-1" style={{ borderColor: 'var(--color-border-editorial)' }} />
            <button
              onClick={async () => {
                setOpen(false)
                await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'}/api/customer/logout`, {
                  method: 'POST',
                  credentials: 'include',
                })
                logout()
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 font-body text-[11px] tracking-wide hover:bg-black/5 transition-colors text-left"
              style={{ color: 'var(--color-heuk)', letterSpacing: '0.1em', opacity: 0.6 }}
            >
              <LogOut size={12} color="var(--color-heuk)" className="opacity-50" />
              {t.logout}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
