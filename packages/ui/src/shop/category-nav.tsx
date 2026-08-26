'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface CategoryItem {
  slug:    string
  nameEs:  string
  nameKo:  string
  count?:  number
}

const CATEGORIES: CategoryItem[] = [
  { slug: 'ramen',        nameEs: 'RAMEN',        nameKo: '라면' },
  { slug: 'snacks',       nameEs: 'SNACKS',       nameKo: '과자' },
  { slug: 'salsas',       nameEs: 'SALSAS',       nameKo: '소스' },
  { slug: 'bebidas',      nameEs: 'BEBIDAS',       nameKo: '음료' },
  { slug: 'kimchi',       nameEs: 'KIMCHI',        nameKo: '김치' },
  { slug: 'congelados',   nameEs: 'CONGELADOS',    nameKo: '냉동' },
  { slug: 'k-beauty',     nameEs: 'K-BEAUTY',      nameKo: '뷰티' },
]

interface CategoryNavProps {
  activeSlug?: string
  categories?: CategoryItem[]
}

export function CategoryNav({ activeSlug, categories = CATEGORIES }: CategoryNavProps) {
  return (
    <nav
      id="categorias"
      className="w-full border-t border-b"
      style={{ borderColor: 'var(--border-editorial)' }}
    >
      <div className="flex items-stretch overflow-x-auto scrollbar-none">
        {/* Label izquierdo */}
        <div
          className="shrink-0 flex items-center px-6 border-r"
          style={{ borderColor: 'var(--border-editorial)' }}
        >
          <span
            className="font-korean text-xs font-medium tracking-widest"
            style={{ color: 'var(--color-celadon)', letterSpacing: '0.2em', writingMode: 'horizontal-tb' }}
          >
            카테고리
          </span>
        </div>

        {/* Items */}
        {categories.map((cat, i) => {
          const isActive = cat.slug === activeSlug
          return (
            <motion.div
              key={cat.slug}
              className="shrink-0"
            >
              <Link
                href={`/productos?categoria=${cat.slug}`}
                className="flex flex-col items-center justify-center h-full px-6 py-4 gap-1 group relative"
                style={{ minWidth: 100 }}
              >
                {/* Nombre español */}
                <span
                  className="font-body font-semibold text-[11px] tracking-widest transition-colors"
                  style={{
                    letterSpacing: '0.14em',
                    color: isActive ? 'var(--color-seoul-red)' : 'var(--color-heuk)',
                  }}
                >
                  {cat.nameEs}
                </span>
                {/* Nombre coreano */}
                <span
                  className="font-korean text-xs transition-colors"
                  style={{ color: isActive ? 'var(--color-celadon)' : 'var(--color-heuk-soft)', opacity: 0.7 }}
                >
                  {cat.nameKo}
                </span>

                {/* Línea inferior activa / hover */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: isActive ? 'var(--color-seoul-red)' : 'var(--color-heuk)' }}
                  initial={false}
                  animate={{ scaleX: isActive ? 1 : 0 }}
                  whileHover={{ scaleX: 1, backgroundColor: 'var(--color-seoul-red)' }}
                  transition={{ duration: 0.25 }}
                />
              </Link>
            </motion.div>
          )
        })}

        {/* Ver todo */}
        <div className="ml-auto shrink-0 flex items-center px-6 border-l" style={{ borderColor: 'var(--border-editorial)' }}>
          <Link
            href="/productos"
            className="font-body text-[11px] font-semibold tracking-widest hover:text-seoul-red transition-colors"
            style={{ letterSpacing: '0.14em', color: 'var(--color-heuk)' }}
          >
            VER TODO →
          </Link>
        </div>
      </div>
    </nav>
  )
}
