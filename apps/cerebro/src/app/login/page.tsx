'use client'
import { Suspense, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from '@seul/icons'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/dashboard'
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
        })
        const data = await res.json() as { ok?: boolean; error?: string; mustChangePassword?: boolean }

        if (!res.ok || !data.ok) {
          setError(data.error ?? 'Error al iniciar sesión')
          return
        }

        // Si debe cambiar contraseña, redirigir a /cambiar-password
        if (data.mustChangePassword) {
          router.push('/cambiar-password')
          router.refresh()
          return
        }

        // Login exitoso, ir a dashboard
        router.push(next)
        router.refresh()
      } catch (err) {
        console.error('Login error:', err)
        setError('No se pudo conectar con el servidor')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold font-body mb-1.5 text-text-muted">
          Correo electrónico
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className="w-full px-3 py-2.5 rounded text-sm font-body bg-surface border border-[var(--color-border)] text-text focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold font-body mb-1.5 text-text-muted">
          Contraseña
        </label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-3 py-2.5 pr-10 rounded text-sm font-body bg-surface border border-[var(--color-border)] text-text focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-text-muted focus:outline-none"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs font-body rounded px-3 py-2 bg-error-subtle text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 rounded font-headline font-bold text-sm text-text-on-brand bg-brand transition-opacity disabled:opacity-50"
      >
        {isPending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border p-8 shadow-sm bg-elevated border-[var(--color-border)]">

        <div className="mb-8 text-center">
          <p className="font-korean font-black text-3xl text-brand">서울킴스</p>
          <p className="font-headline font-bold text-lg mt-1 text-text">SEUL KING OS V1.0</p>
          <p className="text-xs font-mono mt-0.5 text-text-muted">Panel Administrativo</p>
        </div>

        <Suspense fallback={<div className="h-40 animate-pulse bg-surface rounded" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-[10px] font-mono mt-6 text-text-disabled">
          SEUL KING OS v1.0 · Acceso restringido
        </p>
      </div>
    </div>
  )
}
