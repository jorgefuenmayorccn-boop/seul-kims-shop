import type { IconProps } from '../types'
export function Train({ size = 20, strokeWidth = 1.5, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="14" rx="4" />
      <path d="M4 11h16M12 3v8M8 19l-2 2M16 19l2 2M8 19h8" />
      <circle cx="8.5" cy="15.5" r="1" fill={color} stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill={color} stroke="none" />
    </svg>
  )
}
