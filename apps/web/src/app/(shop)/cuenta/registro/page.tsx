'use client'
import { useState, useTransition } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export default function RegistroPage() {
  const [step, setStep]              = useState<'form' | 'success'>('form')
  const [error, setError]            = useState('')
  const [marketing, setMarketing]    = useState(false)
  const [terms, setTerms]            = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!terms) { setError('Debes aceptar los Términos y Condiciones para continuar.'); return }
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const res  = await fetch(`${API_URL}/api/customer/register`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fd.get('name'),
            email: fd.get('email'),
            marketingOptIn: marketing,
          }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) { setError(data.error ?? 'No se pudo crear la cuenta.'); return }
        setStep('success')
      } catch {
        setError('No se pudo conectar. Intenta de nuevo.')
      }
    })
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16"
        style={{ background: 'var(--color-baek-pure)' }}>
        <div className="w-full max-w-sm text-center">
          <p className="font-korean font-black text-4xl" style={{ color: 'var(--color-celadon)' }}>확인</p>
          <h1 className="font-headline font-bold text-xl mt-3" style={{ color: 'var(--color-heuk)' }}>
            Revisa tu correo
          </h1>
          <p className="font-body text-sm mt-3 leading-relaxed" style={{ color: 'var(--color-heuk)', opacity: 0.6 }}>
            Te enviamos un enlace de confirmación. Haz clic en el correo para activar tu cuenta y recibir tu contraseña de acceso.
          </p>
          <a href="/cuenta/login"
            className="inline-block mt-8 px-8 py-3 font-body font-bold text-sm tracking-widest text-white transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-seoul-red)', letterSpacing: '0.14em' }}>
            IR AL LOGIN
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ background: 'var(--color-baek-pure)' }}>
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <a href="/">
            <p className="font-korean font-black text-3xl" style={{ color: 'var(--color-seoul-red)' }}>서울킴스</p>
          </a>
          <p className="font-headline font-bold text-lg mt-5" style={{ color: 'var(--color-heuk)' }}>Crear cuenta</p>
          <p className="font-korean text-sm mt-0.5" style={{ color: 'var(--color-celadon)' }}>회원가입</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-body text-xs font-semibold mb-1.5"
              style={{ color: 'var(--color-heuk)', opacity: 0.6, letterSpacing: '0.08em' }}>
              NOMBRE COMPLETO
            </label>
            <input name="name" type="text" required autoComplete="name"
              className="w-full px-4 py-3 font-body text-sm focus:outline-none"
              style={{ background: 'var(--color-baek-pure)', border: '1px solid rgba(10,10,10,0.30)', color: 'var(--color-heuk)' }} />
          </div>

          <div>
            <label className="block font-body text-xs font-semibold mb-1.5"
              style={{ color: 'var(--color-heuk)', opacity: 0.6, letterSpacing: '0.08em' }}>
              CORREO ELECTRÓNICO
            </label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full px-4 py-3 font-body text-sm focus:outline-none"
              style={{ background: 'var(--color-baek-pure)', border: '1px solid rgba(10,10,10,0.30)', color: 'var(--color-heuk)' }} />
          </div>

          {/* Consentimientos explícitos Ley 21.719 */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input type="checkbox" required checked={terms} onChange={e => setTerms(e.target.checked)}
                  className="sr-only" />
                <div className="w-4 h-4 border flex items-center justify-center transition-colors"
                  style={{
                    borderColor: terms ? 'var(--color-seoul-red)' : 'var(--border-editorial)',
                    background: terms ? 'var(--color-seoul-red)' : 'transparent',
                  }}>
                  {terms && <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </div>
              </div>
              <span className="font-body text-xs leading-relaxed" style={{ color: 'var(--color-heuk)', opacity: 0.7 }}>
                Acepto los{' '}
                <a href="/terminos" target="_blank" className="underline" style={{ color: 'var(--color-seoul-red)' }}>
                  Términos y Condiciones
                </a>{' '}
                y la{' '}
                <a href="/privacidad" target="_blank" className="underline" style={{ color: 'var(--color-seoul-red)' }}>
                  Política de Privacidad
                </a>{' '}
                <span style={{ color: 'var(--color-seoul-red)' }}>*</span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5 flex-shrink-0">
                <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)}
                  className="sr-only" />
                <div className="w-4 h-4 border flex items-center justify-center transition-colors"
                  style={{
                    borderColor: marketing ? 'var(--color-celadon)' : 'var(--border-editorial)',
                    background: marketing ? 'var(--color-celadon)' : 'transparent',
                  }}>
                  {marketing && <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </div>
              </div>
              <span className="font-body text-xs leading-relaxed" style={{ color: 'var(--color-heuk)', opacity: 0.6 }}>
                Deseo recibir promociones y novedades de SEUL SHOP por correo electrónico (opcional)
              </span>
            </label>
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
            {isPending ? 'CREANDO CUENTA...' : 'CREAR CUENTA'}
          </button>
        </form>

        <div className="mt-6 text-center border-t pt-6" style={{ borderColor: 'var(--border-editorial)' }}>
          <p className="font-body text-sm" style={{ color: 'var(--color-heuk)', opacity: 0.55 }}>
            Ya tengo cuenta{' '}
            <a href="/cuenta/login" className="font-semibold hover:opacity-100 transition-opacity"
              style={{ color: 'var(--color-seoul-red)' }}>
              Iniciar sesión
            </a>
          </p>
        </div>

        <p className="font-body text-[10px] text-center mt-4"
          style={{ color: 'var(--color-heuk)', opacity: 0.35 }}>
          Datos tratados bajo Ley 21.719 · Chile
        </p>
      </div>
    </div>
  )
}
