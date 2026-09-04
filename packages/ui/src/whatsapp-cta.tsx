import { MessageCircle } from 'lucide-react'
import { cn } from './lib/utils'

interface WhatsAppCTAProps {
  phone?: string
  message?: string
  variant?: 'floating' | 'inline' | 'button'
  className?: string
}

const SEUL_WA_NUMBER = '56948785299'

export function WhatsAppCTA({
  phone = SEUL_WA_NUMBER,
  message = '¡Hola! Quiero hacer un pedido en Seoul Kims',
  variant = 'floating',
  className,
}: WhatsAppCTAProps) {
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

  if (variant === 'floating') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'flex items-center gap-2 px-4 py-3 rounded-full',
          'bg-[var(--color-channel-whatsapp)] text-white',
          'shadow-lg hover:shadow-xl transition-all duration-normal hover:scale-105',
          'font-body font-medium text-sm',
          className
        )}
        aria-label="Pedir por WhatsApp"
      >
        <MessageCircle size={20} fill="white" strokeWidth={0} />
        <span className="hidden sm:inline">Pedir por WhatsApp</span>
      </a>
    )
  }

  if (variant === 'button') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-2 px-5 py-2.5 rounded-md',
          'bg-[var(--color-channel-whatsapp)] text-white',
          'hover:opacity-90 transition-opacity font-body font-medium text-sm',
          className
        )}
      >
        <MessageCircle size={16} />
        Pedir por WhatsApp
      </a>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1.5 text-sm text-[var(--color-channel-whatsapp)] hover:underline', className)}
    >
      <MessageCircle size={14} />
      Pedir por WhatsApp
    </a>
  )
}
