'use client'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const DEFAULT_PHOTO_URLS = ['/hero/hero-1.jpg', '/hero/hero-2.jpg', '/hero/hero-3.jpg']

const CAROUSEL_INTERVAL_MS = 6000

interface EditorialHeroProps {
  /** @deprecated Usa photoUrls (array). Si se pasa, se usa como única imagen (sin carrusel). */
  photoUrl?: string
  photoUrls?: string[]
  headline?: string
  subheadline?: string
  ctaLabel?: string
  ctaHref?: string
}

export function EditorialHero({
  photoUrl,
  photoUrls = DEFAULT_PHOTO_URLS,
  headline = '서울의 맛',
  subheadline = 'El sabor auténtico de Corea\nen el corazón de Viña del Mar',
  ctaLabel = 'Explorar tienda',
  ctaHref = '/productos',
}: EditorialHeroProps) {
  const photos = photoUrl ? [photoUrl] : photoUrls
  const [activeIndex, setActiveIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (photos.length <= 1 || prefersReducedMotion) return
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % photos.length)
    }, CAROUSEL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [photos.length, prefersReducedMotion])

  return (
    <section className="relative w-full overflow-hidden" style={{ aspectRatio: '16/7', minHeight: 320 }}>
      {/* Carrusel de fotos de fondo fullbleed */}
      <div className="absolute inset-0">
        <AnimatePresence initial={false}>
          <motion.div
            key={photos[activeIndex]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <Image
              src={photos[activeIndex]}
              alt="Seoul Kims — Productos coreanos"
              fill
              sizes="100vw"
              className="object-cover"
              priority={activeIndex === 0}
              fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
            />
          </motion.div>
        </AnimatePresence>
        {/* Overlay gradiente heuk */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(10,10,10,0.82) 0%, rgba(10,10,10,0.45) 55%, rgba(10,10,10,0.10) 100%)',
          }}
        />
      </div>

      {/* Indicadores de posición del carrusel */}
      {photos.length > 1 && (
        <div className="absolute bottom-6 right-8 z-10 flex gap-2">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Ir a la imagen ${i + 1}`}
              onClick={() => setActiveIndex(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === activeIndex ? 20 : 6,
                backgroundColor: i === activeIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </div>
      )}

      {/* 맛 — caracter héroe con mix-blend-mode:difference */}
      <motion.div
        initial={{ scale: 0.94 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none select-none hidden lg:block"
        style={{ mixBlendMode: 'difference' }}
      >
        <span
          className="font-korean font-black text-white block leading-none"
          style={{ fontSize: 'var(--hangul-hero)', letterSpacing: '-0.03em', opacity: 0.9 }}
        >
          맛
        </span>
      </motion.div>

      {/* Contenido principal */}
      <div className="relative z-10 h-full flex flex-col justify-center px-8 md:px-16 max-w-2xl">
        {/* Banda superior: 어서오세요 */}
        <motion.span
          initial={{ y: -10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-korean text-sm font-medium tracking-widest text-white mb-3 uppercase"
          style={{ letterSpacing: '0.18em', opacity: 0.7 }}
        >
          어서오세요 — Bienvenido
        </motion.span>

        {/* Headline principal */}
        <motion.h1
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="font-headline font-bold text-white leading-tight"
          style={{ fontSize: 'clamp(28px, 5vw, 56px)' }}
        >
          {headline}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ y: 12 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="font-body text-white mt-3 leading-relaxed whitespace-pre-line"
          style={{ fontSize: 'clamp(14px, 1.6vw, 18px)', opacity: 0.8 }}
        >
          {subheadline}
        </motion.p>

        {/* CTA — botón editorial baek */}
        <motion.div
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, delay: 0.48 }}
          className="mt-6 flex gap-3"
        >
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 px-6 py-3 font-body font-semibold text-heuk-950 bg-baek-100 rounded-none text-sm tracking-wide hover:bg-white transition-colors"
            style={{ letterSpacing: '0.06em' }}
          >
            {ctaLabel}
            <span className="font-korean text-xs">→</span>
          </Link>
          <Link
            href="#categorias"
            className="inline-flex items-center gap-2 px-6 py-3 font-body font-semibold text-white border border-white/40 text-sm tracking-wide hover:border-white/80 transition-colors rounded-none"
            style={{ letterSpacing: '0.06em' }}
          >
            Ver categorías
          </Link>
        </motion.div>
      </div>

      {/* Línea vertical derecha — detalle editorial */}
      <div className="absolute right-10 top-0 bottom-0 w-px bg-white/10 hidden xl:block" />

      {/* Indicador de scroll */}
      <motion.div
        style={{ opacity: 0.5 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          className="w-px h-8 bg-white/50"
        />
      </motion.div>
    </section>
  )
}
