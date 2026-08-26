import { Noto_Sans_KR, Poppins } from 'next/font/google'

export const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-korean',
  preload: false, // Korean subset muy grande — cargar lazy
})

export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-display',
})
