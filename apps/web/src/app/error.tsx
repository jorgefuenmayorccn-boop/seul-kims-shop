'use client'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui', textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#D7263D', fontSize: 12, letterSpacing: '0.2em', marginBottom: 8 }}>오류</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Algo salió mal</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>Nuestro equipo fue notificado.</p>
        <button onClick={reset} style={{ padding: '10px 24px', background: '#D7263D', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          Intentar de nuevo
        </button>
      </body>
    </html>
  )
}
