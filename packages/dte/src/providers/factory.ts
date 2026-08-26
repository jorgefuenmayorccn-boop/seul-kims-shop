import type { DteRequest, DteResponse } from '../types'
import { mockEmit } from './mock'
import { openFacturaEmit } from './openfactura'

export interface DteEnv {
  DTE_PROVIDER?:    string   // 'openfactura' | 'mock' (default: mock)
  DTE_API_KEY?:     string
  DTE_RUT_EMPRESA?: string
}

export async function emitDte(req: DteRequest, env: DteEnv): Promise<DteResponse> {
  const provider = env.DTE_PROVIDER ?? (env.DTE_API_KEY ? 'openfactura' : 'mock')

  if (provider === 'openfactura') {
    if (!env.DTE_API_KEY)     throw new Error('DTE_API_KEY no configurada')
    if (!env.DTE_RUT_EMPRESA) throw new Error('DTE_RUT_EMPRESA no configurado')
    return openFacturaEmit(req, env.DTE_API_KEY, env.DTE_RUT_EMPRESA)
  }

  return mockEmit(req)
}
