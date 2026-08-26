'use client'
import { cn } from '../lib/utils'

type Tier = 'hoobae' | 'sunbae' | 'hyung'

const TIER_CONFIG: Record<Tier, { label: string; korean: string; colorClass: string }> = {
  hoobae: {
    label:      'Hoobae',
    korean:     '후배',
    colorClass: 'bg-tier-hoobae text-white',
  },
  sunbae: {
    label:      'Sunbae',
    korean:     '선배',
    colorClass: 'bg-tier-sunbae text-white',
  },
  hyung: {
    label:      'Hyung',
    korean:     '형',
    colorClass: 'bg-tier-hyung text-white',
  },
}

interface TierBadgeProps {
  tier: Tier
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TierBadge({ tier, size = 'md', className }: TierBadgeProps) {
  const config = TIER_CONFIG[tier]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-base',
        config.colorClass,
        className,
      )}
    >
      <span>{config.label}</span>
      <span className="opacity-70">{config.korean}</span>
    </span>
  )
}
