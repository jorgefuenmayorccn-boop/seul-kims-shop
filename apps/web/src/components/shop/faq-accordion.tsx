'use client'
import { useState } from 'react'
import { ChevronDown } from '@seul/icons'
import { motion, AnimatePresence } from 'framer-motion'

interface FaqEntry {
  id:       string
  question: string
  answer:   string
  category: string
}

function AccordionItem({ entry, defaultOpen = false }: { entry: FaqEntry; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b" style={{ borderColor: 'var(--color-border-editorial)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-5 text-left group"
        aria-expanded={open}
      >
        <span
          className="font-body font-semibold text-sm pr-6"
          style={{ color: 'var(--color-heuk)' }}
        >
          {entry.question}
        </span>
        <ChevronDown
          size={16}
          color="var(--color-heuk)"
          className={`shrink-0 opacity-40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p
              className="font-body text-sm leading-relaxed pb-5 pr-8"
              style={{ color: 'var(--color-heuk)', opacity: 0.65 }}
            >
              {entry.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface FaqAccordionProps {
  grouped: Record<string, FaqEntry[]>
}

export function FaqAccordion({ grouped }: FaqAccordionProps) {
  return (
    <>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-10">
          <h2
            className="font-body text-[10px] font-semibold tracking-widest mb-1 pb-3 border-b"
            style={{ color: 'var(--color-celadon)', letterSpacing: '0.18em', borderColor: 'var(--color-celadon)', borderBottomWidth: 2 }}
          >
            {category.toUpperCase()}
          </h2>
          {items.map((e, i) => (
            <AccordionItem key={e.id} entry={e} defaultOpen={i === 0 && category === 'Pedidos'} />
          ))}
        </div>
      ))}
    </>
  )
}
