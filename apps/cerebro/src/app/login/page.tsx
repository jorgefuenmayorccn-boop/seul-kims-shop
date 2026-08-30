'use client'
import { Suspense, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

function LoginForm() {
  const router  = useRouter()
  const params  = useSearchParams()
  const next    = params.get('next') ?? '/dashboard'
  const [error, setError]            = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        const res  = await fetch(`${API_URL}/auth/login`, {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) { setError(data.error ?? 'Error al iniciar sesión'); return }
        router.push(next)
        router.refresh()
      } catch {
        setError('No se pudo conectar con el servidor')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold font-body mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Correo electrónico
        </label>
        <input name="email" type="email" required autoComplete="email"
          className="w-full px-3 py-2.5 rounded text-sm font-body focus:outline-none"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
      </div>

      <div>
        <label className="block text-xs font-semibold font-body mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Contraseña
        </label>
        <input name="password" type="password" required autoComplete="current-password"
          className="w-full px-3 py-2.5 rounded text-sm font-body focus:outline-none"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
      </div>

      {error && (
        <p className="text-xs font-body rounded px-3 py-2" style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={isPending}
        className="w-full py-2.5 rounded font-headline font-bold text-sm transition-opacity disabled:opacity-50"
        style={{ background: 'var(--color-brand)', color: '#fff' }}>
        {isPending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
      <div className="w-full max-w-sm rounded-xl border p-8 shadow-sm"
        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}>

        <div className="mb-8 text-center">
          <p className="font-korean font-black text-3xl" style={{ color: 'var(--color-brand)' }}>서울킴스</p>
          <p className="font-headline font-bold text-lg mt-1" style={{ color: 'var(--color-text)' }}>SEUL KING OS V1.0</p>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Panel Administrativo</p>
        </div>

        <Suspense fallback={<div className="h-40 animate-pulse bg-surface rounded" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-[10px] font-mono mt-6" style={{ color: 'var(--color-text-disabled)' }}>
          SEUL KING OS v1.0 · Acceso restringido
        </p>
      </div>
    </div>
  )
}
