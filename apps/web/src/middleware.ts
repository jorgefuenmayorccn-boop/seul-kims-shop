import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Redirect root path to shop
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/productos', request.url), { status: 307 })
  }
}

export const config = {
  matcher: ['/'],
}
