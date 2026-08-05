import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@seul/db/schema'
import type { Bindings } from '../index'

export function getDb(env: Bindings) {
  const sql = neon(env.DATABASE_URL)
  return drizzle(sql, { schema })
}
