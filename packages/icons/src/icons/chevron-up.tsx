import type { IconProps } from '../types'
export function ChevronUp({ size = 20, strokeWidth = 1.5, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}
