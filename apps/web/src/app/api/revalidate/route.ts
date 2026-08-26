import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/revalidate — llamado por la API o Cerebro tras mutaciones de producto/inventario
// Protegido por un secret compartido (REVALIDATE_SECRET env var)
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  const body   = await req.json() as { tag?: string; secret?: string }

  if (secret && body.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tag = body.tag ?? 'products'
  revalidateTag(tag)
  return NextResponse.json({ revalidated: true, tag })
}
