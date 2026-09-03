'use client'
import { useEffect } from 'react'

export default function B2BError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <section style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', textAlign: 'center' }}>
      <p style={{ color: '#D7263D', fontSize: 11, letterSpacing: '0.2em', marginBottom: 8 }}>오류 — ERROR PORTAL B2B</p>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Error en el portal mayorista</h1>
      <p style={{ color: '#666', marginBottom: 24, maxWidth: 360 }}>Contacta a tu ejecutivo de cuenta o escríbenos a contacto@seoulshop.cl.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={reset} style={{ padding: '10px 24px', background: '#D7263D', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>
          REINTENTAR
        </button>
        <a href="mailto:contacto@seoulshop.cl" style={{ padding: '10px 24px', border: '1px solid #ccc', color: '#333', fontSize: 12, textDecoration: 'none' }}>
          SOPORTE
        </a>
      </div>
    </section>
  )
}
