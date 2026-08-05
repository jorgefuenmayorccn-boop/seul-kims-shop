import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Seoul Kims — Tienda coreana en Viña del Mar',
    template: '%s | Seoul Kims',
  },
  description: 'Kimchi, ramen, snacks y K-beauty. Retiro gratis en Metro Merval o delivery con Rappi. Viña del Mar, Chile.',
  keywords: ['korea', 'kimchi', 'ramen', 'kpop', 'tienda coreana', 'viña del mar', 'chile'],
  openGraph: {
    siteName: 'Seoul Kims',
    locale: 'es_CL',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
