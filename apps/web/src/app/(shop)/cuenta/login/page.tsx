'use client'
import { Suspense, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCustomerStore } from '@/lib/customer-store'
import type { CustomerSession } from '@/lib/customer-store'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

function LoginForm() {
  const router      = useRouter()
  const params      = useSearchParams()
  const setCustomer = useCustomerStore(s => s.setCustomer)
  const next        = params.get('next') ?? '/cuenta'
  const didReset    = params.get('reset') === '1'
  const [error, setError]            = useState('')
  const [showPass, setShowPass]      = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const res  = await fetch(`${API_URL}/api/customer/login`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
        })
        const data = await res.json() as {
          ok?: boolean; error?: string; mustChangePassword?: boolean
          customer?: CustomerSession
        }
        if (!res.ok || !data.ok) { setError(data.error ?? 'Correo o contraseña incorrectos'); return }
        if (data.customer) setCustomer(data.customer)
        router.push(data.mustChangePassword ? '/cuenta/cambiar-clave' : next)
        router.refresh()
      } catch {
        setError('No se pudo conectar. Intenta de nuevo.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-body text-xs font-semibold mb-1.5 tracking-wide"
          style={{ color: 'var(--color-heuk)', opacity: 0.6, letterSpacing: '0.08em' }}>
          CORREO ELECTRÓNICO
        </label>
        <input name="email" type="email" required autoComplete="email"
          className="w-full px-4 py-3 font-body text-sm focus:outline-none transition-colors"
          style={{ background: 'var(--color-baek-pure)', border: '1px solid rgba(10,10,10,0.30)', color: 'var(--color-heuk)' }} />
      </div>

      <div>
        <label className="block font-body text-xs font-semibold mb-1.5 tracking-wide"
          style={{ color: 'var(--color-heuk)', opacity: 0.6, letterSpacing: '0.08em' }}>
          CONTRASEÑA
        </label>
        <div className="relative">
          <input name="password" type={showPass ? 'text' : 'password'} required autoComplete="current-password"
            className="w-full px-4 py-3 pr-11 font-body text-sm focus:outline-none"
            style={{ background: 'var(--color-baek-pure)', border: '1px solid rgba(10,10,10,0.30)', color: 'var(--color-heuk)' }} />
          <button type="button" onClick={() => setShowPass(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-[10px] tracking-widest"
            style={{ color: 'var(--color-heuk)', opacity: 0.4 }}>
            {showPass ? 'OCULTAR' : 'VER'}
          </button>
        </div>
        <a href="/cuenta/recuperar"
          className="block font-body text-[11px] mt-1.5 hover:opacity-100 transition-opacity text-right"
          style={{ color: 'var(--color-seoul-red)', opacity: 0.75 }}>
          Olvidé mi contraseña
        </a>
      </div>

      {didReset && !error && (
        <p className="font-body text-xs px-3 py-2.5"
          style={{ background: 'rgba(0,200,83,0.08)', color: '#1b5e20', borderLeft: '3px solid #00c853' }}>
          Contraseña actualizada. Inicia sesión con tu nueva contraseña.
        </p>
      )}

      {error && (
        <p className="font-body text-xs px-3 py-2.5"
          style={{ background: 'rgba(215,38,61,0.06)', color: 'var(--color-seoul-red)', borderLeft: '3px solid var(--color-seoul-red)' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={isPending}
        className="w-full py-3.5 font-body font-bold text-sm tracking-widest text-white transition-opacity disabled:opacity-50 mt-2"
        style={{ background: 'var(--color-seoul-red)', letterSpacing: '0.14em' }}>
        {isPending ? 'INGRESANDO...' : 'INGRESAR'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ background: 'var(--color-baek-pure)' }}>
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <a href="/">
            <p className="font-korean font-black text-3xl" style={{ color: 'var(--color-seoul-red)' }}>서울킴스</p>
            <p className="font-body font-semibold text-xs tracking-widest mt-0.5"
              style={{ color: 'var(--color-heuk)', opacity: 0.45, letterSpacing: '0.18em' }}>SEOUL KIMS</p>
          </a>
          <p className="font-headline font-bold text-lg mt-5" style={{ color: 'var(--color-heuk)' }}>Mi Cuenta</p>
          <p className="font-korean text-sm mt-0.5" style={{ color: 'var(--color-celadon)' }}>계정</p>
        </div>

        <Suspense fallback={<div className="h-48 rounded" style={{ background: 'var(--color-heuk)', opacity: 0.04 }} />}>
          <LoginForm />
        </Suspense>

        <div className="mt-6 text-center border-t pt-6" style={{ borderColor: 'var(--color-border-editorial)' }}>
          <p className="font-body text-sm" style={{ color: 'var(--color-heuk)', opacity: 0.55 }}>
            ¿No tienes cuenta?{' '}
            <a href="/cuenta/registro" className="font-semibold hover:opacity-100 transition-opacity"
              style={{ color: 'var(--color-seoul-red)' }}>
              Inscríbete
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
