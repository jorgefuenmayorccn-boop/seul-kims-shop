'use client'
import { motion } from 'framer-motion'
import { CategoryBubble } from './category-bubble'

interface CategoryBubbleAnimatedProps {
  name:    string
  slug:    string
  emoji:   string
  active?: boolean
  index?:  number
}

export function CategoryBubbleAnimated({ name, slug, emoji, active, index = 0 }: CategoryBubbleAnimatedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.12, rotate: -4, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.95 }}
    >
      <CategoryBubble name={name} slug={slug} emoji={emoji} active={active} />
    </motion.div>
  )
}
