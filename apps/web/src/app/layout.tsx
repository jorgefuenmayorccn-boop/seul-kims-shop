import type { Metadata } from 'next'
import { notoSansKr, poppins } from '@/lib/fonts'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'SEUL SHOP — Tienda coreana en Viña del Mar',
    template: '%s | SEUL SHOP',
  },
  description: 'Kimchi, ramen, snacks y K-beauty. Retiro gratis en Metro Merval o delivery con Rappi. Viña del Mar, Chile.',
  keywords: ['korea', 'kimchi', 'ramen', 'kpop', 'tienda coreana', 'viña del mar', 'chile'],
  openGraph: {
    siteName: 'SEUL SHOP',
    locale: 'es_CL',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={[notoSansKr.variable, poppins.variable].join(' ')}>{children}</body>
    </html>
  )
}
