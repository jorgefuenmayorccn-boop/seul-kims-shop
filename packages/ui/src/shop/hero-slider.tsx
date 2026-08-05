'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface Slide {
  id:          string
  headline:    string
  subheadline: string
  cta:         { label: string; href: string }
  bg:          string   // CSS gradient o color
  accent?:     string   // color del texto
}

// Slides Seoul Kims — copy real
export const SEUL_SLIDES: Slide[] = [
  {
    id: '1',
    headline:    'El pedacito de Seúl\nque faltaba en Viña',
    subheadline: 'Kimchi, ramen, snacks y K-beauty.\nRetiro gratis en Metro Merval o delivery con Rappi.',
    cta: { label: 'Explorar tienda', href: '/productos' },
    bg: 'from-[#1a1a1a] to-[#2e1a1a]',
    accent: '#F5EFE6',
  },
  {
    id: '2',
    headline:    'Nuevo drop\nSamyang Buldak 2x Spicy 🔥',
    subheadline: 'El ramen picante que rompió TikTok, ahora en Viña.',
    cta: { label: 'Ver producto', href: '/producto/samyang-buldak-2x-spicy' },
    bg: 'from-[#8B0000] to-[#D7263D]',
    accent: '#ffffff',
  },
  {
    id: '3',
    headline:    '10% en tu\nprimera compra',
    subheadline: 'Usa el código SEUL10 al finalizar tu pedido.',
    cta: { label: 'Empezar', href: '/productos' },
    bg: 'from-[#2e1a0a] to-[#5a3520]',
    accent: '#F4B942',
  },
]

interface HeroSliderProps {
  slides?: Slide[]
  autoPlayMs?: number
}

export function HeroSlider({ slides = SEUL_SLIDES, autoPlayMs = 5000 }: HeroSliderProps) {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent(i => (i + 1) % slides.length), [slides.length])
  const prev = useCallback(() => setCurrent(i => (i - 1 + slides.length) % slides.length), [slides.length])

  useEffect(() => {
    const t = setInterval(next, autoPlayMs)
    return () => clearInterval(t)
  }, [next, autoPlayMs])

  const slide = slides[current]

  return (
    <div className="relative overflow-hidden rounded-2xl aspect-[16/7] min-h-[280px]">
      {/* Background */}
      <div className={cn('absolute inset-0 bg-gradient-to-br transition-all duration-slow', slide.bg)} />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-14 max-w-xl">
        <h2
          className="font-headline font-bold text-3xl md:text-5xl leading-tight whitespace-pre-line"
          style={{ color: slide.accent ?? '#ffffff' }}
        >
          {slide.headline}
        </h2>
        <p
          className="font-body text-sm md:text-base mt-3 opacity-85 whitespace-pre-line"
          style={{ color: slide.accent ?? '#ffffff' }}
        >
          {slide.subheadline}
        </p>
        <a
          href={slide.cta.href}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-[var(--color-brand)] font-semibold text-sm font-body hover:bg-[var(--cream-500)] transition-colors self-start"
        >
          {slide.cta.label}
        </a>
      </div>

      {/* Controls */}
      <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors" aria-label="Anterior">
        <ChevronLeft size={18} />
      </button>
      <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors" aria-label="Siguiente">
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              'rounded-full transition-all',
              i === current ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/70',
            )}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
