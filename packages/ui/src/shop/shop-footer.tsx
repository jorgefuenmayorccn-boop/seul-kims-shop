'use client'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { Instagram, Mail } from '@seul/icons'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

function NewsletterWidget() {
  const [email, setEmail]   = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [msg, setMsg]       = useState('')

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const r = await fetch(`${API_URL}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'footer' }),
      })
      const data = await r.json() as { ok: boolean; message?: string; error?: string }
      if (data.ok) {
        setStatus('ok')
        setMsg(data.message ?? 'Revisa tu correo para confirmar.')
        setEmail('')
      } else {
        setStatus('err')
        setMsg(data.error ?? 'Error al suscribirse.')
      }
    } catch {
      setStatus('err')
      setMsg('Error de conexión. Intenta nuevamente.')
    }
  }

  return (
    <div className="w-full max-w-sm">
      <p
        className="font-body text-[10px] font-semibold tracking-widest mb-3"
        style={{ color: 'var(--color-heuk)', opacity: 0.55, letterSpacing: '0.18em' }}
      >
        뉴스레터 — NEWSLETTER
      </p>
      {status === 'ok' ? (
        <p className="font-body text-sm" style={{ color: 'var(--color-celadon)' }}>
          {msg}
        </p>
      ) : (
        <form onSubmit={subscribe} className="flex gap-0">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@correo.cl"
            required
            className="flex-1 px-4 py-2.5 font-body text-sm bg-transparent border focus:outline-none"
            style={{
              borderColor: 'var(--border-editorial)',
              color: 'var(--color-heuk)',
            }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-5 py-2.5 font-body text-[10px] font-semibold tracking-widest transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--color-seoul-red)',
              color: '#fff',
              letterSpacing: '0.14em',
            }}
          >
            {status === 'loading' ? '…' : 'OK'}
          </button>
        </form>
      )}
      {status === 'err' && (
        <p className="font-body text-xs mt-2" style={{ color: 'var(--color-seoul-red)' }}>
          {msg}
        </p>
      )}
    </div>
  )
}

export function ShopFooter() {
  return (
    <footer
      className="w-full border-t overflow-hidden"
      style={{ borderColor: 'var(--border-editorial)', background: 'var(--color-baek-pure, var(--baek-50))' }}
    >
      {/* 감사합니다 */}
      <div className="relative px-8 py-16 flex flex-col items-center justify-center text-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="select-none pointer-events-none"
        >
          <span
            className="font-korean font-black block leading-none"
            style={{
              fontSize: 'var(--hangul-xl)',
              color: 'var(--color-celadon)',
              letterSpacing: '-0.02em',
            }}
          >
            감사합니다
          </span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.5 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="font-body text-xs tracking-widest mt-2"
          style={{ color: 'var(--color-heuk)', letterSpacing: '0.2em' }}
        >
          GRACIAS POR TU VISITA
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="font-korean font-bold mt-4 text-xl"
          style={{ color: 'var(--color-seoul-red)' }}
        >
          또 오세요
        </motion.p>
        <p
          className="font-body text-xs mt-1"
          style={{ color: 'var(--color-heuk)', opacity: 0.45, letterSpacing: '0.12em' }}
        >
          VUELVE PRONTO
        </p>
      </div>

      {/* Newsletter + Redes */}
      <div
        className="border-t px-8 md:px-16 py-10 grid md:grid-cols-2 gap-10 items-start"
        style={{ borderColor: 'var(--border-editorial)' }}
      >
        <NewsletterWidget />

        {/* Redes sociales */}
        <div className="flex flex-col gap-4">
          <p
            className="font-body text-[10px] font-semibold tracking-widest"
            style={{ color: 'var(--color-heuk)', opacity: 0.55, letterSpacing: '0.18em' }}
          >
            소셜 미디어 — SÍGUENOS
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://instagram.com/seulshopcl"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 group"
              aria-label="Instagram @seulshopcl"
            >
              <Instagram
                size={18}
                color="var(--color-heuk)"
                className="opacity-50 group-hover:opacity-90 transition-opacity"
              />
              <span
                className="font-body text-[10px] tracking-wide hidden sm:block group-hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-heuk)', opacity: 0.45, letterSpacing: '0.08em' }}
              >
                @seulshopcl
              </span>
            </a>

            <a
              href="mailto:contacto@seoulshop.cl"
              className="flex items-center gap-2 group"
              aria-label="Email SEUL SHOP"
            >
              <Mail
                size={18}
                color="var(--color-heuk)"
                className="opacity-50 group-hover:opacity-90 transition-opacity"
              />
              <span
                className="font-body text-[10px] tracking-wide hidden sm:block group-hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-heuk)', opacity: 0.45, letterSpacing: '0.08em' }}
              >
                contacto@seoulshop.cl
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Línea divisora */}
      <div className="border-t" style={{ borderColor: 'var(--border-editorial)' }} />

      {/* Bottom bar */}
      <div className="px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="font-korean font-black text-lg"
            style={{ color: 'var(--color-seoul-red)' }}
          >
            서울킴스
          </span>
          <span
            className="font-body text-xs"
            style={{ color: 'var(--color-heuk)', opacity: 0.4 }}
          >
            SEUL SHOP CL · Viña del Mar, Chile
          </span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="/privacidad"
            className="font-body text-[11px] tracking-wide hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-heuk)', opacity: 0.45, letterSpacing: '0.1em' }}
          >
            PRIVACIDAD
          </a>
          <a
            href="/terminos"
            className="font-body text-[11px] tracking-wide hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-heuk)', opacity: 0.45, letterSpacing: '0.1em' }}
          >
            TÉRMINOS
          </a>
          <a
            href="/faq"
            className="font-body text-[11px] tracking-wide hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-heuk)', opacity: 0.45, letterSpacing: '0.1em' }}
          >
            FAQ
          </a>
          <span
            className="font-body text-[11px]"
            style={{ color: 'var(--color-heuk)', opacity: 0.35 }}
          >
            © 2025
          </span>
          <span
            className="font-body text-[11px]"
            style={{ color: 'var(--color-heuk)', opacity: 0.35 }}
          >
            · Creado por VÉRTICE Productions
          </span>
        </div>
      </div>
    </footer>
  )
}
