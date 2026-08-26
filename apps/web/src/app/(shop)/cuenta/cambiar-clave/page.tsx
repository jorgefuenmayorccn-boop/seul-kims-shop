'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export default function CambiarClavePage() {
  const router = useRouter()
  const [error, setError]              = useState('')
  const [showCurrent, setShowCurrent]  = useState(false)
  const [showNew, setShowNew]          = useState(false)
  const [isPending, startTransition]   = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    const currentPassword = fd.get('currentPassword') as string
    const newPassword     = fd.get('newPassword') as string
    const confirm         = fd.get('confirm') as string

    if (newPassword !== confirm) { setError('Las contraseñas nuevas no coinciden.'); return }
    if (newPassword.length < 8)  { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return }

    startTransition(async () => {
      try {
        const res  = await fetch(`${API_URL}/api/customer/password-change`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) { setError(data.error ?? 'No se pudo cambiar la contraseña.'); return }
        router.push('/cuenta')
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
          </a>
          <p className="font-headline font-bold text-lg mt-5" style={{ color: 'var(--color-heuk)' }}>Cambiar contraseña</p>
          <p className="font-korean text-sm mt-0.5" style={{ color: 'var(--color-celadon)' }}>비밀번호 변경</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: 'currentPassword', label: 'CONTRASEÑA ACTUAL', show: showCurrent, toggle: () => setShowCurrent(p => !p) },
            { name: 'newPassword',     label: 'NUEVA CONTRASEÑA',  show: showNew,     toggle: () => setShowNew(p => !p) },
            { name: 'confirm',         label: 'CONFIRMAR NUEVA',   show: showNew,     toggle: () => setShowNew(p => !p) },
          ].map(field => (
            <div key={field.name}>
              <label className="block font-body text-xs font-semibold mb-1.5"
                style={{ color: 'var(--color-heuk)', opacity: 0.6, letterSpacing: '0.08em' }}>
                {field.label}
              </label>
              <div className="relative">
                <input
                  name={field.name} type={field.show ? 'text' : 'password'} required
                  className="w-full px-4 py-3 pr-11 font-body text-sm focus:outline-none"
                  style={{ background: 'var(--color-baek-pure)', border: '1px solid rgba(10,10,10,0.30)', color: 'var(--color-heuk)' }}
                />
                <button type="button" onClick={field.toggle}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-[10px] tracking-widest"
                  style={{ color: 'var(--color-heuk)', opacity: 0.4 }}>
                  {field.show ? 'OCULTAR' : 'VER'}
                </button>
              </div>
            </div>
          ))}

          {error && (
            <p className="font-body text-xs px-3 py-2.5"
              style={{ background: 'rgba(215,38,61,0.06)', color: 'var(--color-seoul-red)', borderLeft: '3px solid var(--color-seoul-red)' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={isPending}
            className="w-full py-3.5 font-body font-bold text-sm tracking-widest text-white transition-opacity disabled:opacity-50 mt-2"
            style={{ background: 'var(--color-seoul-red)', letterSpacing: '0.14em' }}>
            {isPending ? 'GUARDANDO...' : 'CAMBIAR CONTRASEÑA'}
          </button>

          <a href="/cuenta"
            className="block text-center font-body text-xs mt-2 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
            Cancelar
          </a>
        </form>
      </div>
    </div>
  )
}
