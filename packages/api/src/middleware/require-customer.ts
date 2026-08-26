import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { validateCustomerSession, CUSTOMER_COOKIE, type SessionCustomer } from '../lib/customer-auth'
import type { Bindings } from '../index'

type CustomerEnv = { Bindings: Bindings; Variables: { customer: SessionCustomer } }

export async function requireCustomer(c: Context<CustomerEnv>, next: Next) {
  const token = getCookie(c, CUSTOMER_COOKIE)
  if (!token) return c.json({ ok: false, error: 'No autenticado' }, 401)
  const customer = await validateCustomerSession(c.env, token)
  if (!customer) return c.json({ ok: false, error: 'Sesión inválida o expirada' }, 401)
  c.set('customer', customer)
  await next()
}
