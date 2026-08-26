import { eq, and, gt } from 'drizzle-orm'
import { getDb } from './db'
import { customers, customerSessions } from '@seul/db/schema'
import { hashPassword, verifyPassword, generateToken } from './crypto'
import type { Bindings } from '../index'

export const CUSTOMER_COOKIE  = '__Host-seul_customer'
const SESSION_TTL_MS           = 7 * 24 * 60 * 60 * 1000
const LOCKOUT_ATTEMPTS         = 5
const LOCKOUT_MS               = 15 * 60 * 1000

export type SessionCustomer = {
  id:                string
  email:             string
  name:              string
  emailVerified:     boolean
  mustChangePassword: boolean
  marketingOptIn:    boolean
}

export async function createCustomerSession(
  env: Bindings,
  customerId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<string> {
  const db         = getDb(env)
  const token      = generateToken()
  const expiresAt  = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(customerSessions).values({ id: token, customerId, expiresAt, ip: meta.ip, userAgent: meta.userAgent })
  return token
}

export async function validateCustomerSession(env: Bindings, token: string): Promise<SessionCustomer | null> {
  if (!token || token.length !== 64) return null
  const db = getDb(env)

  const [row] = await db
    .select({ customer: {
      id:                customers.id,
      email:             customers.email,
      name:              customers.name,
      emailVerified:     customers.emailVerified,
      mustChangePassword: customers.mustChangePassword,
      marketingOptIn:    customers.marketingOptIn,
      deletedAt:         customers.deletedAt,
    }})
    .from(customerSessions)
    .innerJoin(customers, eq(customerSessions.customerId, customers.id))
    .where(and(eq(customerSessions.id, token), gt(customerSessions.expiresAt, new Date())))

  if (!row || row.customer.deletedAt) return null

  // Rolling refresh — extiende si quedan < 3 días
  const [sess] = await db.select({ expiresAt: customerSessions.expiresAt }).from(customerSessions).where(eq(customerSessions.id, token))
  if (sess && new Date(sess.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000) {
    await db.update(customerSessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(customerSessions.id, token))
  }

  return {
    id:                row.customer.id,
    email:             row.customer.email ?? '',
    name:              row.customer.name,
    emailVerified:     row.customer.emailVerified,
    mustChangePassword: row.customer.mustChangePassword,
    marketingOptIn:    row.customer.marketingOptIn,
  }
}

export async function revokeCustomerSession(env: Bindings, token: string): Promise<void> {
  const db = getDb(env)
  await db.delete(customerSessions).where(eq(customerSessions.id, token))
}

export async function revokeAllCustomerSessions(env: Bindings, customerId: string): Promise<void> {
  const db = getDb(env)
  await db.delete(customerSessions).where(eq(customerSessions.customerId, customerId))
}

export { hashPassword, verifyPassword, generateToken }
