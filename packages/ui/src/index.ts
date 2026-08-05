// SEUL KING OS — UI Package barrel export

// Lib
export { cn, formatCLP, formatRUT } from './lib/utils'

// Shared badges & indicators
export { BadgeBAES } from './badge-baes'
export { BadgeChain } from './badge-chain'
export { BadgeExpiry } from './badge-expiry'
export { BadgeNutrition } from './badge-nutrition'

// Order & status
export { StatusPill } from './status-pill'

// Empty states
export { EmptyState } from './empty-state'

// Dashboard & inventario (Fase 1)
export { KPICard } from './kpi-card'
export { AlertBanner } from './alert-banner'
export { TrafficLight, TrafficLightStack } from './traffic-light'
export { SkeletonKPICard, SkeletonRow, SkeletonDashboard } from './skeleton'

// CTAs
export { WhatsAppCTA } from './whatsapp-cta'

// Channel-specific — imported via subpath
// import { POSNumpad } from '@seul/ui/pos/numpad'
// import { ProductCard } from '@seul/ui/shop/product-card'
