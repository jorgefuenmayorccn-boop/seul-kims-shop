// Tipos compartidos entre Server Components y Client Components
// No importa next/headers — seguro para uso en ambos contextos

export type SessionUser = {
  id:    string
  email: string
  name:  string
  role:  'owner' | 'admin' | 'staff' | 'delivery' | 'viewer'
}

export type ProductListItem = {
  id: string; sku: string; barcode?: string | null; name: string; nameKo?: string | null
  slug: string; brand?: string | null
  costPrice?:      string | number | null
  priceRetail:     string | number
  priceWeb?:       string | number | null
  pricePOS?:       string | number | null
  priceB2B?:       string | number | null
  discountWebPct?: number | null
  discountPOSPct?: number | null
  discountB2BPct?: number | null
  isBaesEligible: boolean
  coldChain: 'ambient' | 'refrigerated' | 'frozen'; isWeighable: boolean
  status: 'active' | 'inactive' | 'discontinued'; imageUrl?: string | null
  categoryId?: string | null; categoryName?: string | null; stockTotal: number
}

export type ProductDetail = ProductListItem & {
  description?: string | null; weightGrams?: number | null
  sellos: string[]
  images: Array<{ id: string; url: string; r2Key: string; sortOrder: number }>
  nextExpiry?: string | null
}

export type Category = { id: string; name: string; slug: string; emoji?: string | null }
