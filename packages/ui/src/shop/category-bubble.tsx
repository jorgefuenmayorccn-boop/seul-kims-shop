import Link from 'next/link'
import { cn } from '../lib/utils'

interface CategoryBubbleProps {
  name:    string
  slug:    string
  emoji:   string
  active?: boolean
}

export function CategoryBubble({ name, slug, emoji, active }: CategoryBubbleProps) {
  return (
    <Link
      href={`/productos?categoria=${slug}`}
      className={cn(
        'flex flex-col items-center gap-2 group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-xl',
      )}
    >
      <div className={cn(
        'w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-full',
        'flex items-center justify-center text-3xl md:text-4xl',
        'border-2 transition-all duration-normal',
        'group-hover:scale-110 group-hover:shadow-md',
        active
          ? 'border-brand bg-brand/5 shadow-sm'
          : 'border-[var(--color-border)] bg-elevated group-hover:border-brand/40',
      )}>
        {emoji}
      </div>
      <span className={cn(
        'text-xs font-body font-medium text-center leading-tight max-w-[72px]',
        active ? 'text-brand' : 'text-text-muted group-hover:text-text',
      )}>
        {name}
      </span>
    </Link>
  )
}

// Categorías Seoul Kims — datos estáticos + query a API
export const SEUL_CATEGORIES = [
  { slug: 'ramen',        name: 'Ramen',              emoji: '🍜' },
  { slug: 'kimchi',       name: 'Kimchi & Fermentados', emoji: '🥬' },
  { slug: 'snacks',       name: 'Snacks',             emoji: '🍿' },
  { slug: 'bebidas',      name: 'Bebidas',             emoji: '🥤' },
  { slug: 'salsas',       name: 'Salsas & Condimentos', emoji: '🌶' },
  { slug: 'instantaneos', name: 'Instantáneos',        emoji: '⚡' },
  { slug: 'k-beauty',     name: 'K-Beauty',            emoji: '✨' },
  { slug: 'regalo',       name: 'Regalo K-Pop',        emoji: '🎁' },
] as const
