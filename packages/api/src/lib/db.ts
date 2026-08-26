import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '@seul/db/schema'
import type { Bindings } from '../index'

// CF Workers tiene WebSocket global — necesario para Pool de Neon
if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket
}

export function getDb(env: Bindings) {
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  return drizzle(pool, { schema })
}
