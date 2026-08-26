import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CUSTOMER_COOKIE = '__Host-seul_customer'
const B2B_PUBLIC_PATHS = ['/b2b/login', '/b2b/registro', '/b2b']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Proteger rutas B2B (excepto login y registro)
  if (pathname.startsWith('/b2b')) {
    const isPublicPath = B2B_PUBLIC_PATHS.some(p => pathname === p || pathname === p + '/')

    if (!isPublicPath) {
      const sessionCookie = request.cookies.get(CUSTOMER_COOKIE)
      if (!sessionCookie?.value) {
        const loginUrl = new URL('/b2b/login', request.url)
        loginUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(loginUrl)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/b2b/:path*'],
}
