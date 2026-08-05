import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Seoul Kims · Repartidor',
  description: 'App de repartidor Seoul Kims',
  manifest: '/manifest.json',
  themeColor: '#D7263D',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SK Repartidor' },
}

export default function RepartidorLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  )
}
