import type { IconProps } from '../types'
export function Store({ size = 20, strokeWidth = 1.5, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 9l1-6h16l1 6" />
      <path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" />
      <path d="M4 9v12h16V9" />
      <path d="M9 21v-6h6v6" />
    </svg>
  )
}
