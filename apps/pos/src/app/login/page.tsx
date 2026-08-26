'use client'
import { useState, useRef } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const emailRef    = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email:    emailRef.current?.value.trim(),
          password: passwordRef.current?.value,
        }),
      })

      const data = await res.json() as { ok?: boolean; error?: string }

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Credenciales inválidas')
        return
      }

      window.location.href = '/'
    } catch {
      setError('Error de conexión. Verifica que el sistema esté activo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: 'var(--color-background)' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-xl shadow-lg overflow-hidden"
        style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="px-8 py-8 text-center border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p className="font-korean font-black text-3xl mb-1" style={{ color: 'var(--color-brand)' }}>
            서울킴스
          </p>
          <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Sistema POS — Acceso cajera
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block font-body text-xs font-semibold mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              CORREO
            </label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="cajera@seoulkims.cl"
              className="w-full px-3 py-2.5 rounded text-sm font-body outline-none focus:ring-2 focus:ring-brand"
              style={{
                background:  '#ffffff',
                border:      '2px solid #d1d5db',
                color:       '#111827',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-body text-xs font-semibold mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              CONTRASEÑA
            </label>
            <input
              ref={passwordRef}
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2.5 rounded text-sm font-body outline-none focus:ring-2 focus:ring-brand"
              style={{
                background:  '#ffffff',
                border:      '2px solid #d1d5db',
                color:       '#111827',
              }}
            />
          </div>

          {error && (
            <div
              className="px-3 py-2.5 rounded text-sm font-body"
              style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded font-headline font-bold text-base transition-all active:scale-[0.98]"
            style={{
              background: loading ? 'var(--color-border)' : 'var(--heuk-950, #0a0a0a)',
              color:      loading ? 'var(--color-text-disabled)' : '#f5f5f2',
              cursor:     loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div
          className="px-8 py-4 text-center border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p className="font-body text-xs" style={{ color: 'var(--color-text-muted)' }}>
            3 intentos fallidos bloquean la cuenta por 15 min
          </p>
        </div>
      </div>
    </div>
  )
}
