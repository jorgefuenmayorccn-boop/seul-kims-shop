// SVG Icons del POS — vectores propios, sin emojis
// Estilo: stroke 1.5px, rounded, 20×20 viewport por defecto

interface IconProps {
  size?: number
  className?: string
  color?: string
}

const defaults = { size: 20, color: 'currentColor' }

export function IconRamen({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M3 9h14M4 9c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 9h16l-1.5 7h-13L2 9z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 6.5c.5-1 1.5-1 2 0s1.5 1 2 0" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9 12v2M11.5 11.5v3M6.5 12.5v1.5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export function IconKimchi({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="3" y="7" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M6 7V5.5a4 4 0 018 0V7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 11c1-1.5 7-1.5 8 0" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="7.5" cy="13.5" r="0.8" fill={color}/>
      <circle cx="10" cy="14" r="0.8" fill={color}/>
      <circle cx="12.5" cy="13.5" r="0.8" fill={color}/>
    </svg>
  )
}

export function IconSnacks({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M6 4h8l1 12H5L6 4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M5.5 4c0-1 1-1.5 4.5-1.5S14.5 3 14.5 4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M7 8h6M7.5 11h5M8 14h4" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
    </svg>
  )
}

export function IconDrink({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M6 3h8l-1.5 14h-5L6 3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6.5 7h7" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M14 5h2.5l-1 4H14" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="11" r="1.5" stroke={color} strokeWidth="1.2"/>
    </svg>
  )
}

export function IconSauce({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M8 3h4v2.5c2 .5 3.5 2.5 3.5 5.5 0 4-2 6-5.5 6S4.5 15 4.5 11c0-3 1.5-5 3.5-5.5V3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 3h4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 13c.8 1 2 1.5 3 1.5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export function IconFrozen({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M10 2v16M2 10h16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4.93 4.93l10.14 10.14M15.07 4.93L4.93 15.07" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="2" stroke={color} strokeWidth="1.5"/>
      <circle cx="10" cy="2.5" r="1" fill={color}/>
      <circle cx="10" cy="17.5" r="1" fill={color}/>
      <circle cx="2.5" cy="10" r="1" fill={color}/>
      <circle cx="17.5" cy="10" r="1" fill={color}/>
    </svg>
  )
}

export function IconBeauty({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M7 4h6v1.5c1.5.5 2.5 2 2.5 4.5 0 4.5-2 7-5.5 7S4.5 14 4.5 10c0-2.5 1-4 2.5-4.5V4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8.5 2.5C8.5 1.7 9 1 10 1s1.5.7 1.5 1.5V4h-3V2.5z" stroke={color} strokeWidth="1.3"/>
      <path d="M7.5 11c.5 1.5 1.5 2.5 2.5 2.5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export function IconAll({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="3" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
      <rect x="3" y="11" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="11" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}

export function IconCart({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M2 2h2l2.5 10h9l2-7H6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8.5" cy="16.5" r="1.5" stroke={color} strokeWidth="1.3"/>
      <circle cx="14.5" cy="16.5" r="1.5" stroke={color} strokeWidth="1.3"/>
    </svg>
  )
}

export function IconSearch({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="9" r="5.5" stroke={color} strokeWidth="1.5"/>
      <path d="M13.5 13.5L17 17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconBarcode({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M2 5v10M5 5v10M7.5 5v10M9.5 5v10M11 5v10M13 5v10M15.5 5v10M18 5v10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M8 5v10M12 5v10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconSun({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="10" cy="10" r="4" stroke={color} strokeWidth="1.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconMoon({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M17 11.5A7 7 0 118.5 3a5.5 5.5 0 008.5 8.5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconSettings({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="10" cy="10" r="3" stroke={color} strokeWidth="1.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeDasharray="0 2.5"/>
      <path clipRule="evenodd" d="M10 1l1.2 1.9a8 8 0 011.4.6L14.8 3l1.2 1.2-1.5 2.2c.2.4.4.9.6 1.4L17 9v1.5l-1.9 1.2a8 8 0 01-.6 1.4l.5 2.2-1.2 1.2-2.2-1.5a8 8 0 01-1.4.6L9 17.2 7.5 17l-1.2-1.9a8 8 0 01-1.4-.6L2.8 15 1.5 13.8l1.5-2.2A8 8 0 012.4 10L1 8.8V7.5l1.9-1.2a8 8 0 01.6-1.4L3 2.7 4.2 1.5l2.2 1.5a8 8 0 011.4-.6L9 .5 10 1z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconPrint({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M6 7V2h8v5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="2" y="7" width="16" height="8" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <path d="M6 12h8v6H6z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="5" cy="10.5" r="1" fill={color}/>
    </svg>
  )
}

export function IconClose({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M4 4l12 12M16 4L4 16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconCheck({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M3.5 10.5l4.5 4.5 8.5-9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconShift({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth="1.5"/>
      <path d="M10 5v5l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconHistory({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth="1.5"/>
      <path d="M10 6v4l2.5 2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.5 3.5L2 2" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M4 6H1.5l-.5-3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconBAES({ size = defaults.size, className, color = defaults.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="2" y="4" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M2 8h16" stroke={color} strokeWidth="1.3"/>
      <path d="M6 13h4M14 13h.01" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="15" cy="6" r="2.5" fill={color}/>
      <path d="M14.2 6l.8.8 1.5-1.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
