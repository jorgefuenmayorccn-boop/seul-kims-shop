import type { IconProps } from '../types'
export function Snowflake({ size = 20, strokeWidth = 1.5, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2v20M2 12h20M6.34 6.34l11.32 11.32M17.66 6.34L6.34 17.66" />
      <path d="M12 6l-2-2 2-2M12 18l-2 2 2 2M6 12l-2-2 2-2M18 12l-2 2 2 2" />
    </svg>
  )
}
