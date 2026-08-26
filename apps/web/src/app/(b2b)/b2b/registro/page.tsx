'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, User, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

// RUT validation (display only — API double-checks)
function formatRUTInput(raw: string): string {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const dv  = clean.slice(-1)
  const num = clean.slice(0, -1)
  const grouped = num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${grouped}-${dv}`
}

type Step = 'empresa' | 'contacto' | 'enviado'

export default function RegistroB2BPage() {
  const [step, setStep]       = useState<Step>('empresa')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [waNumber, setWaNumber] = useState('56936451991')

  useEffect(() => {
    fetch(`${API}/api/tienda-config/public`)
      .then(r => r.json())
      .then((d: { config?: { whatsapp_number?: string } }) => {
        if (d.config?.whatsapp_number) setWaNumber(d.config.whatsapp_number)
      })
      .catch(() => {})
  }, [])

  const [form, setForm] = useState({
    razonSocial: '',
    rut:         '',
    giro:        '',
    address:     '',
    name:        '',
    email:       '',
    phone:       '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = field === 'rut' ? formatRUTInput(e.target.value) : e.target.value
      setForm(prev => ({ ...prev, [field]: val }))
      setError(null)
    }
  }

  async function submit() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API}/api/b2b/registro`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json() as { ok?: boolean; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Error al enviar solicitud')
        return
      }
      setStep('enviado')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'enviado') {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <CheckCircle2 className="mx-auto size-16 text-[var(--color-baes-eligible)]" />
        <h1 className="mt-4 text-2xl font-bold">¡Solicitud enviada!</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Revisaremos tu solicitud y te contactaremos por WhatsApp en 24–48 horas hábiles.
        </p>
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 font-semibold text-white hover:opacity-90"
        >
          Escribirnos mientras tanto
        </a>
      </div>
    )
  }

  const inputClass =
    'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]'

  const labelClass = 'block text-sm font-medium mb-1.5'

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Cuenta mayorista</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Accede a precios netos y gestiona tus pedidos desde un solo portal.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8 flex gap-3">
        {(['empresa', 'contacto'] as const).map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className={[
              'flex size-7 items-center justify-center rounded-full text-xs font-bold',
              step === s || (s === 'empresa' && step === 'contacto')
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]',
            ].join(' ')}>
              {s === 'empresa' && step === 'contacto' ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className="text-sm font-medium capitalize">{s === 'empresa' ? 'Tu empresa' : 'Contacto'}</span>
            {i === 0 && <div className="flex-1 border-t border-dashed border-[var(--color-border)]" />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--color-dte-failed)]/10 p-3 text-sm text-[var(--color-dte-failed)]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {step === 'empresa' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--color-brand)] mb-4">
              <Building2 className="size-5" />
              <span className="font-semibold">Datos de la empresa</span>
            </div>

            <div>
              <label className={labelClass}>Razón social *</label>
              <input className={inputClass} value={form.razonSocial} onChange={set('razonSocial')} placeholder="Distribuidora Ejemplo SpA" />
            </div>
            <div>
              <label className={labelClass}>RUT empresa *</label>
              <input className={inputClass} value={form.rut} onChange={set('rut')} placeholder="76.543.210-K" maxLength={12} />
            </div>
            <div>
              <label className={labelClass}>Giro comercial *</label>
              <input className={inputClass} value={form.giro} onChange={set('giro')} placeholder="Comercio al por mayor de alimentos" />
            </div>
            <div>
              <label className={labelClass}>Dirección comercial *</label>
              <input className={inputClass} value={form.address} onChange={set('address')} placeholder="Av. Valparaíso 123, Viña del Mar" />
            </div>

            <button
              onClick={() => {
                if (!form.razonSocial || !form.rut || !form.giro || !form.address) {
                  setError('Completa todos los campos obligatorios')
                  return
                }
                setError(null)
                setStep('contacto')
              }}
              className="mt-2 w-full rounded-lg bg-[var(--color-brand)] py-2.5 font-semibold text-white hover:opacity-90"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 'contacto' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--color-brand)] mb-4">
              <User className="size-5" />
              <span className="font-semibold">Datos de contacto</span>
            </div>

            <div>
              <label className={labelClass}>Nombre completo *</label>
              <input className={inputClass} value={form.name} onChange={set('name')} placeholder="María González" />
            </div>
            <div>
              <label className={labelClass}>Email corporativo *</label>
              <input className={inputClass} type="email" value={form.email} onChange={set('email')} placeholder="contacto@empresa.cl" />
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input className={inputClass} type="tel" value={form.phone} onChange={set('phone')} placeholder="+56 9 1234 5678" />
            </div>

            <div className="rounded-lg bg-[var(--color-surface-sunken)] p-3 text-xs text-[var(--color-text-secondary)]">
              Al enviar tu solicitud, SEUL SHOP revisará tu información y te contactará vía WhatsApp para activar tu cuenta.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('empresa')}
                className="flex-1 rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium hover:bg-[var(--color-surface-raised)]"
              >
                Volver
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
        ¿Ya tienes cuenta? Consulta tu estado en{' '}
        <a href="/b2b/dashboard" className="underline hover:text-[var(--color-brand)]">Mi Cuenta</a>
      </p>
    </div>
  )
}
