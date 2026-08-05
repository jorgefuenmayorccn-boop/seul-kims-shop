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

// POS — importar via subpath:
// import { ProductTile }    from '@seul/ui/pos/product-tile'
// import { POSNumpad }      from '@seul/ui/pos/numpad'
// import { CartLine }       from '@seul/ui/pos/cart-line'
// import { BAESValidator }  from '@seul/ui/pos/baes-validator'
// import { ColdChainAlert } from '@seul/ui/pos/cold-chain-alert'
export { ColdChainAlert } from './pos/cold-chain-alert'   // también usado en repartidor

// Shop B2C — importar via subpath:
// import { ProductCard }    from '@seul/ui/shop/product-card'
// import { DeliveryPicker } from '@seul/ui/shop/delivery-picker'
// import { HeroSlider }     from '@seul/ui/shop/hero-slider'
// import { CategoryBubble } from '@seul/ui/shop/category-bubble'
// import { CheckoutTimer }  from '@seul/ui/shop/checkout-timer'
