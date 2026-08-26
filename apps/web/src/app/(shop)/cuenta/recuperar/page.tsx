'use client'
import { useState, useTransition } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export default function RecuperarPage() {
  const [email, setEmail]            = useState('')
  const [sent, setSent]              = useState(false)
  const [error, setError]            = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        const res  = await fetch(`${API_URL}/api/customer/password-forgot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) { setError(data.error ?? 'No se pudo enviar el correo.'); return }
        setSent(true)
      } catch {
        setError('No se pudo conectar. Intenta de nuevo.')
      }
    })
  }

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
          <p className="font-headline font-bold text-lg mt-5" style={{ color: 'var(--color-heuk)' }}>Recuperar contraseña</p>
          <p className="font-korean text-sm mt-0.5" style={{ color: 'var(--color-celadon)' }}>비밀번호 찾기</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="font-body text-sm" style={{ color: 'var(--color-heuk)', opacity: 0.7 }}>
              Si existe una cuenta con ese correo, recibirás un enlace de recuperación en los próximos minutos.
            </p>
            <a href="/cuenta/login"
              className="block font-body text-xs font-semibold tracking-widest mt-4 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--color-seoul-red)', letterSpacing: '0.12em' }}>
              VOLVER AL INICIO DE SESIÓN
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-body text-xs font-semibold mb-1.5"
                style={{ color: 'var(--color-heuk)', opacity: 0.6, letterSpacing: '0.08em' }}>
                CORREO ELECTRÓNICO
              </label>
              <input
                type="email" required autoComplete="email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 font-body text-sm focus:outline-none"
                style={{ background: 'var(--color-baek-pure)', border: '1px solid rgba(10,10,10,0.30)', color: 'var(--color-heuk)' }}
              />
            </div>

            {error && (
              <p className="font-body text-xs px-3 py-2.5"
                style={{ background: 'rgba(215,38,61,0.06)', color: 'var(--color-seoul-red)', borderLeft: '3px solid var(--color-seoul-red)' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={isPending}
              className="w-full py-3.5 font-body font-bold text-sm tracking-widest text-white transition-opacity disabled:opacity-50 mt-2"
              style={{ background: 'var(--color-seoul-red)', letterSpacing: '0.14em' }}>
              {isPending ? 'ENVIANDO...' : 'ENVIAR ENLACE'}
            </button>

            <a href="/cuenta/login"
              className="block text-center font-body text-xs mt-3 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
              Volver al inicio de sesión
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
