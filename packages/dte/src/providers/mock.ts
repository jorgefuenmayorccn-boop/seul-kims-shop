import type { DteRequest, DteResponse } from '../types'

let folioCounter = 1000

export async function mockEmit(req: DteRequest): Promise<DteResponse> {
  await new Promise(r => setTimeout(r, 800)) // simula latencia

  const folio = ++folioCounter
  const now   = new Date()

  return {
    folio,
    trackId: `MOCK-${req.idempotencyKey}-${folio}`,
    ted:     `<TED>MOCK_TIMBRE_${folio}</TED>`,
    pdfUrl:  undefined,   // mock no genera PDF real
    timbre:  now,
  }
}

export async function mockGetStatus(trackId: string) {
  return { status: 'issued' as const, folio: trackId.split('-')[2] }
}
