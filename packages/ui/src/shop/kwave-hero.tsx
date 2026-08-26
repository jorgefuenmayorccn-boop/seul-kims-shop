'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Slide {
  id:          string
  koreanTag:   string       // hangul decorativo pequeño arriba
  headline:    string
  subheadline: string
  cta:         { label: string; href: string }
  bg:          string       // CSS gradient
  accentColor: string
  decorEmoji?: string
}

const SLIDES: Slide[] = [
  {
    id: '1',
    koreanTag:   '서울의 맛',
    headline:    'El pedacito de Seúl\nque faltaba en Viña',
    subheadline: 'Kimchi, ramen, snacks y K-beauty.\nRetiro gratis en Metro Merval.',
    cta: { label: 'Explorar tienda', href: '/productos' },
    bg: 'linear-gradient(135deg, #0D1B3E 0%, #1A0A14 50%, #4a0a1a 100%)',
    accentColor: '#F5EFE6',
    decorEmoji: '🇰🇷',
  },
  {
    id: '2',
    koreanTag:   '불닭볶음면',
    headline:    'Nuevo drop\nBuldak 2x Spicy 🔥',
    subheadline: 'El ramen más picante del mundo,\nahora disponible en Viña del Mar.',
    cta: { label: 'Ver producto', href: '/producto/buldak-ramen-2x-spicy' },
    bg: 'linear-gradient(135deg, #4a0000 0%, #8B0000 50%, #D7263D 100%)',
    accentColor: '#ffffff',
    decorEmoji: '🍜',
  },
  {
    id: '3',
    koreanTag:   '10% 할인',
    headline:    '10% en tu\nprimera compra',
    subheadline: 'Usa el código SEUL10\nal finalizar tu pedido.',
    cta: { label: 'Empezar ahora', href: '/productos' },
    bg: 'linear-gradient(135deg, #1a0a2e 0%, #2e1a0a 50%, #5a3520 100%)',
    accentColor: '#E8B84A',
    decorEmoji: '🎁',
  },
]

// Animación letra por letra
function AnimatedHeadline({ text, color }: { text: string; color: string }) {
  const words = text.split('\n').map(line => line.split(' '))
  return (
    <h2 className="font-headline font-bold text-3xl md:text-5xl leading-tight whitespace-pre-line">
      {words.map((line, li) => (
        <span key={li} className="block">
          {line.map((word, wi) => (
            <motion.span
              key={`${li}-${wi}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: (li * line.length + wi) * 0.08 }}
              className="inline-block mr-2"
              style={{ color }}
            >
              {word}
            </motion.span>
          ))}
        </span>
      ))}
    </h2>
  )
}

interface KwaveHeroProps {
  slides?: Slide[]
  autoPlayMs?: number
}

export function KwaveHero({ slides = SLIDES, autoPlayMs = 5500 }: KwaveHeroProps) {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent(i => (i + 1) % slides.length), [slides.length])
  const prev = useCallback(() => setCurrent(i => (i - 1 + slides.length) % slides.length), [slides.length])

  useEffect(() => {
    const t = setInterval(next, autoPlayMs)
    return () => clearInterval(t)
  }, [next, autoPlayMs])

  const slide = slides[current]

  return (
    <div className="relative overflow-hidden rounded-2xl aspect-[16/7] min-h-[280px] group">
      {/* Background animado con crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          className="absolute inset-0"
          style={{ background: slide.bg }}
        />
      </AnimatePresence>

      {/* Patrón decorativo coreano (dots grid) */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Emoji decorativo grande a la derecha */}
      {slide.decorEmoji && (
        <motion.div
          key={`emoji-${slide.id}`}
          initial={{ opacity: 0, x: 20, rotate: -10 }}
          animate={{ opacity: 0.15, x: 0, rotate: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-[120px] md:text-[180px] select-none pointer-events-none hidden md:block"
        >
          {slide.decorEmoji}
        </motion.div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`content-${slide.id}`}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col justify-center h-full px-8 md:px-14 max-w-xl"
        >
          {/* Tag coreano decorativo */}
          <motion.span
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 0.7, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-korean text-sm font-medium mb-2 block"
            style={{ color: slide.accentColor }}
          >
            {slide.koreanTag}
          </motion.span>

          {/* Headline animado por palabra */}
          <AnimatedHeadline text={slide.headline} color={slide.accentColor} />

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="font-body text-sm md:text-base mt-3 whitespace-pre-line"
            style={{ color: slide.accentColor }}
          >
            {slide.subheadline}
          </motion.p>

          {/* CTA */}
          <motion.a
            href={slide.cta.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.35 }}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[var(--color-brand)] font-semibold text-sm font-body hover:shadow-brand-glow transition-shadow self-start"
          >
            {slide.cta.label}
            <span>→</span>
          </motion.a>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
        aria-label="Anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
        aria-label="Siguiente"
      >
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => setCurrent(i)}
            animate={{ width: i === current ? 20 : 8, opacity: i === current ? 1 : 0.4 }}
            transition={{ duration: 0.3 }}
            className="h-2 rounded-full bg-white"
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
