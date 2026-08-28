const BASE_URL = 'https://seoulshop.cl'

export function localBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'GroceryStore',
    name: 'SEUL SHOP CL',
    url: BASE_URL,
    telephone: '+56936451991',
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Viña del Mar',
      addressRegion: 'Valparaíso',
      addressCountry: 'CL',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: -33.0245,
      longitude: -71.5518,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    sameAs: ['https://www.instagram.com/seulshopcl'],
  }
}

export function productJsonLd(product: {
  name: string
  description?: string | null
  imageUrl?: string | null
  priceRetail: number
  slug: string
  stockTotal: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    url: `${BASE_URL}/producto/${product.slug}`,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CLP',
      price: product.priceRetail,
      availability:
        product.stockTotal > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'SEUL SHOP CL',
      },
    },
  }
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
