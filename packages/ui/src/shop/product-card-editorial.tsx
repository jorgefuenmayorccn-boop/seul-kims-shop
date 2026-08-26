'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { BadgeChain } from '../badge-chain'
import { BadgeBAES } from '../badge-baes'
import { BadgeExpiry } from '../badge-expiry'
import { formatCLP } from '../lib/utils'

export interface ProductCardEditorialData {
  id:             string
  slug:           string
  name:           string
  nameKo?:        string | null
  brand?:         string | null
  priceRetail:    number
  coldChain:      'ambient' | 'refrigerated' | 'frozen'
  isBaesEligible: boolean
  stockTotal:     number
  nextExpiry?:    string | null
  imageUrl?:      string | null
}

interface ProductCardEditorialProps {
  product: ProductCardEditorialData
  index?:  number
  onAdd?:  (product: ProductCardEditorialData) => void
}

export function ProductCardEditorial({ product, index = 0, onAdd }: ProductCardEditorialProps) {
  const outOfStock = product.stockTotal <= 0

  return (
    <motion.article
      initial={{ y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, transition: { type: 'spring', stiffness: 380, damping: 28 } }}
      className="group relative flex flex-col"
      style={{ opacity: outOfStock ? 0.6 : 1 }}
    >
      {/* Imagen 4:5 */}
      <Link
        href={`/producto/${product.slug}`}
        className="block relative overflow-hidden bg-baek-100"
        style={{ aspectRatio: '4/5' }}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-celadon-100">
            <span className="font-korean text-4xl text-celadon-500 opacity-40">식품</span>
          </div>
        )}

        {/* Overlay sutil en hover */}
        <div className="absolute inset-0 bg-heuk-950/0 group-hover:bg-heuk-950/10 transition-colors duration-300" />

        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <BadgeChain type={product.coldChain} />
          {product.isBaesEligible && <BadgeBAES status="eligible" />}
        </div>

        {/* Expiry top-right */}
        {product.nextExpiry && (
          <div className="absolute top-2 right-2">
            <BadgeExpiry expiresAt={new Date(product.nextExpiry)} />
          </div>
        )}

        {/* Agotado overlay */}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-korean text-xs font-medium px-3 py-1"
              style={{ background: 'var(--color-baek)', color: 'var(--color-heuk)', border: 'var(--border-editorial)' }}
            >
              품절 — Agotado
            </span>
          </div>
        )}
      </Link>

      {/* Info editorial */}
      <div className="pt-3 flex flex-col gap-1">
        {/* Marca */}
        {product.brand && (
          <span
            className="font-body text-[10px] tracking-widest uppercase"
            style={{ color: 'var(--color-celadon)', letterSpacing: '0.16em' }}
          >
            {product.brand}
          </span>
        )}

        {/* Nombre español */}
        <Link
          href={`/producto/${product.slug}`}
          className="font-body font-semibold text-sm leading-snug line-clamp-2 hover:text-seoul-red transition-colors"
          style={{ color: 'var(--color-heuk)' }}
        >
          {product.name}
        </Link>

        {/* Nombre coreano */}
        {product.nameKo && (
          <span
            className="font-korean text-xs"
            style={{ color: 'var(--color-heuk-soft)', opacity: 0.6 }}
          >
            {product.nameKo}
          </span>
        )}

        {/* Precio + CTA */}
        <div className="flex items-center justify-between pt-2 mt-auto">
          <span
            className="font-mono font-bold text-base"
            style={{ color: 'var(--color-heuk-950, var(--heuk-950))' }}
          >
            {formatCLP(product.priceRetail)}
          </span>

          {!outOfStock && (
            <motion.button
              onClick={() => onAdd?.(product)}
              whileTap={{ scale: 0.92 }}
              className="font-body text-[10px] font-semibold tracking-widest px-4 py-2 transition-colors"
              style={{
                letterSpacing: '0.12em',
                background: 'var(--color-heuk)',
                color: 'var(--color-baek)',
                border: 'none',
              }}
              aria-label={`Agregar ${product.name} al carrito`}
            >
              담기 +
            </motion.button>
          )}
        </div>
      </div>

      {/* Flash 담김 (added) - manejado por parent wrapper */}
    </motion.article>
  )
}
