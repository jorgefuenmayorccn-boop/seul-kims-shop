import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME  = 'seul_session'
const PUBLIC_PATHS = ['/login']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // NOTE: the session token is a JWT (variable length, well over 100 chars),
  // not a fixed-length 64-char hex string. The old `token.length !== 64` check
  // was a leftover from an earlier session-ID scheme and rejected every real
  // login — combined with the __Host- cookie bug this made POS unusable.
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
