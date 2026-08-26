import { type NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = '__Host-seul_session'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Root renders inline login form when unauthenticated — allow through
  if (pathname === '/') return NextResponse.next()

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || token.length !== 64) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
