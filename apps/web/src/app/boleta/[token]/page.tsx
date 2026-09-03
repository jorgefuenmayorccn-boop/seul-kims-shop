import type { Metadata } from 'next'
import { FileText, ExternalLink, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Boleta electrónica — SEUL SHOP',
  robots: { index: false },   // no indexar URLs de boletas
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export default function BoletaPage({ params }: { params: { token: string } }) {
  const pdfUrl = `${API}/boleta/${params.token}`

  return (
    <div className="min-h-screen bg-[var(--color-surface-sunken)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--color-brand)]/10">
          <FileText className="size-7 text-[var(--color-brand)]" />
        </div>

        <h1 className="text-lg font-bold">Tu boleta electrónica</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Documento tributario emitido por SEUL SHOP CL
        </p>

        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-5 py-3 font-semibold text-white hover:opacity-90"
        >
          <FileText className="size-4" />
          Ver / Descargar PDF
          <ExternalLink className="size-4" />
        </a>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <Clock className="size-3.5" />
          Este enlace vence en 48 horas
        </div>

        <div className="mt-6 border-t border-[var(--color-border)] pt-4">
          <p className="text-xs text-[var(--color-text-secondary)]">
            ¿Problemas con tu boleta?{' '}
            <a
              href="mailto:contacto@seoulshop.cl"
              className="underline hover:text-[var(--color-brand)]"
            >
              Escríbenos por correo
            </a>
          </p>
        </div>

        <p className="text-[10px] text-center mt-6 opacity-40 text-[var(--color-text-secondary)]">
          Seoul King OS V2.0 · Creado por VÉRTICE Productions · verticeproductions.com
        </p>
      </div>
    </div>
  )
}
