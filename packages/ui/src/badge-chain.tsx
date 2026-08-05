import { Snowflake, Droplets, Sun } from 'lucide-react'
import { cn } from './lib/utils'

type ChainType = 'frozen' | 'refrigerated' | 'ambient'

interface BadgeChainProps {
  type: ChainType
  showLabel?: boolean
  className?: string
}

const config: Record<ChainType, {
  icon: typeof Snowflake
  label: string
  className: string
}> = {
  frozen: {
    icon: Snowflake,
    label: 'Congelado',
    className: 'bg-cold-frozen-bg text-cold-frozen border border-cold-frozen/30',
  },
  refrigerated: {
    icon: Droplets,
    label: 'Refrigerado',
    className: 'bg-cold-refrigerated-bg text-cold-refrigerated border border-cold-refrigerated/40',
  },
  ambient: {
    icon: Sun,
    label: 'Ambiente',
    className: 'bg-surface text-text-muted border border-border',
  },
}

export function BadgeChain({ type, showLabel = false, className }: BadgeChainProps) {
  if (type === 'ambient') return null

  const { icon: Icon, label, className: typeClass } = config[type]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        typeClass,
        className
      )}
      title={label}
    >
      <Icon size={11} strokeWidth={2.5} />
      {showLabel && label}
    </span>
  )
}
