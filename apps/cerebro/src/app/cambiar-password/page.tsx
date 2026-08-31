'use client'
import { Suspense, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from '@seul/icons'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

function ChangePasswordForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [validations, setValidations] = useState({
    length: false,
    uppercase: false,
    number: false,
  })
  const [isPending, startTransition] = useTransition()

  function validatePassword(password: string) {
    setValidations({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const fd = new FormData(e.currentTarget)
    const oldPassword = fd.get('oldPassword') as string
    const newPassword = fd.get('newPassword') as string
    const confirmPassword = fd.get('confirmPassword') as string

    if (!validations.length || !validations.uppercase || !validations.number) {
      setError('La contraseña no cumple con los requisitos de seguridad')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            oldPassword,
            newPassword,
            confirmPassword,
          }),
        })

        const data = await res.json() as { ok?: boolean; error?: string; message?: string }

        if (!res.ok || !data.ok) {
          setError(data.error ?? 'Error al cambiar contraseña')
          return
        }

        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 2000)
      } catch (err) {
        console.error('Change password error:', err)
        setError('No se pudo conectar con el servidor')
      }
    })
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div style={{ color: 'var(--color-brand)' }}>
          <CheckCircle size={48} className="mx-auto mb-4" />
        </div>
        <h2 style={{ color: 'var(--color-text)' }} className="font-headline font-bold text-lg">
          ✅ Contraseña Cambiada con Éxito
        </h2>
        <p style={{ color: 'var(--color-text-muted)' }} className="text-sm">
          Recibirás un email de confirmación. Redirigiendo al panel...
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-4 rounded" style={{ background: 'var(--color-error-subtle)', borderLeft: '3px solid var(--color-error)' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
          ⚠️ Primer acceso: Debes cambiar tu contraseña temporal
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>
          Por tu seguridad, define una contraseña personalizada fuerte.
        </p>
      </div>

      {/* Contraseña anterior */}
      <div>
        <label className="block text-xs font-semibold font-body mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Contraseña actual
        </label>
        <div className="relative">
          <input
            name="oldPassword"
            type={showOld ? 'text' : 'password'}
            required
            placeholder="Tu contraseña temporal"
            className="w-full px-3 py-2.5 pr-10 rounded text-sm font-body focus:outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <button
            type="button"
            onClick={() => setShowOld(!showOld)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Nueva contraseña */}
      <div>
        <label className="block text-xs font-semibold font-body mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Nueva contraseña
        </label>
        <div className="relative">
          <input
            name="newPassword"
            type={showNew ? 'text' : 'password'}
            required
            placeholder="Crear contraseña fuerte"
            onChange={(e) => validatePassword(e.target.value)}
            className="w-full px-3 py-2.5 pr-10 rounded text-sm font-body focus:outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Validación de requisitos */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs" style={{ color: validations.length ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '2px', background: validations.length ? 'var(--color-brand)' : 'var(--color-border)' }} />
            Mínimo 8 caracteres
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: validations.uppercase ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '2px', background: validations.uppercase ? 'var(--color-brand)' : 'var(--color-border)' }} />
            Una letra mayúscula
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: validations.number ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '2px', background: validations.number ? 'var(--color-brand)' : 'var(--color-border)' }} />
            Un número
          </div>
        </div>
      </div>

      {/* Confirmar contraseña */}
      <div>
        <label className="block text-xs font-semibold font-body mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Confirmar contraseña
        </label>
        <div className="relative">
          <input
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            required
            placeholder="Confirmar contraseña"
            className="w-full px-3 py-2.5 pr-10 rounded text-sm font-body focus:outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs font-body rounded px-3 py-2 flex items-center gap-2" style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}>
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !validations.length || !validations.uppercase || !validations.number}
        className="w-full py-2.5 rounded font-headline font-bold text-sm transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'var(--color-brand)', color: '#fff' }}
      >
        <Lock size={16} />
        {isPending ? 'Cambiando…' : 'Cambiar Contraseña'}
      </button>
    </form>
  )
}

export default function CambiarPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
      <div className="w-full max-w-sm rounded-xl border p-8 shadow-sm"
        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border)' }}>

        <div className="mb-8 text-center">
          <p className="font-korean font-black text-3xl" style={{ color: 'var(--color-brand)' }}>서울킴스</p>
          <p className="font-headline font-bold text-lg mt-1" style={{ color: 'var(--color-text)' }}>Cambiar Contraseña</p>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Primer acceso requerido</p>
        </div>

        <Suspense fallback={<div className="h-40 animate-pulse bg-surface rounded" />}>
          <ChangePasswordForm />
        </Suspense>

        <p className="text-center text-[10px] font-mono mt-6" style={{ color: 'var(--color-text-disabled)' }}>
          SEUL KING OS v1.0 · Seguridad de acceso
        </p>
      </div>
    </div>
  )
}
