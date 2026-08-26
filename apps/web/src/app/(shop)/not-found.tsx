import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--color-baek-pure)' }}
    >
      <div className="text-center max-w-md">
        <p
          className="font-korean font-black leading-none select-none"
          style={{ fontSize: 'clamp(5rem, 20vw, 10rem)', color: 'var(--color-seoul-red)', opacity: 0.08 }}
        >
          404
        </p>

        <p
          className="font-korean font-bold text-2xl -mt-6"
          style={{ color: 'var(--color-celadon)' }}
        >
          없는 페이지
        </p>

        <h1
          className="font-headline font-bold text-xl mt-3"
          style={{ color: 'var(--color-heuk)' }}
        >
          Página no encontrada
        </h1>

        <p
          className="font-body text-sm mt-2 leading-relaxed"
          style={{ color: 'var(--color-heuk)', opacity: 0.55 }}
        >
          El enlace que seguiste no existe o fue movido.
          <br />
          Vuelve a la tienda y sigue explorando.
        </p>

        <Link
          href="/"
          className="inline-block mt-8 px-8 py-3 font-body font-semibold text-sm tracking-widest text-white transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-seoul-red)', letterSpacing: '0.12em' }}
        >
          VOLVER AL INICIO
        </Link>

        <p
          className="font-korean text-xs mt-6"
          style={{ color: 'var(--color-heuk)', opacity: 0.3 }}
        >
          서울킴스
        </p>
      </div>
    </div>
  )
}
