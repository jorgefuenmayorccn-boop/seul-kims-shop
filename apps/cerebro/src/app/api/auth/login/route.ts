import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'https://api.seoulshop.cl'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    // Forward Set-Cookie if present
    const result = NextResponse.json(data, { status: response.status })

    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      result.headers.set('Set-Cookie', setCookie)
    }

    return result
  } catch (error) {
    console.error('Login proxy error:', error)
    return NextResponse.json(
      { error: 'No se pudo conectar con el servidor' },
      { status: 500 }
    )
  }
}
