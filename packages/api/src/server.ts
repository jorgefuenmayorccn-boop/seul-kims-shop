import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { serve } from '@hono/node-server'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import jwt from 'jsonwebtoken'
import { sql, ADMIN_EMAIL, JWT_SECRET, CUSTOMER_JWT_SECRET } from './db'
import { enqueueEmail, templates } from './email-queue'
import { apiKeysController } from './controllers/api-keys'
import { validateApiKeyMiddleware } from './services/api-key.service'
import { AuthService } from './services/auth.service'
import { PasswordService } from './services/password.service'
import { requireAuthMiddleware, requireScopeMiddleware, requireSession, getOptionalSession, requireCustomerSession, getOptionalCustomerSession } from './middleware/auth.middleware'
import { emitPosEvent, emitDeliveryEvent, onPosEvent, onDeliveryEvent } from './sse-broadcaster'
// SEUL_SESSION_boletas-80mm (adición fuera de numeración S01-S17): seam para
// el DTE real futuro. `emitDte` ya soportaba 'mock' | 'openfactura' vía
// DTE_PROVIDER — hoy se llama SIEMPRE con DTE_PROVIDER: 'mock' explícito
// (nunca leyendo env), así nunca contacta un proveedor real aunque alguien
// configure DTE_API_KEY en Railway antes de tiempo. Ver POST /api/orders.
import { emitDte, type DteRequest } from '@seul/dte'
import { STORE_INFO } from '@seul/pdf-templates/client'

// ============================================================================
// SESSION COOKIE
// ============================================================================
// IMPORTANT: this cookie must be readable by the Next.js middleware running on
// EVERY frontend subdomain (cmr.seoulshop.cl, pos.seoulshop.cl, drive.seoulshop.cl,
// seoulshop.cl) even though it is only ever *set* by this API on api.seoulshop.cl.
// A "__Host-" prefixed cookie is strictly host-only per spec — it can never carry
// a Domain attribute, so it would only ever be visible to api.seoulshop.cl itself
// and never reach the other subdomains' own server-side session checks (this was
// the root cause of the "login succeeds but the app loops back to /login" bug).
// Using a plain name + an explicit parent-domain Domain attribute shares the
// cookie across every *.seoulshop.cl subdomain instead.
const SESSION_COOKIE_NAME = 'seul_session'
function sessionCookieDomain(c: any): string | undefined {
  const origin = c.req.header('Origin') || c.req.header('Referer') || ''
  // Only scope the cookie to the apex domain in production (seoulshop.cl and its
  // subdomains). Local dev (localhost) must NOT set Domain or browsers reject the cookie.
  return origin.includes('seoulshop.cl') ? '.seoulshop.cl' : undefined
}

// CUSTOMER session cookie (S09, Fase 3) — deliberately a DIFFERENT name from
// SESSION_COOKIE_NAME (staff) so the two can never collide or be confused, and
// signed with CUSTOMER_JWT_SECRET (see db.ts) so a customer token is
// cryptographically invalid if replayed against a staff endpoint or vice versa.
// Same NOT-"__Host-" + Domain=.seoulshop.cl pattern as the staff cookie above —
// that prefix is strictly host-only per spec and was the root cause of the
// original cross-subdomain login bug fixed in Fase 0; not repeating it here.
const CUSTOMER_SESSION_COOKIE_NAME = 'seul_customer_session'

// API's own public base URL (gap crítico — foto de comprobante de entrega,
// ver POST /api/delivery/assignments/:id/pod más abajo). Sin credenciales R2
// configuradas (verificado, cero env vars R2_*), la foto se guarda en disco
// local de ESTE mismo servicio (Railway) y se sirve desde acá mismo —
// apps/web (donde viven las fotos de producto/hero) corre en Vercel, un
// deploy sin filesystem compartido con la API (confirmado revisando
// Dockerfile: no copia apps/web al runtime), así que "seoulshop.cl/pod/..."
// no es alcanzable — la URL pública real es la de la API.
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'https://api.seoulshop.cl'

// Directorio local donde se guardan las fotos de POD subidas por el
// repartidor. Almacenamiento efímero (se pierde en cada redeploy de Railway)
// — limitación conocida y aceptada explícitamente por el dueño hasta que
// haya credenciales R2 reales, mismo criterio pragmático que las fotos de
// producto/hero de esta misma sesión.
const POD_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'pod')

// Directorio local para fotos de producto subidas desde cerebro (adición
// post-entrega, 2-sep-2026 — apps/cerebro/.../image-uploader.tsx ya llama a
// POST /api/products/:productId/images, 404 hoy). Mismo criterio pragmático
// que POD_UPLOAD_DIR de arriba: sin credenciales R2 configuradas, se guarda
// en disco local de este servicio (Railway, efímero — se pierde en cada
// redeploy) y se sirve desde GET /product-photos/:filename (ver abajo, junto
// a /pod/:filename). `product_images.r2_key` guarda hoy el nombre de archivo
// local (no una key real de R2) — cuando exista R2, ese campo pasa a
// contener la key real sin cambiar el shape de la tabla.
const PRODUCT_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'products')

// Directorio local para documentos de respaldo de solicitudes de crédito B2B
// (adición post-entrega, 2-sep-2026 — flujo de aprobación de crédito B2B
// pedido explícito del dueño). Mismo criterio pragmático de disco local que
// PRODUCT_UPLOAD_DIR/POD_UPLOAD_DIR (sin R2 configurado). A diferencia de
// esos dos, estos son documentos financieros/de identidad de una empresa —
// la ruta que los sirve (GET /b2b-docs/:filename, ver más abajo) NO es
// pública sin sesión como /pod y /product-photos: exige sesión de staff
// owner/admin o sesión de la empresa dueña de la solicitud.
const B2B_DOC_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'b2b-credit-docs')

// Public storefront base URL — used to build links inside customer-facing
// emails (password reset, welcome). Distinct from the staff panel's
// cmr.seoulshop.cl links used in the staff email templates.
const CUSTOMER_WEB_URL = process.env.CUSTOMER_WEB_URL || 'https://seoulshop.cl'

// ============================================================================
// APP
// ============================================================================

const app = new Hono()

const corsOptions = cors({
  origin: [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
    'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl',
    'https://seul-kims-shop.vercel.app', // Vercel preview URLs
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Apply CORS to all API endpoints
app.use('/api/*', corsOptions)

// HEALTH
app.get('/', (c) => c.json({ service: 'SEUL KING OS API v1.0' }))
app.get('/health', async (c) => {
  try {
    await sql`SELECT 1`
    return c.json({ ok: true, status: 'healthy', db: 'connected' })
  } catch (e) {
    return c.json({ ok: false, status: 'degraded' }, 503)
  }
})

// GET /pod/:filename — sirve las fotos de comprobante de entrega guardadas por
// POST /api/delivery/assignments/:id/pod (gap crítico, ver ese endpoint más
// abajo para el contexto completo de por qué vive en disco local de la API en
// vez de R2/apps-web-public). Deliberadamente fuera de /api/* (una imagen en
// <img src> no necesita CORS) y sin sesión (mismo criterio de "URL
// impredecible = suficiente" que el token de 16 chars del PDF de boleta en
// R2 — el nombre de archivo incluye el uuid del assignment + timestamp, no es
// enumerable). `filename` se sanitiza a solo el basename para bloquear path
// traversal (../../etc) antes de tocar el filesystem.
app.get('/pod/:filename', async (c) => {
  const filename = path.basename(c.req.param('filename'))
  const filePath = path.join(POD_UPLOAD_DIR, filename)
  try {
    if (!filePath.startsWith(POD_UPLOAD_DIR) || !fs.existsSync(filePath)) {
      return c.json({ error: 'No encontrado' }, 404)
    }
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filename).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    return c.body(buf, 200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' })
  } catch (err) {
    console.error('Serve POD photo error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /product-photos/:filename — sirve las fotos de producto subidas por
// POST /api/products/:productId/images (adición post-entrega, 2-sep-2026).
// Mismo patrón exacto que GET /pod/:filename de arriba: fuera de /api/* (un
// <img src> no necesita CORS), sin sesión (el nombre de archivo incluye
// productId + timestamp + random, no es enumerable — mismo criterio de
// "URL impredecible = suficiente" del resto del sistema), y `filename`
// saneado a solo el basename para bloquear path traversal.
app.get('/product-photos/:filename', async (c) => {
  const filename = path.basename(c.req.param('filename'))
  const filePath = path.join(PRODUCT_UPLOAD_DIR, filename)
  try {
    if (!filePath.startsWith(PRODUCT_UPLOAD_DIR) || !fs.existsSync(filePath)) {
      return c.json({ error: 'No encontrado' }, 404)
    }
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filename).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.avif' ? 'image/avif' : 'image/jpeg'
    return c.body(buf, 200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' })
  } catch (err) {
    console.error('Serve product photo error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /b2b-docs/:filename — sirve los documentos de respaldo subidos por
// POST /api/b2b/credit-requests/:id/documents (adición post-entrega, flujo de
// aprobación de crédito B2B). A diferencia de /pod y /product-photos de
// arriba, ESTA ruta NO es pública sin sesión — son documentos financieros/de
// identidad de una empresa (cédula/RUT, respaldo financiero), un nombre de
// archivo no-enumerable no es suficiente criterio de privacidad acá. Se
// resuelve el dueño real del archivo (b2b_credit_documents → request →
// company) y se exige que quien pide el archivo sea: (a) staff owner/admin,
// o (b) la propia empresa B2B dueña de la solicitud (sesión de cliente).
app.get('/b2b-docs/:filename', async (c) => {
  const filename = path.basename(c.req.param('filename'))

  const [doc] = await sql`
    SELECT d.filename, d.original_name, cr.company_id
    FROM b2b_credit_documents d
    JOIN b2b_credit_requests cr ON cr.id = d.request_id
    WHERE d.filename = ${filename}
    LIMIT 1
  `
  if (!doc) return c.json({ error: 'No encontrado' }, 404)

  const staffUser = await getOptionalSession(c)
  const isStaffAllowed = staffUser && ['owner', 'admin'].includes(staffUser.role)
  let isOwningCompany = false
  if (!isStaffAllowed) {
    const customer = await getOptionalCustomerSession(c)
    if (customer) {
      const [comp] = await sql`SELECT id FROM b2b_companies WHERE id = ${doc.company_id} AND customer_id = ${customer.customerId}`
      isOwningCompany = !!comp
    }
  }
  if (!isStaffAllowed && !isOwningCompany) {
    return c.json({ error: 'No autorizado' }, 403)
  }

  const filePath = path.join(B2B_DOC_UPLOAD_DIR, filename)
  try {
    if (!filePath.startsWith(B2B_DOC_UPLOAD_DIR) || !fs.existsSync(filePath)) {
      return c.json({ error: 'No encontrado' }, 404)
    }
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filename).toLowerCase()
    const contentType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : '.jpg' === ext || '.jpeg' === ext ? 'image/jpeg' : 'application/octet-stream'
    return c.body(buf, 200, {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${(doc.original_name || filename).replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    })
  } catch (err) {
    console.error('Serve B2B credit doc error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// DIAGNOSTIC - Simple test without DB dependency
app.get('/diagnostic', (c) => {
  return c.json({
    timestamp: new Date().toISOString(),
    service: 'SEUL KING OS API v1.0',
    status: 'online',
    cors: 'enabled',
    testUser: 'founder@seoulshop.cl',
    fallbackAuth: 'available',
    message: 'API is responding. If login fails, it\'s a database issue, not connectivity.'
  })
})

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

// Auto-run migrations on startup
async function runMigrationsIfNeeded() {
  try {
    // Check if must_change_password column exists
    const result = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'must_change_password'
    `

    if (result.length === 0) {
      console.log('🔄 Running migration 0014...')

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true
      `
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP
      `
      await sql`
        CREATE TABLE IF NOT EXISTS staff_password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS staff_pwd_reset_user_idx ON staff_password_reset_tokens(user_id)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS staff_pwd_reset_token_idx ON staff_password_reset_tokens(token)
      `
      console.log('✅ Migration 0014 applied')
    }

    // 0015: Rate limiting table
    const rateLimitTableExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'login_attempts' AND column_name = 'email'
    `

    if (rateLimitTableExists.length === 0) {
      console.log('🔄 Running migration 0015 (rate limiting)...')

      await sql`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          success BOOLEAN NOT NULL,
          attempted_at TIMESTAMP DEFAULT NOW(),
          ip_address VARCHAR(45),
          user_agent TEXT
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts(email, attempted_at DESC)
      `
      console.log('✅ Migration 0015 applied')
    }

    // 0016: Generic rate limiting table (S02, bloqueador P0 #3) — same pattern as
    // login_attempts (0015) above, generalized to (bucket_key, action) pairs so any
    // write endpoint can rate-limit per user-or-IP without a KV/Redis dependency.
    const genericRateLimitTableExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'rate_limit_events' AND column_name = 'bucket_key'
    `

    if (genericRateLimitTableExists.length === 0) {
      console.log('🔄 Running migration 0016 (generic rate limiter)...')

      await sql`
        CREATE TABLE IF NOT EXISTS rate_limit_events (
          id SERIAL PRIMARY KEY,
          bucket_key VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS rate_limit_events_bucket_idx
        ON rate_limit_events(bucket_key, action, created_at DESC)
      `
      console.log('✅ Migration 0016 applied')
    }

    // 0017 (S13, Fase 4): arcop_requests.name/email — la tabla ya existía
    // (customer_id, type, status, notes, deadline) pero una solicitud ARCOP
    // puede venir de una persona SIN cuenta (Ley 21.719 exige poder ejercer
    // el derecho sin ser cliente), así que necesitamos guardar su nombre y
    // correo de contacto directamente, no solo enlazarla a un customer_id
    // opcional que puede quedar null.
    const arcopNameExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'arcop_requests' AND column_name = 'name'
    `
    if (arcopNameExists.length === 0) {
      console.log('🔄 Running migration 0017 (arcop_requests.name/email)...')
      await sql`ALTER TABLE arcop_requests ADD COLUMN IF NOT EXISTS name TEXT`
      await sql`ALTER TABLE arcop_requests ADD COLUMN IF NOT EXISTS email TEXT`
      console.log('✅ Migration 0017 applied')
    }

    // 0018 (S14, Fase 4): faq_entries — la tabla YA existía en producción
    // (creada por un `drizzle push` completo del schema en algún momento
    // anterior a esta sesión, confirmado con information_schema antes de
    // escribir esto: columnas idénticas a packages/db/src/schema/faq.ts,
    // incluyendo el default `gen_random_uuid()`) pero vacía (0 filas) y sin
    // ningún endpoint que la sirviera. apps/web/.../faq/page.tsx ya hace fetch
    // a GET /api/faq con fallback silencioso a un FAQ estático (STATIC_FAQ) si
    // el endpoint 404-ea o devuelve 0 entries — así que se siembra la tabla
    // con ese mismo contenido la primera vez que arranca con la tabla vacía,
    // para que el dueño tenga algo real y editable desde el día uno en vez de
    // quedarse indefinidamente en el fallback estático. `CREATE TABLE IF NOT
    // EXISTS` se mantiene por si esto corre contra un ambiente donde la tabla
    // de verdad no existe todavía (ej. una DB de desarrollo nueva).
    await sql`
      CREATE TABLE IF NOT EXISTS faq_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_es TEXT NOT NULL,
        question_ko TEXT,
        question_en TEXT,
        answer_es TEXT NOT NULL,
        answer_ko TEXT,
        answer_en TEXT,
        category TEXT NOT NULL DEFAULT 'general',
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS faq_entries_category_idx ON faq_entries(category, sort_order)`

    const [faqCount] = await sql`SELECT count(*)::int AS n FROM faq_entries`
    if (faqCount.n === 0) {
      console.log('🔄 Running migration 0018 (seed faq_entries)...')

      const seed: Array<{ q: string; a: string; cat: string }> = [
        { cat: 'Pedidos', q: '¿Cómo puedo hacer un pedido?', a: 'Puedes pedir directamente en nuestra tienda online, seleccionando tus productos y eligiendo el método de entrega. Si tienes dudas, escríbenos a contacto@seoulshop.cl y te ayudamos a gestionar tu pedido.' },
        { cat: 'Pedidos', q: '¿Puedo modificar o cancelar un pedido?', a: 'Puedes modificar o cancelar tu pedido dentro de los 30 minutos siguientes a su confirmación. Pasado ese plazo, el pedido ya está en preparación y no es posible hacer cambios.' },
        { cat: 'Envíos', q: '¿Cuáles son los métodos de entrega?', a: 'Ofrecemos: (1) Retiro gratis en Estación Miramar del Merval, (2) Retiro en tienda, (3) Despacho por Chilexpress para el resto de Chile (solo productos sin cadena de frío). El delivery express está temporalmente no disponible.' },
        { cat: 'Envíos', q: '¿Despachan productos congelados o refrigerados a regiones?', a: 'No. Los productos con cadena de frío (congelados y refrigerados) solo se pueden retirar en tienda o por retiro en Estación Merval, dentro de la zona de cobertura del Gran Valparaíso. Esto es para garantizar la calidad del producto.' },
        { cat: 'Productos', q: '¿Son productos originales de Corea?', a: 'Sí. Todos nuestros productos son importados directamente desde Corea del Sur, con sus respectivos registros sanitarios en Chile. Vendemos marcas reconocidas como Nongshim, Ottogi, Samyang, CJ, Lotte y muchas más.' },
        { cat: 'Productos', q: '¿Tienen productos veganos o sin gluten?', a: 'Tenemos algunos productos aptos para dietas veganas o sin gluten. Filtra por alérgenos en nuestra tienda o escríbenos por correo para orientarte según tus necesidades.' },
        { cat: 'Pagos', q: '¿Qué medios de pago aceptan?', a: 'Aceptamos tarjetas de débito y crédito (Visa, Mastercard, American Express), transferencia bancaria y pago en efectivo al retirar en tienda. Para pedidos Rappi, el pago se gestiona directamente en la app.' },
        { cat: 'Pagos', q: '¿Puedo usar tarjeta JUNAEB (TNE)?', a: 'Sí, en nuestra tienda física (POS). Los productos elegibles BAES están marcados. El sistema valida automáticamente los montos aplicables al subsidio JUNAEB.' },
        { cat: 'Privacidad', q: '¿Cómo protegen mis datos personales?', a: 'Cumplimos con la Ley 21.719 de Protección de Datos Personales de Chile. Tus datos se utilizan exclusivamente para gestionar tus pedidos y, si diste tu consentimiento, para enviarte comunicaciones de marketing. Puedes ejercer tus derechos de acceso, rectificación y supresión en cualquier momento desde tu cuenta o enviando un correo a contacto@seoulshop.cl.' },
        { cat: 'Privacidad', q: '¿Cómo puedo eliminar mi cuenta?', a: 'Puedes solicitar la eliminación de tu cuenta desde tu perfil en "Mi Cuenta". Tu información se anonimizará en un plazo de 15 días hábiles, conservando solo los registros contables obligatorios por ley.' },
        { cat: 'Devoluciones', q: '¿Cuál es la política de devoluciones?', a: 'Aceptamos devoluciones dentro de los 10 días hábiles desde la recepción del producto, siempre que esté en su estado original y sellado. Productos perecederos o refrigerados no tienen devolución salvo defecto de fábrica. Inicia tu solicitud en /devoluciones.' },
        { cat: 'Devoluciones', q: '¿Qué hago si recibí un producto en mal estado?', a: 'Toma fotos del producto y del embalaje, y contáctanos en las primeras 24 horas a contacto@seoulshop.cl. Te reponemos el producto o te hacemos el reembolso total según prefieras.' },
      ]
      for (let i = 0; i < seed.length; i++) {
        const e = seed[i]
        await sql`
          INSERT INTO faq_entries (question_es, answer_es, category, sort_order)
          VALUES (${e.q}, ${e.a}, ${e.cat}, ${i})
        `
      }
      console.log(`✅ Migration 0018 applied (${seed.length} FAQ entries seeded)`)
    }

    // 0019 (S16, Fase 5 — Hardening): audit_log — registro de acciones
    // administrativas sensibles (crear/editar/desactivar usuario, cambio de
    // contraseña, cambios de configuración de tienda). Mismo patrón auto-run
    // que 0014-0018. `entity_id` es TEXT (no UUID) a propósito: no todas las
    // entidades auditadas usan uuid como PK (ej. tienda_config.key es texto).
    const auditLogTableExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'audit_log' AND column_name = 'action'
    `
    if (auditLogTableExists.length === 0) {
      console.log('🔄 Running migration 0019 (audit_log)...')
      await sql`
        CREATE TABLE IF NOT EXISTS audit_log (
          id SERIAL PRIMARY KEY,
          actor_user_id UUID,
          actor_email VARCHAR(255),
          actor_role VARCHAR(50),
          action VARCHAR(100) NOT NULL,
          entity_table VARCHAR(100),
          entity_id TEXT,
          details JSONB,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC)`
      await sql`CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_user_id, created_at DESC)`
      await sql`CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action, created_at DESC)`
      console.log('✅ Migration 0019 applied')
    }

    // 0020 (gap crítico — anular venta en POS): orders.voided_by/voided_at/
    // void_reason y la tabla pos_void_events ya están modeladas en
    // packages/db/src/schema (orders.ts, pos-void-events.ts) y en el archivo
    // de migración 0005_lyrical_nehzno.sql del repo — pero, igual que
    // faq_entries en 0018, no hay garantía de que ese .sql se haya aplicado
    // alguna vez contra la Neon de producción real (varias tablas de este
    // proyecto llegaron a producción por un `drizzle push` suelto, no por
    // estos archivos). Mismo patrón defensivo IF NOT EXISTS que 0014-0019:
    // no-op si ya existen, crea lo que falte si no.
    const voidColsExist = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'void_reason'
    `
    if (voidColsExist.length === 0) {
      console.log('🔄 Running migration 0020a (orders void columns)...')
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES users(id)`
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_at timestamp`
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_reason text`
      console.log('✅ Migration 0020a applied')
    }

    const posVoidEventsExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'pos_void_events' AND column_name = 'amount_clp'
    `
    if (posVoidEventsExists.length === 0) {
      console.log('🔄 Running migration 0020b (pos_void_events)...')
      await sql`
        CREATE TABLE IF NOT EXISTS pos_void_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL REFERENCES orders(id),
          voided_by UUID NOT NULL REFERENCES users(id),
          reason TEXT NOT NULL,
          amount_clp INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      console.log('✅ Migration 0020b applied')
    }

    // 0021 (adición post-entrega — flujo de pago para pedidos web): hoy un
    // pedido web (channel='web', creado por POST /api/public/orders) queda
    // en status='nueva' sin ninguna coordinación de pago — no hay forma de
    // saber si el cliente ya pagó por transferencia o si el repartidor debe
    // cobrar en la puerta. orders.status (order_status enum) es un concepto
    // de FLUJO DE PREPARACIÓN (nueva/preparando/lista/en_ruta/entregada/
    // cancelada) — mezclar el estado de pago ahí sería incorrecto (una orden
    // puede estar "preparando" y aun así no tener el pago confirmado).
    // payment_status es un campo separado a propósito.
    //
    // Valores: 'pending' (default — pedido web recién creado, sin
    // coordinar) | 'confirmed' (pago por transferencia confirmado por staff,
    // O método de cobro en la puerta ya definido — ver POST
    // /api/orders/:id/confirm-payment más abajo). Los pedidos de POS
    // (channel='pos') se insertan con payment_status='confirmed' desde el
    // momento de creación porque el pago ya se cobró en caja (order_payments
    // ya tiene el/los tenders) — no hay nada que coordinar después. B2B no
    // inserta en `orders` directamente (usa b2b_quotes/wallet), así que no le
    // afecta esta columna.
    //
    // payment_method (solo canal web): 'transferencia' | 'efectivo' |
    // 'transbank' — moneda de decisión del staff al confirmar, independiente
    // de delivery_assignments.payment_method (que ya existe desde S07 pero
    // solo aplica cuando SÍ hay una asignación de repartidor; un pedido
    // 'pickup' o 'metro' no tiene delivery_assignment pero igual necesita
    // saber cómo se va a cobrar).
    const paymentStatusExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'payment_status'
    `
    if (paymentStatusExists.length === 0) {
      console.log('🔄 Running migration 0021 (orders.payment_status — flujo de pago web)...')
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'`
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT`
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP`
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES users(id)`
      // Pedidos ya existentes de canal 'pos' se consideran pagados retroactivamente
      // (siempre se cobraron en caja al crear la venta) — solo 'web' se queda 'pending'.
      await sql`UPDATE orders SET payment_status = 'confirmed' WHERE channel = 'pos' AND payment_status = 'pending'`
      await sql`CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status) WHERE payment_status = 'pending'`
      console.log('✅ Migration 0021 applied')
    }

    // 0022 (adición post-entrega — flujo de aprobación de crédito B2B +
    // consolidación de inventario dentro de Editar Producto, pedido explícito
    // del dueño, 2-sep-2026):
    //
    // 1. b2b_credit_requests gana `approved_amount_clp` (el ejecutivo puede
    //    aprobar un monto DISTINTO al solicitado, no solo aceptar/rechazar el
    //    monto pedido tal cual — requisito explícito del dueño) y
    //    `commission_pct`/`commission_clp` (comisión calculada al momento de
    //    aprobar, snapshot del % vigente en tienda_config para no cambiar
    //    retroactivamente si el % default se edita después).
    // 2. b2b_credit_documents (tabla nueva) — 1+ documentos de respaldo
    //    (cédula/RUT empresa, respaldo financiero) asociados a una solicitud
    //    de crédito, mismo patrón pragmático de disco local que
    //    product_images/pod (sin R2 configurado).
    // 3. orders.company_id — venta presencial B2B en POS: permite asociar una
    //    venta al RUT/empresa correspondiente sin inventar un canal nuevo
    //    (channel sigue 'pos' — la plata entra por caja igual que cualquier
    //    venta de mostrador; company_id es el diferenciador para reportes y
    //    para cuando se conecte el SII real, decidir boleta vs factura).
    const b2bCreditColsExist = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'b2b_credit_requests' AND column_name = 'approved_amount_clp'
    `
    if (b2bCreditColsExist.length === 0) {
      console.log('🔄 Running migration 0022a (b2b_credit_requests approved/commission cols)...')
      await sql`ALTER TABLE b2b_credit_requests ADD COLUMN IF NOT EXISTS approved_amount_clp INTEGER`
      await sql`ALTER TABLE b2b_credit_requests ADD COLUMN IF NOT EXISTS commission_pct DECIMAL(5,2)`
      await sql`ALTER TABLE b2b_credit_requests ADD COLUMN IF NOT EXISTS commission_clp INTEGER`
      console.log('✅ Migration 0022a applied')
    }

    const b2bCreditDocsExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'b2b_credit_documents' AND column_name = 'filename'
    `
    if (b2bCreditDocsExists.length === 0) {
      console.log('🔄 Running migration 0022b (b2b_credit_documents)...')
      await sql`
        CREATE TABLE IF NOT EXISTS b2b_credit_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          request_id UUID NOT NULL REFERENCES b2b_credit_requests(id),
          filename TEXT NOT NULL,
          original_name TEXT,
          uploaded_by UUID REFERENCES users(id),
          uploaded_at TIMESTAMP DEFAULT NOW()
        )
      `
      console.log('✅ Migration 0022b applied')
    }

    const ordersCompanyIdExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'company_id'
    `
    if (ordersCompanyIdExists.length === 0) {
      console.log('🔄 Running migration 0022c (orders.company_id — venta B2B en POS)...')
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES b2b_companies(id)`
      await sql`CREATE INDEX IF NOT EXISTS orders_company_id_idx ON orders(company_id) WHERE company_id IS NOT NULL`
      console.log('✅ Migration 0022c applied')
    }

    // 0023 (adición post-entrega — conectar el pedido B2B de punta a punta,
    // 2-sep-2026): 1) orders.ready_at — "marcar listo para retirar" para
    // pickup/metro (aplica a cualquier canal, no solo B2B). 2)
    // b2b_credit_movements — trazabilidad de compras cargadas a la línea de
    // crédito B2B (orders.company_id + confirm-payment método 'credito_b2b').
    // Deliberadamente NO se reutiliza b2b_wallet_ledger: esa tabla trackea
    // wallet_balance_clp (saldo prepago) via su columna balance_after
    // NOT NULL — una compra a crédito no toca el wallet, mezclar los dos
    // conceptos ahí corrompería el significado de balance_after.
    const ordersReadyAtExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'ready_at'
    `
    if (ordersReadyAtExists.length === 0) {
      console.log('🔄 Running migration 0023a (orders.ready_at)...')
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP`
      console.log('✅ Migration 0023a applied')
    }

    const b2bCreditMovementsExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'b2b_credit_movements' AND column_name = 'id'
    `
    if (b2bCreditMovementsExists.length === 0) {
      console.log('🔄 Running migration 0023b (b2b_credit_movements)...')
      await sql`
        CREATE TABLE IF NOT EXISTS b2b_credit_movements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL REFERENCES b2b_companies(id),
          order_id UUID REFERENCES orders(id),
          amount_clp INTEGER NOT NULL,
          credit_used_after_clp INTEGER NOT NULL,
          notes TEXT,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      console.log('✅ Migration 0023b applied')
    }

    // 0024 (adición post-entrega, 3-sep-2026 — respuesta al mensaje largo del
    // dueño): a) orders.delivery_date — fecha del retiro Metro, separada de
    // metro_slot (que es solo la franja horaria, sin día). b)
    // b2b_postventa_requests — la pantalla de postventa B2B nunca guardaba
    // nada, solo abría un link de WhatsApp con el mensaje armado (cero
    // persistencia); ahora se guarda de verdad y se avisa al staff por correo.
    const ordersDeliveryDateExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'delivery_date'
    `
    if (ordersDeliveryDateExists.length === 0) {
      console.log('🔄 Running migration 0024a (orders.delivery_date)...')
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE`
      console.log('✅ Migration 0024a applied')
    }

    const b2bPostventaExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'b2b_postventa_requests' AND column_name = 'id'
    `
    if (b2bPostventaExists.length === 0) {
      console.log('🔄 Running migration 0024b (b2b_postventa_requests)...')
      await sql`
        CREATE TABLE IF NOT EXISTS b2b_postventa_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL REFERENCES b2b_companies(id),
          issue_type TEXT NOT NULL,
          order_number TEXT,
          description TEXT NOT NULL,
          contact_phone TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      console.log('✅ Migration 0024b applied')
    }

    // 0024c — orders.delivery_comuna (adición post-entrega, 3-sep-2026): el
    // dueño pidió que la dirección de entrega del POS fuera "más específica
    // por región zona" — antes era un solo campo de texto libre donde la
    // comuna se aplastaba junto con la calle. La modal ahora pide calle y
    // comuna por separado; delivery_address sigue concatenado (no rompe
    // nada que ya lo lea como texto completo) y esta columna nueva guarda
    // la comuna estructurada, disponible para reportes/filtros futuros.
    const ordersDeliveryComunaExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'delivery_comuna'
    `
    if (ordersDeliveryComunaExists.length === 0) {
      console.log('🔄 Running migration 0024c (orders.delivery_comuna)...')
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_comuna TEXT`
      console.log('✅ Migration 0024c applied')
    }

    // 0025 — driver_shifts (adición post-entrega, 3-sep-2026): el dueño pidió
    // que la asignación de repartidor al marcar un pedido "listo" sea
    // automática, según quién esté ACTIVO en su turno — no todos los
    // repartidores trabajan siempre. No existía ningún concepto de turno para
    // repartidores (la tabla `shifts` es exclusivamente caja de POS, con
    // arqueo y deviceId — no aplica acá). Mismo patrón open/closed que
    // `shifts`, sin arqueo (el cobro en puerta ya se trackea por pedido en
    // delivery_assignments.amount_to_collect, no por turno).
    const driverShiftsExists = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'driver_shifts'
    `
    if (driverShiftsExists.length === 0) {
      console.log('🔄 Running migration 0025 (driver_shifts)...')
      await sql`
        CREATE TABLE IF NOT EXISTS driver_shifts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          driver_id UUID NOT NULL REFERENCES users(id),
          status TEXT NOT NULL DEFAULT 'open',
          opened_at TIMESTAMP DEFAULT NOW(),
          closed_at TIMESTAMP
        )
      `
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS driver_shifts_driver_active_uniq
          ON driver_shifts (driver_id) WHERE status = 'open'
      `
      console.log('✅ Migration 0025 applied')
    }

    // 0026 — delivery_assignments.driver_shift_id (adición post-entrega,
    // 3-sep-2026): vínculo explícito al turno vigente al momento de asignar
    // — mismo criterio que orders.shiftId en POS (FK explícita, no inferida
    // por rango de fechas). Es lo que permite armar el resumen de cobros por
    // turno en GET /api/delivery/shifts sin adivinar qué entregas cayeron
    // dentro de qué turno.
    const driverShiftIdExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'delivery_assignments' AND column_name = 'driver_shift_id'
    `
    if (driverShiftIdExists.length === 0) {
      console.log('🔄 Running migration 0026 (delivery_assignments.driver_shift_id)...')
      await sql`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS driver_shift_id UUID REFERENCES driver_shifts(id)`
      console.log('✅ Migration 0026 applied')
    }
  } catch (e) {
    console.warn('⚠️  Migration check failed (OK if already applied):', e)
  }
}

// Auto-seed real users - IDEMPOTENT: only create + email users that don't exist yet.
// IMPORTANT: Once a user exists, redeploys must NOT touch their password.
// Recreating on every startup invalidates credentials the user already received by email.
// REMOVED (S17, 2-sep-2026 — hallazgo crítico de la sesión de entrega):
// `seedRealUsersIfNeeded()` recreaba en CADA arranque del servidor (cada redeploy de
// Railway) 3 cuentas de staff hardcodeadas, incluyendo `marioulloa22@verticeproductions.com`
// y `jorgefuenmayor.ccn@gmail.com` — las mismas 2 cuentas de prueba que esta sesión eliminó
// explícitamente por instrucción del dueño ("dejar un solo usuario de staff activo:
// ceojorge@verticeproductions.com"). Confirmado en vivo durante esta sesión: se eliminaron
// ambas cuentas, un redeploy de Railway (disparado por un cambio no relacionado en
// `apps/web`) volvió a arrancar el proceso, `seedRealUsersIfNeeded()` las encontró
// "faltantes" y las recreó con contraseña temporal nueva — incluyendo un email de
// bienvenida real reenviado a `jorgefuenmayor.ccn@gmail.com`. Sin quitar esta función,
// la limpieza de usuarios de esta sesión se habría revertido sola en el próximo deploy.
// Si en el futuro se necesita un seed de usuarios de desarrollo, debe gatearse por
// `ENVIRONMENT !== 'production'` (mismo patrón que `/api/admin/seed/users`) — nunca
// correr incondicionalmente contra la base de datos de producción.

// DEPRECATED: Hardcoded test users removed for security
// If DB fails, login fails - no fallback authentication (correct behavior)
// Use seedRealUsersIfNeeded() instead to create test users

// Rate limiting helper: check if user is blocked
async function checkRateLimit(email: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    // Get last 5 login attempts in last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    const attempts = await sql`
      SELECT success FROM login_attempts
      WHERE email = ${email} AND attempted_at > ${fifteenMinutesAgo}
      ORDER BY attempted_at DESC LIMIT 5
    `

    // Block if 5+ failed attempts
    const failedCount = attempts.filter((a: any) => !a.success).length
    if (failedCount >= 5) {
      return { allowed: false, retryAfter: 15 }
    }

    return { allowed: true }
  } catch (e) {
    // If rate limit table doesn't exist yet, allow login
    return { allowed: true }
  }
}

// Generic rate limiter (S02, bloqueador P0 #3 — replaces the KV-store TODO at
// auth.middleware.ts:160 with the same Postgres pattern as checkRateLimit/
// recordLoginAttempt above, generalized to any (bucket, action) pair). No new
// dependency (no Redis/Upstash/KV) — reuses the `sql` tag already in scope and
// the `rate_limit_events` table created by migration 0016.
//
// Identifier precedence: explicit `identifier` param (e.g. an authenticated
// user's id) > JWT session set by requireAuthMiddleware (c.get('user')) >
// API-key auth set by the same middleware (c.get('auth').userId) > client IP.
// Fails OPEN on DB error, matching checkRateLimit's posture — a rate-limit
// outage must never block legitimate traffic.
async function checkAndRecordRateLimit(
  c: any,
  action: string,
  opts: { limit: number; windowMinutes: number },
  identifier?: string
): Promise<{ allowed: boolean; retryAfterMinutes?: number }> {
  try {
    const jwtUser = c.get('user')
    const apiKeyAuth = c.get('auth')
    const bucketKey =
      identifier ||
      jwtUser?.id ||
      apiKeyAuth?.userId ||
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for') ||
      'unknown'

    const windowStart = new Date(Date.now() - opts.windowMinutes * 60 * 1000)
    const rows = await sql`
      SELECT count(*) AS n FROM rate_limit_events
      WHERE bucket_key = ${bucketKey} AND action = ${action} AND created_at > ${windowStart}
    `
    const count = Number(rows[0]?.n ?? 0)
    if (count >= opts.limit) {
      return { allowed: false, retryAfterMinutes: opts.windowMinutes }
    }

    await sql`INSERT INTO rate_limit_events (bucket_key, action) VALUES (${bucketKey}, ${action})`
    return { allowed: true }
  } catch (e) {
    // If the table doesn't exist yet (migration race) or DB hiccups, allow the request.
    return { allowed: true }
  }
}

// recordAuditLog (S16, Fase 5 — Hardening) — registro de auditoría para
// acciones administrativas sensibles (tabla audit_log, migración 0019).
// Fail-open: un fallo de auditoría (ej. tabla no migrada todavía) NUNCA
// bloquea la acción real, mismo criterio que checkAndRecordRateLimit/
// recordLoginAttempt arriba.
//
// IMPORTANTE — `details` se pasa como objeto JS DIRECTO al tagged template
// `sql`, nunca `JSON.stringify(details)`. postgres.js serializa el objeto a
// jsonb por sí solo; hacer JSON.stringify a mano produce un string JSON
// doble-encodeado dentro de la columna (bug real ya encontrado y corregido
// una vez en este proyecto — ver nota en el plan maestro, sección S16).
async function recordAuditLog(
  c: any,
  actor: { id: string; email: string; role: string },
  action: string,
  entity: { table: string; id: string | null },
  details?: Record<string, any> | null
) {
  try {
    await sql`
      INSERT INTO audit_log (actor_user_id, actor_email, actor_role, action, entity_table, entity_id, details, ip_address, user_agent)
      VALUES (
        ${actor.id}, ${actor.email}, ${actor.role}, ${action},
        ${entity.table}, ${entity.id},
        ${details ?? null},
        ${c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null},
        ${c.req.header('user-agent') || null}
      )
    `
  } catch (e) {
    console.warn('⚠️  Audit log insert failed (action was NOT blocked):', e)
  }
}

// Record login attempt
async function recordLoginAttempt(email: string, success: boolean, c: any) {
  try {
    await sql`
      INSERT INTO login_attempts (email, success, ip_address, user_agent)
      VALUES (${email}, ${success}, ${c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip')}, ${c.req.header('user-agent')})
    `
  } catch (e) {
    // Silently fail - don't break login if logging fails
  }
}

// AUTH LOGIN HANDLER (shared by both /auth/login and /api/auth/login)
async function handleLogin(c: any) {
  let body: any = {}
  let email: string = ''
  let password: string = ''

  try {
    const text = await c.req.text()
    body = JSON.parse(text)
    email = (body.email || '').toLowerCase()
    password = body.password || ''
  } catch (e) {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (!email || !password) {
    return c.json({ error: 'Missing email or password' }, 400)
  }

  // Check rate limiting
  const rateLimit = await checkRateLimit(email)
  if (!rateLimit.allowed) {
    await recordLoginAttempt(email, false, c)
    return c.json({ error: `Too many failed attempts. Try again in ${rateLimit.retryAfter} minutes.` }, 429)
  }

  // Authenticate against database only - no fallback
  const result = await AuthService.login(email, password, JWT_SECRET)

  // Record attempt (success or failure)
  await recordLoginAttempt(email, result.ok, c)

  if (!result.ok) {
    return c.json({ error: result.error || 'Invalid credentials' }, result.status || 401)
  }

  // Obtener must_change_password de la BD
  let mustChangePassword = false
  try {
    const userRows = await sql`
      SELECT must_change_password FROM users WHERE email = ${email}
    `
    if (userRows && userRows.length > 0) {
      mustChangePassword = userRows[0].must_change_password || false
    }
  } catch (e) {
    // Si falla, asumir false
    mustChangePassword = false
  }

  // Setear cookie de sesión (httpOnly, Secure, SameSite=Lax, compartida en *.seoulshop.cl)
  setCookie(c, SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 604800, // 7 days
    domain: sessionCookieDomain(c),
  })

  const response = c.json({
    ...result,
    mustChangePassword,
  })

  // CORS headers: reflect origin if in whitelist, else use first origin
  const origin = c.req.header('Origin') || 'https://cmr.seoulshop.cl'
  const allowedOrigins = [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
    'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
    'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl',
    'https://seul-kims-shop.vercel.app',
  ]
  const responseOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[3]
  response.headers.set('Access-Control-Allow-Origin', responseOrigin)
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')

  return response
}

// Register both routes (backward compatibility + NextJS apps)
app.post('/auth/login', handleLogin)
app.post('/api/auth/login', handleLogin)

// OPTIONS preflight (both routes) — MUST reflect real origin, not '*',
// because the login fetch uses credentials: 'include'. Per CORS spec,
// Allow-Origin: '*' combined with credentials is rejected by browsers,
// causing the fetch to fail silently (or hang) before the POST is even sent.
const ALLOWED_ORIGINS = [
  'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003',
  'https://seoulshop.cl', 'https://shop.seoulshop.cl', 'https://pos.seoulshop.cl',
  'https://cmr.seoulshop.cl', 'https://drive.seoulshop.cl',
  'https://seul-kims-shop.vercel.app',
]
function loginPreflightHeaders(c: any) {
  const origin = c.req.header('Origin')
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[7]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}
app.options('/auth/login', (c) => c.json(null, 200, loginPreflightHeaders(c)))
app.options('/api/auth/login', (c) => c.json(null, 200, loginPreflightHeaders(c)))

// GET /auth/me y /api/auth/me — Get current user
async function handleGetMe(c: any) {
  // Try Authorization header first, then fallback to cookie
  let token: string | undefined
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = getCookie(c, SESSION_COOKIE_NAME)
  }

  if (!token) {
    return c.json({ error: 'Missing token' }, 401)
  }

  const verified = AuthService.verifyToken(token, JWT_SECRET)

  if (!verified.ok) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  const decoded = verified.decoded as any
  return c.json({
    user: {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    }
  })
}

app.get('/auth/me', handleGetMe)
app.get('/api/auth/me', handleGetMe)

// POST /auth/logout y /api/auth/logout
async function handleLogout(c: any) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    domain: sessionCookieDomain(c),
  })
  const response = c.json({ ok: true })
  const origin = c.req.header('Origin')
  response.headers.set('Access-Control-Allow-Origin', origin || 'https://cmr.seoulshop.cl')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

app.post('/auth/logout', handleLogout)
app.post('/api/auth/logout', handleLogout)

// POST /api/auth/change-password — Cambiar contraseña (autenticado, primer-login obligatorio)
async function handleChangePassword(c: any) {
  // 1. Verificar autenticación
  let token: string | undefined
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = getCookie(c, SESSION_COOKIE_NAME)
  }

  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  const verified = AuthService.verifyToken(token, JWT_SECRET)
  if (!verified.ok) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  const decoded = verified.decoded as any
  const userId = decoded.email // Usamos email como ID

  // 2. Parsear body
  let body: any = {}
  try {
    const text = await c.req.text()
    body = JSON.parse(text)
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { oldPassword, newPassword, confirmPassword } = body
  if (!oldPassword || !newPassword || !confirmPassword) {
    return c.json({ error: 'Missing password fields' }, 400)
  }

  if (newPassword !== confirmPassword) {
    return c.json({ error: 'Passwords do not match' }, 400)
  }

  // 3. Validar complejidad de nueva contraseña (mín. 8 chars, 1 mayúscula, 1 número)
  if (newPassword.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }
  if (!/[A-Z]/.test(newPassword)) {
    return c.json({ error: 'Password must contain uppercase letter' }, 400)
  }
  if (!/[0-9]/.test(newPassword)) {
    return c.json({ error: 'Password must contain number' }, 400)
  }

  try {
    // 4. Obtener usuario y verificar contraseña anterior
    const rows = await sql`
      SELECT id, password_hash, email, name FROM users WHERE email = ${userId}
    `

    if (!rows || rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const user = rows[0]
    const isOldPasswordValid = PasswordService.verifyPassword(oldPassword, user.password_hash)

    if (!isOldPasswordValid) {
      return c.json({ error: 'Current password is incorrect' }, 401)
    }

    // 5. Hashear nueva contraseña
    const newPasswordHash = PasswordService.hashPassword(newPassword)

    // 6. Actualizar en BD
    await sql`
      UPDATE users
      SET password_hash = ${newPasswordHash},
          password_changed_at = NOW(),
          must_change_password = false
      WHERE email = ${userId}
    `

    // 7. Enviar email de confirmación
    await enqueueEmail(
      user.email,
      '✅ Contraseña Cambiada con Éxito',
      templates.passwordChangedSuccess({
        name: user.name,
        email: user.email,
        timestamp: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })
      }),
      'password-reset'
    )

    // Audit log (S16, Fase 5 — Hardening) — siempre "propia" en este endpoint
    // (no existe hoy un flujo de "resetear contraseña de otro usuario" en el
    // backend; ver nota en el plan maestro, sección S16). Nunca se loggea la
    // contraseña ni su hash.
    await recordAuditLog(c, { id: user.id, email: decoded.email, role: decoded.role }, 'user.password_change_self', { table: 'users', id: user.id }, {
      targetEmail: user.email,
    })

    return c.json({
      ok: true,
      message: 'Password changed successfully. Confirmation email sent.',
      user: { email: user.email, name: user.name }
    })
  } catch (error: any) {
    console.error('❌ Error en change-password:', error)
    return c.json({ error: error.message || 'Failed to change password' }, 500)
  }
}

app.post('/api/auth/change-password', handleChangePassword)

// ============================================================================
// CUSTOMER AUTH ENDPOINTS (S09, Fase 3) — end customers (apps/web, tienda B2C
// y portal B2B comparten la misma tabla `customers` / mismo login, ver
// b2b/login/page.tsx). COMPLETAMENTE SEPARADO del auth de staff arriba: tabla
// distinta (`customers`, no `users`), cookie distinta (CUSTOMER_SESSION_COOKIE_NAME,
// no SESSION_COOKIE_NAME), secret de firma distinta (CUSTOMER_JWT_SECRET, ver
// db.ts), sin roles/RBAC (un cliente solo tiene "autenticado como este cliente
// o no"). No reutiliza AuthService.login (que consulta `users`) — lógica propia
// pero mismo servicio de hashing (PasswordService, PBKDF2-SHA256) y mismo
// verificador de token (AuthService.verifyToken, parametrizado con el secret
// distinto).
// ============================================================================

// Password complexity — misma regla que handleChangePassword (staff) arriba,
// duplicada intencionalmente (ese código tampoco la extrajo a helper) para no
// tocar el archivo de auth de staff.
function validateCustomerPasswordComplexity(password: string): string | null {
  if (!password || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula.'
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número.'
  return null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Validación de RUT chileno (dígito verificador) — usada por POST /api/b2b/registro
// (S11, Fase 3). El frontend (apps/web/.../b2b/registro/page.tsx, formatRUTInput)
// solo agrupa dígitos visualmente, no valida el DV — esta es la única validación
// real que existe hoy, igual que documenta CLAUDE.md ("validar dígito verificador
// en el frontend antes de enviar" — el frontend no lo hace, así que el backend
// es la línea de defensa real).
function isValidRUT(rutRaw: string): boolean {
  const clean = (rutRaw || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  if (!/^\d+$/.test(body)) return false
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const res = 11 - (sum % 11)
  const expectedDv = res === 11 ? '0' : res === 10 ? 'K' : String(res)
  return expectedDv === dv
}

function normalizeRUT(rutRaw: string): string {
  const clean = (rutRaw || '').replace(/[^0-9kK]/g, '').toUpperCase()
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${grouped}-${dv}`
}

// POST /api/customer/register — crea cuenta de cliente final. El formulario
// (apps/web/.../cuenta/registro/page.tsx) NO pide contraseña — igual que el
// onboarding de staff (seedRealUsersIfNeeded/initialCredentials arriba), se
// genera una contraseña temporal, se hashea, se envía por correo, y
// must_change_password queda en true para forzar el cambio en el primer login.
// Si el email ya existe como cliente "fantasma" (creado por POS/checkout de
// invitado, sin password_hash — customers.email es UNIQUE, así que un INSERT
// duplicado rompería la constraint), esta cuenta se "reclama": se actualiza esa
// misma fila en vez de crear una duplicada, preservando el historial de pedidos
// ya asociado a ese customer_id.
app.post('/api/customer/register', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const name = (body.name || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const marketingOptIn = !!body.marketingOptIn

  if (!name || !email) {
    return c.json({ ok: false, error: 'Nombre y correo son obligatorios.' }, 400)
  }
  if (!isValidEmail(email)) {
    return c.json({ ok: false, error: 'Correo electrónico inválido.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'customer:register', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const existing = await sql`
      SELECT id, password_hash FROM customers WHERE lower(email) = ${email} AND deleted_at IS NULL LIMIT 1
    `

    if (existing.length > 0 && existing[0].password_hash) {
      return c.json({ ok: false, error: 'Ya existe una cuenta con este correo. Inicia sesión.' }, 409)
    }

    const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
    const passwordHash = PasswordService.hashPassword(tempPassword)
    const marketingOptInAt = marketingOptIn ? new Date() : null

    if (existing.length > 0) {
      // Reclamar cliente "fantasma" existente (creado por POS/checkout invitado)
      await sql`
        UPDATE customers
        SET name = ${name},
            password_hash = ${passwordHash},
            must_change_password = true,
            email_verified = false,
            marketing_opt_in = ${marketingOptIn},
            marketing_opt_in_at = ${marketingOptInAt}
        WHERE id = ${existing[0].id}
      `
    } else {
      await sql`
        INSERT INTO customers (email, name, password_hash, must_change_password, email_verified, marketing_opt_in, marketing_opt_in_at, created_channel)
        VALUES (${email}, ${name}, ${passwordHash}, true, false, ${marketingOptIn}, ${marketingOptInAt}, 'web')
      `
    }

    await enqueueEmail(
      email,
      '¡Bienvenido a Seoul Shop!',
      templates.customerInitialCredentials({ email, password: tempPassword, name }),
      'welcome'
    )

    return c.json({ ok: true })
  } catch (error: any) {
    console.error('❌ Error en customer/register:', error)
    return c.json({ ok: false, error: 'No se pudo crear la cuenta.' }, 500)
  }
})

// AUTH LOGIN HANDLER — cliente (shared por /api/customer/login)
async function handleCustomerLogin(c: any) {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''

  if (!email || !password) {
    return c.json({ ok: false, error: 'Correo y contraseña son obligatorios.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'customer:login', { limit: 20, windowMinutes: 5 }, email)
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const rows = await sql`
      SELECT id, email, name, password_hash, email_verified, must_change_password, marketing_opt_in
      FROM customers
      WHERE lower(email) = ${email} AND deleted_at IS NULL
      LIMIT 1
    `

    if (rows.length === 0 || !rows[0].password_hash) {
      return c.json({ ok: false, error: 'Correo o contraseña incorrectos.' }, 401)
    }

    const customer = rows[0]
    const validPassword = PasswordService.verifyPassword(password, customer.password_hash)
    if (!validPassword) {
      return c.json({ ok: false, error: 'Correo o contraseña incorrectos.' }, 401)
    }

    // Verificación implícita del correo: si el cliente puede iniciar sesión con
    // la contraseña que le enviamos por correo, ya demostró ser dueño de ese
    // correo — no hay un endpoint separado de "click para verificar" en S09
    // (decisión de alcance documentada en SEUL_SESSION_09.md).
    const emailVerified = true
    await sql`
      UPDATE customers
      SET last_login_at = NOW(),
          email_verified = true,
          email_verified_at = COALESCE(email_verified_at, NOW())
      WHERE id = ${customer.id}
    `

    const token = jwt.sign(
      { customerId: customer.id, email: customer.email, name: customer.name, type: 'customer' },
      CUSTOMER_JWT_SECRET,
      { expiresIn: '7d' }
    )

    setCookie(c, CUSTOMER_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 604800, // 7 días
      domain: sessionCookieDomain(c),
    })

    const response = c.json({
      ok: true,
      mustChangePassword: customer.must_change_password,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        emailVerified,
        mustChangePassword: customer.must_change_password,
        marketingOptIn: customer.marketing_opt_in,
      },
    })

    // Mismo patrón que handleLogin (staff): reflejar el Origin real, nunca '*',
    // porque el fetch usa credentials: 'include'.
    const origin = c.req.header('Origin') || CUSTOMER_WEB_URL
    const responseOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : CUSTOMER_WEB_URL
    response.headers.set('Access-Control-Allow-Origin', responseOrigin)
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Allow-Credentials', 'true')

    return response
  } catch (error: any) {
    console.error('❌ Error en customer/login:', error)
    return c.json({ ok: false, error: 'Error interno.' }, 500)
  }
}

app.post('/api/customer/login', handleCustomerLogin)

// OPTIONS preflight — mismo patrón exacto que /api/auth/login (staff), lección
// explícita de esta sesión: reutilizar loginPreflightHeaders, no inventar uno
// nuevo. Es genérico (solo lee el header Origin), sirve igual para este login.
app.options('/api/customer/login', (c) => c.json(null, 200, loginPreflightHeaders(c)))

// GET /api/customer/me
app.get('/api/customer/me', async (c) => {
  const customerAuth = await requireCustomerSession(c)
  if (customerAuth instanceof Response) return customerAuth

  const rows = await sql`
    SELECT id, email, name, email_verified, must_change_password, marketing_opt_in
    FROM customers
    WHERE id = ${customerAuth.customerId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (rows.length === 0) {
    return c.json({ ok: false, error: 'Cuenta no encontrada.' }, 401)
  }

  const customer = rows[0]
  return c.json({
    ok: true,
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      emailVerified: customer.email_verified,
      mustChangePassword: customer.must_change_password,
      marketingOptIn: customer.marketing_opt_in,
    },
  })
})

// POST /api/customer/logout — mismo patrón que handleLogout (staff): borrar la
// cookie con exactamente los mismos atributos (path + domain) con los que se
// seteó, si no el browser no la borra de verdad (bug ya corregido del lado
// staff, no repetido acá).
app.post('/api/customer/logout', async (c) => {
  deleteCookie(c, CUSTOMER_SESSION_COOKIE_NAME, {
    path: '/',
    domain: sessionCookieDomain(c),
  })
  const response = c.json({ ok: true })
  const origin = c.req.header('Origin')
  response.headers.set('Access-Control-Allow-Origin', origin || CUSTOMER_WEB_URL)
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
})

// POST /api/customer/password-change — autenticado, requiere contraseña actual
app.post('/api/customer/password-change', async (c) => {
  const customerAuth = await requireCustomerSession(c)
  if (customerAuth instanceof Response) return customerAuth

  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const { currentPassword, newPassword } = body
  if (!currentPassword || !newPassword) {
    return c.json({ ok: false, error: 'Faltan campos de contraseña.' }, 400)
  }

  const complexityError = validateCustomerPasswordComplexity(newPassword)
  if (complexityError) {
    return c.json({ ok: false, error: complexityError }, 400)
  }

  try {
    const rows = await sql`
      SELECT id, email, name, password_hash FROM customers WHERE id = ${customerAuth.customerId} AND deleted_at IS NULL
    `
    if (rows.length === 0) {
      return c.json({ ok: false, error: 'Cuenta no encontrada.' }, 404)
    }

    const customer = rows[0]
    if (!PasswordService.verifyPassword(currentPassword, customer.password_hash)) {
      return c.json({ ok: false, error: 'La contraseña actual es incorrecta.' }, 401)
    }

    const newHash = PasswordService.hashPassword(newPassword)
    await sql`
      UPDATE customers
      SET password_hash = ${newHash}, must_change_password = false
      WHERE id = ${customer.id}
    `

    await enqueueEmail(
      customer.email,
      'Tu contraseña fue actualizada',
      templates.customerPasswordChanged({
        name: customer.name,
        email: customer.email,
        timestamp: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
      }),
      'password-reset'
    )

    return c.json({ ok: true })
  } catch (error: any) {
    console.error('❌ Error en customer/password-change:', error)
    return c.json({ ok: false, error: 'No se pudo cambiar la contraseña.' }, 500)
  }
})

// POST /api/customer/password-forgot — NUNCA revela si el correo existe.
// Rate-limited por email (además de la protección genérica por IP que ya da
// el fallback de checkAndRecordRateLimit) para no poder usar este endpoint
// para bombardear la bandeja de entrada de una víctima.
app.post('/api/customer/password-forgot', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  if (!email) {
    return c.json({ ok: false, error: 'Correo obligatorio.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'customer:password-forgot', { limit: 20, windowMinutes: 5 }, email)
  if (!rl.allowed) {
    // Incluso rate-limited, respondemos ok:true — el mensaje de "demasiadas
    // solicitudes" en sí mismo no revela si la cuenta existe, pero seguir
    // devolviendo el mismo 200 genérico es más simple y consistente con el
    // resto de este endpoint (nunca revelar), sin perder la protección: el
    // INSERT/envío de correo de abajo simplemente no ocurre.
    return c.json({ ok: true })
  }

  try {
    const rows = await sql`
      SELECT id, name, password_hash FROM customers
      WHERE lower(email) = ${email} AND deleted_at IS NULL
      LIMIT 1
    `

    if (rows.length > 0 && rows[0].password_hash) {
      const customer = rows[0]
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h

      await sql`
        INSERT INTO password_reset_tokens (token, customer_id, expires_at)
        VALUES (${token}, ${customer.id}, ${expiresAt})
      `

      const resetUrl = `${CUSTOMER_WEB_URL}/cuenta/recuperar/${token}`
      await enqueueEmail(
        email,
        'Recuperar tu contraseña — Seoul Shop',
        templates.customerPasswordResetLink({ name: customer.name, resetUrl }),
        'password-reset'
      )
    }
    // Si no existe o es una cuenta sin password (fantasma de POS), no hacemos
    // nada — pero respondemos exactamente igual para no revelar existencia.
  } catch (error: any) {
    console.error('❌ Error en customer/password-forgot:', error)
    // No revelar el error tampoco — mismo ok:true genérico.
  }

  return c.json({ ok: true })
})

// POST /api/customer/password-reset — con token de un solo uso (tabla
// password_reset_tokens, ya modelada en customer-auth.ts, TTL 1h)
app.post('/api/customer/password-reset', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const { token, newPassword } = body
  if (!token || !newPassword) {
    return c.json({ ok: false, error: 'Faltan campos.' }, 400)
  }

  const complexityError = validateCustomerPasswordComplexity(newPassword)
  if (complexityError) {
    return c.json({ ok: false, error: complexityError }, 400)
  }

  try {
    const rows = await sql`
      SELECT prt.customer_id, prt.expires_at, prt.used_at, c.email, c.name
      FROM password_reset_tokens prt
      JOIN customers c ON c.id = prt.customer_id
      WHERE prt.token = ${token}
      LIMIT 1
    `

    if (rows.length === 0) {
      return c.json({ ok: false, error: 'Enlace inválido o expirado.' }, 400)
    }

    const row = rows[0]
    if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return c.json({ ok: false, error: 'Enlace inválido o expirado.' }, 400)
    }

    const newHash = PasswordService.hashPassword(newPassword)
    await sql`
      UPDATE customers
      SET password_hash = ${newHash}, must_change_password = false
      WHERE id = ${row.customer_id}
    `
    await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ${token}`

    await enqueueEmail(
      row.email,
      'Tu contraseña fue actualizada',
      templates.customerPasswordChanged({
        name: row.name,
        email: row.email,
        timestamp: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
      }),
      'password-reset'
    )

    return c.json({ ok: true })
  } catch (error: any) {
    console.error('❌ Error en customer/password-reset:', error)
    return c.json({ ok: false, error: 'No se pudo restablecer la contraseña.' }, 500)
  }
})

// ============================================================================
// CUSTOMER ORDERS + PUBLIC CHECKOUT (S10, Fase 3) — catálogo + pedidos del
// cliente. Los endpoints de auth de arriba (register/login/me/logout/
// password-*) son de S09 y no se tocan en esta sesión.
// ============================================================================

// GET /api/customer/orders — pedidos del cliente autenticado
// (apps/web/.../cuenta/pedidos/page.tsx). Filtra SIEMPRE por el customerId de
// la sesión (requireCustomerSession), nunca por un parámetro — un cliente
// jamás debe poder pedir los pedidos de otro customerId adivinando/pasando un id.
app.get('/api/customer/orders', async (c) => {
  const customerAuth = await requireCustomerSession(c)
  if (customerAuth instanceof Response) return customerAuth

  try {
    // Ampliado (adición post-entrega, 3-sep-2026 — el dueño reportó que
    // "/cuenta/pedidos" no mostraba nada en tiempo real): antes solo
    // devolvía number/total/status/canal/fecha. Ahora suma estado de pago,
    // modo/fecha/franja de entrega, y el estado del repartidor si existe
    // asignación (mismo JOIN que ya usa GET /api/delivery/assignments).
    // Aplica igual a pedidos B2B — son orders normales con company_id, ya
    // cubiertos por este mismo endpoint/tabla.
    const rows = await sql`
      SELECT o.id, o.number, o.total, o.status, o.dte_status, o.channel, o.created_at,
             o.payment_status, o.payment_method, o.delivery_mode, o.metro_station,
             o.metro_slot, o.delivery_date, o.ready_at,
             da.status AS delivery_status, u.name AS driver_name
      FROM orders o
      LEFT JOIN delivery_assignments da ON da.order_id = o.id
      LEFT JOIN users u ON u.id = da.driver_id
      WHERE o.customer_id = ${customerAuth.customerId}
      ORDER BY o.created_at DESC
      LIMIT 100
    `
    return c.json({
      orders: rows.map((r: any) => ({
        id: r.id,
        number: r.number,
        total: r.total,
        status: r.status,
        dteStatus: r.dte_status,
        channel: r.channel,
        createdAt: r.created_at,
        paymentStatus: r.payment_status,
        paymentMethod: r.payment_method,
        deliveryMode: r.delivery_mode,
        metroStation: r.metro_station,
        metroSlot: r.metro_slot,
        deliveryDate: r.delivery_date,
        readyAt: r.ready_at,
        deliveryStatus: r.delivery_status,
        driverName: r.driver_name,
      })),
    })
  } catch (err) {
    console.error('Customer orders error:', err)
    return c.json({ error: 'No se pudieron cargar tus pedidos.' }, 500)
  }
})

// POST /api/customers/guest (S10) — upsert de cliente invitado para checkout
// sin cuenta (apps/web/.../checkout/page.tsx, upsertGuestCustomer). Mismo
// patrón "reclamar fantasma" que POST /api/customer/register (S09):
// customers.email es UNIQUE, así que un email que ya existe (con o sin
// password_hash) se reutiliza en vez de duplicar — preserva el historial de
// pedidos ya asociado a ese customer_id. Público, sin sesión — a diferencia
// del registro real, no crea password_hash ni envía ningún correo.
app.post('/api/customers/guest', async (c) => {
  const rl = await checkAndRecordRateLimit(c, 'customers:guest', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const name  = (body.name || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const phone = (body.phone || '').trim() || null

  if (!name || !email) {
    return c.json({ error: 'Nombre y correo son obligatorios.' }, 400)
  }
  if (!isValidEmail(email)) {
    return c.json({ error: 'Correo electrónico inválido.' }, 400)
  }

  try {
    const existing = await sql`SELECT id FROM customers WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`
    if (existing.length > 0) {
      // Reclama la fila existente — refresca nombre/teléfono si vinieron
      // distintos, nunca toca password_hash/auth de una cuenta que ya exista.
      await sql`
        UPDATE customers SET name = ${name}, phone = COALESCE(${phone}, phone)
        WHERE id = ${existing[0].id}
      `
      return c.json({ customerId: existing[0].id, isNew: false })
    }

    const [created] = await sql`
      INSERT INTO customers (name, email, phone, created_channel)
      VALUES (${name}, ${email}, ${phone}, 'web')
      RETURNING id
    `
    return c.json({ customerId: created.id, isNew: true })
  } catch (err) {
    console.error('Guest customer error:', err)
    return c.json({ error: 'Error al registrar datos de contacto.' }, 500)
  }
})

// GET /api/customers/search — búsqueda rápida para el modal "Pedido
// Delivery" del POS (adición post-entrega, 3-sep-2026 — hallazgo real: el
// frontend de POS y de cerebro (Clientes, ver GET /api/customers y
// GET /api/customers/:id más abajo) SIEMPRE llamaron a estos 3 endpoints,
// pero ninguno existía nunca en el servidor — por eso el buscador de
// clientes en POS decía "No se encontraron clientes" con CUALQUIER
// búsqueda, y la pantalla Clientes de cerebro mostraba "0 registros" aunque
// hubiera clientes reales en la base de datos. `q` busca por nombre, email
// o teléfono — mínimo 2 caracteres los exige el frontend, no hace falta acá.
app.get('/api/customers/search', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const q = (c.req.query('q') || '').trim()
  if (!q) return c.json({ customers: [] })

  try {
    const rows = await sql`
      SELECT id, name, email, phone, address, commune
      FROM customers
      WHERE deleted_at IS NULL
        AND (name ILIKE ${'%' + q + '%'} OR email ILIKE ${'%' + q + '%'} OR phone ILIKE ${'%' + q + '%'})
      ORDER BY name ASC
      LIMIT 10
    `
    return c.json({ customers: rows })
  } catch (err) {
    console.error('Customer search error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/customers — listado para cerebro/Clientes (mismo hallazgo que
// /search arriba — el frontend ya estaba armado, este endpoint nunca
// existió). orderCount/totalSpent/loyaltyBalance se calculan con subqueries
// correlacionadas — volumen bajo (retail de barrio), no justifica una vista
// materializada.
app.get('/api/customers', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const q     = (c.req.query('q') || '').trim()
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '100', 10) || 100, 1), 200)

  try {
    const rows = q
      ? await sql`
          SELECT cu.id, cu.name, cu.email, cu.phone, cu.rut, cu.created_channel, cu.created_at,
            (SELECT count(*) FROM orders o WHERE o.customer_id = cu.id) AS order_count,
            (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = cu.id) AS total_spent,
            (SELECT COALESCE(SUM(ll.points), 0) FROM loyalty_ledger ll WHERE ll.customer_id = cu.id) AS loyalty_balance
          FROM customers cu
          WHERE cu.deleted_at IS NULL
            AND (cu.name ILIKE ${'%' + q + '%'} OR cu.email ILIKE ${'%' + q + '%'} OR cu.rut ILIKE ${'%' + q + '%'})
          ORDER BY cu.created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT cu.id, cu.name, cu.email, cu.phone, cu.rut, cu.created_channel, cu.created_at,
            (SELECT count(*) FROM orders o WHERE o.customer_id = cu.id) AS order_count,
            (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = cu.id) AS total_spent,
            (SELECT COALESCE(SUM(ll.points), 0) FROM loyalty_ledger ll WHERE ll.customer_id = cu.id) AS loyalty_balance
          FROM customers cu
          WHERE cu.deleted_at IS NULL
          ORDER BY cu.created_at DESC
          LIMIT ${limit}
        `

    return c.json({
      customers: rows.map((r: any) => ({
        id: r.id, name: r.name, email: r.email, phone: r.phone, rut: r.rut,
        createdChannel: r.created_channel, createdAt: r.created_at,
        orderCount: Number(r.order_count), totalSpent: Number(r.total_spent),
        loyaltyBalance: Number(r.loyalty_balance),
      })),
      total: rows.length,
    })
  } catch (err) {
    console.error('List customers error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/customers/:id — detalle para cerebro/Clientes/[id] (mismo
// hallazgo que los dos anteriores).
app.get('/api/customers/:id', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  try {
    const [row] = await sql`
      SELECT cu.id, cu.name, cu.email, cu.phone, cu.rut, cu.document_type, cu.document_number,
        cu.created_channel, cu.created_at, cu.last_login_at,
        (SELECT count(*) FROM orders o WHERE o.customer_id = cu.id) AS order_count,
        (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = cu.id) AS total_spent,
        (SELECT COALESCE(SUM(ll.points), 0) FROM loyalty_ledger ll WHERE ll.customer_id = cu.id) AS loyalty_balance
      FROM customers cu
      WHERE cu.id = ${id} AND cu.deleted_at IS NULL
    `
    if (!row) return c.json({ error: 'Cliente no encontrado' }, 404)

    return c.json({
      customer: {
        id: row.id, name: row.name, email: row.email, phone: row.phone, rut: row.rut,
        documentType: row.document_type, documentNumber: row.document_number,
        createdChannel: row.created_channel, createdAt: row.created_at, lastLoginAt: row.last_login_at,
        orderCount: Number(row.order_count), totalSpent: Number(row.total_spent),
        loyaltyBalance: Number(row.loyalty_balance),
      },
    })
  } catch (err) {
    console.error('Get customer error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/public/orders (S10) — crea un pedido desde la tienda web pública
// (apps/web/.../checkout/page.tsx, createWebOrder). El frontend llamaba
// originalmente POST /api/orders/public, que nunca existió en el backend —
// se construye acá bajo un path distinto a propósito: /api/orders* (ver
// `app.use('/api/orders*', requireAuthMiddleware)` más arriba) exige API key
// con scope orders:write o sesión STAFF, y un visitante anónimo (o un cliente
// logueado con seul_customer_session, que tampoco es sesión staff) tiene que
// poder crear su propio pedido sin ninguna de esas dos credenciales. Colgar
// esto de /api/orders/public habría quedado atrapado por ese middleware sin
// forma limpia de exceptuarlo; un path fuera del prefijo evita depender de
// un detalle frágil de orden de registro de rutas en Hono.
//
// customer_id: si hay sesión de cliente activa, SIEMPRE se usa el customerId
// de esa sesión — nunca el que venga en el body — para que un cliente
// logueado no pueda crear un pedido atribuido a otro customerId. Sin sesión
// (checkout de invitado), se usa el customerId del body, creado un instante
// antes vía POST /api/customers/guest.
//
// Precio: el unitPrice que manda el frontend (copiado del carrito) se
// IGNORA — se recalcula desde products.price_retail al momento de crear el
// pedido, para que nadie pueda mandar un total manipulado. price_retail es
// información ya pública (GET /api/products), así que no hay fuga de datos
// al leerlo acá sin sesión.
//
// NO descuenta inventario — ningún endpoint de este backend lo hace todavía
// (ni POS ni B2B); es deuda pre-existente documentada en el plan maestro, no
// introducida por esta sesión.
//
// pdfToken: se devuelve null — no existe generación de PDF/boleta en este
// backend (orders.pdf_token existe en el schema pero ningún endpoint lo
// llena); es la Fase de SII/DTE, pospuesta post-entrega por decisión del
// cliente (commit 042e8f4). El checkout de apps/web no usa pdfToken hoy
// (solo result.number), así que null no rompe nada.
app.post('/api/public/orders', async (c) => {
  const rl = await checkAndRecordRateLimit(c, 'public-orders:create', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const { deliveryMode, metroStation, metroSlot, deliveryDate, deliveryAddress, notes, items, companyId, paymentMethod } = body
  // Rappi suspendido temporalmente (adición post-entrega, 3-sep-2026 — nunca
  // hubo integración real con la API de Rappi, ver DeliveryPicker). Rechazo
  // también server-side, no solo ocultarlo en el picker — por si alguien
  // pega directo al API. Reactivar: agregar 'rappi' de vuelta acá y en
  // RAPPI_SUSPENDED de packages/ui/src/shop/delivery-picker.tsx.
  const VALID_DELIVERY_MODES = ['metro', 'pickup', 'shipping', 'delivery']
  const VALID_PAYMENT_PREFS = ['transferencia', 'efectivo', 'transbank', 'credito_b2b']

  if (!deliveryMode || !VALID_DELIVERY_MODES.includes(deliveryMode)) {
    return c.json({ error: deliveryMode === 'rappi' ? 'Rappi Express no está disponible por ahora.' : 'Modo de entrega inválido.' }, 400)
  }
  if (!Array.isArray(items) || items.length === 0) {
    return c.json({ error: 'El carrito está vacío.' }, 400)
  }
  for (const it of items) {
    if (!it.productId || !(Number(it.quantity) > 0)) {
      return c.json({ error: 'Ítems de pedido inválidos.' }, 400)
    }
  }

  // Sesión de cliente opcional — nunca bloquea (el checkout de invitado debe
  // seguir funcionando sin login), pero si existe, manda por sobre cualquier
  // customerId que venga en el body.
  const customerAuth = await getOptionalCustomerSession(c)
  const customerId: string | undefined = customerAuth?.customerId || body.customerId

  if (!customerId) {
    return c.json({ error: 'Falta customerId.' }, 400)
  }

  try {
    const [customer] = await sql`
      SELECT id, email, name, password_hash FROM customers WHERE id = ${customerId} AND deleted_at IS NULL LIMIT 1
    `
    if (!customer) return c.json({ error: 'Cliente no encontrado.' }, 404)

    // Pedido B2B (adición post-entrega, punto central del rediseño B2B) —
    // companyId opcional, SIEMPRE validado contra la sesión de cliente (nunca
    // se confía en el body a secas): la empresa debe pertenecer al cliente
    // que está haciendo el pedido, mismo criterio que S10 ya usa para
    // customerId. Si la validación pasa, se cotiza con price_b2b en vez de
    // price_retail — de lo contrario un pedido B2B se cobraría a precio
    // público, que era exactamente el bug reportado por el dueño.
    let resolvedCompanyId: string | null = null
    if (companyId) {
      const [company] = await sql`
        SELECT id FROM b2b_companies WHERE id = ${companyId} AND customer_id = ${customerId}
      `
      if (!company) return c.json({ error: 'Empresa B2B no válida para esta cuenta.' }, 403)
      resolvedCompanyId = company.id
    }

    const paymentMethodPref = resolvedCompanyId && VALID_PAYMENT_PREFS.includes(paymentMethod) ? paymentMethod : null

    // Precios reales desde products — nunca confiar en el unitPrice del body.
    const productIds = items.map((it: any) => it.productId)
    const products = await sql`
      SELECT id, price_retail, price_b2b, status FROM products WHERE id = ANY(${productIds})
    `
    const productMap = new Map(products.map((p: any) => [p.id, p]))

    let subtotal = 0
    const resolvedItems: Array<{ productId: string; quantity: number; unitPrice: number; isBaes: boolean; lineTotal: number }> = []
    for (const it of items) {
      const p: any = productMap.get(it.productId)
      if (!p || p.status !== 'active') {
        return c.json({ error: 'Uno de los productos ya no está disponible.' }, 400)
      }
      const quantity = Number(it.quantity)
      const unitPrice = resolvedCompanyId && p.price_b2b != null ? Number(p.price_b2b) : Number(p.price_retail)
      const lineTotal = Math.round(unitPrice * quantity)
      subtotal += lineTotal
      resolvedItems.push({ productId: it.productId, quantity, unitPrice, isBaes: !!it.isBaes, lineTotal })
    }

    const order_number = Math.floor(Math.random() * 100000)

    const order = await sql.begin(async (tx: any) => {
      const [ord] = await tx`
        INSERT INTO orders (number, channel, customer_id, status, delivery_mode, delivery_address, metro_station, metro_slot, delivery_date, subtotal, total, notes, company_id, payment_method)
        VALUES (${order_number}, 'web', ${customerId}, 'nueva', ${deliveryMode}, ${deliveryAddress || null}, ${metroStation || null}, ${metroSlot || null}, ${deliveryDate || null}, ${subtotal}, ${subtotal}, ${notes || null}, ${resolvedCompanyId}, ${paymentMethodPref})
        RETURNING id, number
      `
      for (const it of resolvedItems) {
        await tx`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, is_baes, subtotal)
          VALUES (${ord.id}, ${it.productId}, ${it.quantity}, ${it.unitPrice}, ${it.isBaes}, ${it.lineTotal})
        `
      }
      // Gap real cerrado (adición post-entrega, 3-sep-2026 — el dueño reportó
      // que ningún pedido de repartidor llegaba a Drive): NINGÚN endpoint de
      // creación de pedidos insertaba nunca una fila en delivery_assignments
      // — el único INSERT que existía era el de dispatch-rappi (registro
      // manual). Despacho/Drive solo pueden LISTAR/ASIGNAR filas que ya
      // existen, así que un pedido Metro nunca tenía nada que asignarle a un
      // repartidor. 'pickup' no crea asignación (el cliente retira solo).
      if (deliveryMode === 'metro' || deliveryMode === 'shipping') {
        await tx`
          INSERT INTO delivery_assignments (order_id, status)
          VALUES (${ord.id}, 'pending')
        `
      }
      return ord
    })

    // Seguimiento para quien todavía no tiene cuenta real (adición
    // post-entrega, 3-sep-2026 — pedido explícito del dueño: "si el cliente
    // esta registrado que llegue a su correo y a su usuario y si no esta
    // registrado que se abra una página... por el momento de entrega... y
    // que se le invite a inscribirse"). password_hash NULL = cliente
    // "fantasma" creado por upsertGuestCustomer, nunca puso contraseña —
    // no tiene forma de entrar a /cuenta/pedidos a ver su pedido. El link
    // de seguimiento usa el UUID del pedido tal cual (ya es aleatorio e
    // impredecible — 122 bits de entropía, mismo criterio que Stripe usa
    // para links públicos de un solo recurso — no hace falta una tabla de
    // tokens nueva).
    if (customer.email) {
      const isGuest = !customer.password_hash
      const trackingUrl = `${CUSTOMER_WEB_URL}/seguimiento/${order.id}`
      await enqueueEmail(
        customer.email,
        `✅ Orden Confirmada #${order.number}`,
        isGuest
          ? templates.orderConfirmationGuestTracking(order, trackingUrl)
          : templates.orderConfirmation(order),
        'order-confirmation'
      )
    }
    await enqueueEmail(
      ADMIN_EMAIL,
      `📦 Nueva Orden #${order.number}`,
      `<p>Nueva orden de ${customer.name}. Total: $${subtotal}</p>`,
      'order-confirmation'
    )

    emitPosEvent({
      type: 'order.created',
      channel: 'web',
      payload: {
        orderId: order.id,
        number: order.number,
        channel: 'web',
        total: subtotal,
        deliveryMode,
        itemCount: resolvedItems.length,
        createdAt: new Date().toISOString(),
      },
    })

    console.log(`✅ Public order created: #${order.number}`)
    return c.json({ ok: true, orderId: order.id, number: order.number, pdfToken: null, total: subtotal })
  } catch (err) {
    console.error('Public order error:', err)
    return c.json({ error: 'Error al crear el pedido.' }, 500)
  }
})

// GET /api/public/orders/:id/track — seguimiento SIN login (adición
// post-entrega, 3-sep-2026), para el cliente "fantasma" (guest checkout)
// que nunca puso contraseña — apps/web/.../seguimiento/[id]/page.tsx. El
// UUID del pedido funciona como el "token": ya es aleatorio e impredecible
// (122 bits de entropía), no hace falta una tabla de tokens nueva — mismo
// criterio que usan links públicos de un solo recurso (ej. Stripe). Se
// devuelve el mismo detalle que GET /api/customer/orders para UN pedido,
// nunca datos de otros pedidos ni de otros clientes.
app.get('/api/public/orders/:id/track', async (c) => {
  const { id } = c.req.param()
  try {
    const [row] = await sql`
      SELECT o.id, o.number, o.total, o.status, o.dte_status, o.channel, o.created_at,
             o.payment_status, o.payment_method, o.delivery_mode, o.metro_station,
             o.metro_slot, o.delivery_date, o.ready_at,
             da.status AS delivery_status, u.name AS driver_name,
             cu.name AS customer_name
      FROM orders o
      LEFT JOIN delivery_assignments da ON da.order_id = o.id
      LEFT JOIN users u ON u.id = da.driver_id
      LEFT JOIN customers cu ON cu.id = o.customer_id
      WHERE o.id = ${id}
      LIMIT 1
    `
    if (!row) return c.json({ error: 'Pedido no encontrado' }, 404)

    return c.json({
      order: {
        id: row.id, number: row.number, total: row.total, status: row.status,
        dteStatus: row.dte_status, channel: row.channel, createdAt: row.created_at,
        paymentStatus: row.payment_status, paymentMethod: row.payment_method,
        deliveryMode: row.delivery_mode, metroStation: row.metro_station,
        metroSlot: row.metro_slot, deliveryDate: row.delivery_date, readyAt: row.ready_at,
        deliveryStatus: row.delivery_status, driverName: row.driver_name,
        customerName: row.customer_name,
      },
    })
  } catch (err) {
    console.error('Public order tracking error:', err)
    return c.json({ error: 'Error al buscar el pedido' }, 500)
  }
})

// ============================================================================
// SHARED AUTH HELPER — JWT via Authorization header or session cookie.
// NOTE (updated S01): requireAuthMiddleware now validates JWTs too (see
// middleware/auth.middleware.ts), and that same file now exports
// `requireSession(c, roles?)` — the canonical replacement for this local
// helper. New endpoints should use `requireSession` instead of `getAuthUser`.
// `getAuthUser` is kept as-is for the endpoints already using it below to
// avoid regressing anything in production; migrate opportunistically.
// ============================================================================
async function getAuthUser(c: any): Promise<{ id: string; email: string; role: string; name: string } | null> {
  let token: string | undefined
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = getCookie(c, SESSION_COOKIE_NAME)
  }
  if (!token) return null
  const verified = AuthService.verifyToken(token, JWT_SECRET)
  if (!verified.ok) return null
  return verified.decoded as any
}

// ============================================================================
// USERS MANAGEMENT (Usuarios panel + Despacho driver selector)
// ============================================================================

// GET /api/auth/users — lista de usuarios (consumida por Usuarios y Despacho)
// RBAC (S02, matriz sección 6.1): la sección "Usuarios" (gestión: editar rol,
// desactivar, crear) es owner-only — ver PUT/DELETE abajo y POST /api/auth/register.
// Este GET, sin embargo, también alimenta el selector de repartidor del panel
// Despacho (apps/cerebro/src/app/(admin)/despacho/page.tsx:67), al que staff/admin
// SÍ tienen acceso por la matriz — restringirlo a owner rompería Despacho para
// esos roles. Se deja en owner+admin+staff (mismos roles que ya pueden entrar a
// Despacho) en vez de owner-only para no regresionar esa pantalla.
app.get('/api/auth/users', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT id, email, name, role, is_active, cargo, departamento, telefono_personal,
             last_login_at, created_at, must_change_password
      FROM users
      ORDER BY created_at ASC
    `
    return c.json({
      users: rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        isActive: r.is_active,
        cargo: r.cargo,
        departamento: r.departamento,
        telefonoPersonal: r.telefono_personal,
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
        mustChangePassword: r.must_change_password,
      })),
    })
  } catch (err) {
    console.error('List users error:', err)
    return c.json({ error: 'Error listing users' }, 500)
  }
})

// PUT /api/auth/users/:id — editar usuario (isActive, role, name, cargo, departamento, telefonoPersonal)
// RBAC (S02, matriz sección 6.1): Usuarios es visible/editable solo para 'owner'.
app.put('/api/auth/users/:id', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  try {
    const [before] = await sql`SELECT role, is_active, name, cargo, departamento, telefono_personal FROM users WHERE id = ${id}`

    const [updated] = await sql`
      UPDATE users SET
        role               = COALESCE(${body.role ?? null}, role),
        is_active          = COALESCE(${typeof body.isActive === 'boolean' ? body.isActive : null}, is_active),
        name               = COALESCE(${body.name ?? null}, name),
        cargo              = COALESCE(${body.cargo ?? null}, cargo),
        departamento       = COALESCE(${body.departamento ?? null}, departamento),
        telefono_personal  = COALESCE(${body.telefonoPersonal ?? null}, telefono_personal),
        updated_at         = NOW()
      WHERE id = ${id}
      RETURNING id, email, name, role, is_active, cargo, departamento, telefono_personal, last_login_at, created_at
    `

    if (!updated) return c.json({ error: 'User not found' }, 404)

    // Audit log (S16, Fase 5 — Hardening): un solo evento por PUT con el diff
    // real de lo que cambió. `action` se etiqueta por el cambio más sensible
    // presente (role_change > activate/deactivate > update genérico) para que
    // la UI de auditoría pueda filtrar por acción sin perder ningún campo —
    // el diff completo siempre queda en `details.changes` sin importar la
    // etiqueta elegida.
    if (before) {
      const changes: Record<string, { before: any; after: any }> = {}
      if (body.role !== undefined && body.role !== null && body.role !== before.role) {
        changes.role = { before: before.role, after: updated.role }
      }
      if (typeof body.isActive === 'boolean' && body.isActive !== before.is_active) {
        changes.isActive = { before: before.is_active, after: updated.is_active }
      }
      if (body.name !== undefined && body.name !== null && body.name !== before.name) {
        changes.name = { before: before.name, after: updated.name }
      }
      if (body.cargo !== undefined && body.cargo !== null && body.cargo !== before.cargo) {
        changes.cargo = { before: before.cargo, after: updated.cargo }
      }
      if (body.departamento !== undefined && body.departamento !== null && body.departamento !== before.departamento) {
        changes.departamento = { before: before.departamento, after: updated.departamento }
      }
      if (body.telefonoPersonal !== undefined && body.telefonoPersonal !== null && body.telefonoPersonal !== before.telefono_personal) {
        changes.telefonoPersonal = { before: before.telefono_personal, after: updated.telefono_personal }
      }

      if (Object.keys(changes).length > 0) {
        let action = 'user.update'
        if (changes.role) action = 'user.role_change'
        else if (changes.isActive) action = changes.isActive.after === false ? 'user.deactivate' : 'user.activate'

        await recordAuditLog(c, authUser, action, { table: 'users', id: updated.id }, {
          targetEmail: updated.email,
          changes,
        })
      }
    }

    return c.json({
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: updated.is_active,
        cargo: updated.cargo,
        departamento: updated.departamento,
        telefonoPersonal: updated.telefono_personal,
        lastLoginAt: updated.last_login_at,
        createdAt: updated.created_at,
      },
    })
  } catch (err) {
    console.error('Update user error:', err)
    return c.json({ error: 'Error updating user' }, 500)
  }
})

// DELETE /api/auth/users/:id — soft-delete (is_active=false). FKs (delivery_assignments,
// shifts, till_sessions, cash_movements, etc.) reference users.id — a hard delete would
// either fail on FK constraints or cascade-destroy operational history, so this only
// deactivates the account (matches the frontend's own confirm-dialog copy).
// RBAC (S02, matriz sección 6.1): Usuarios es visible/editable solo para 'owner'.
app.delete('/api/auth/users/:id', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  try {
    const [target] = await sql`SELECT id, email, role, is_active FROM users WHERE id = ${id}`
    if (!target) return c.json({ error: 'User not found' }, 404)
    if (target.role === 'owner') {
      return c.json({ error: 'No se puede eliminar una cuenta owner' }, 403)
    }

    await sql`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ${id}`

    // Audit log (S16, Fase 5 — Hardening).
    await recordAuditLog(c, authUser, 'user.deactivate', { table: 'users', id }, {
      targetEmail: target.email,
      changes: { isActive: { before: target.is_active, after: false } },
      via: 'DELETE /api/auth/users/:id (soft-delete)',
    })

    return c.json({ ok: true })
  } catch (err) {
    console.error('Delete user error:', err)
    return c.json({ error: 'Error deleting user' }, 500)
  }
})

// ============================================================================
// SHIFTS & TILL SESSIONS (POS caja) — two distinct, already-modeled concepts:
//   shift        = one cashier's workday on a device (table `shifts`)
//   till_session = one cash-drawer session nested inside a shift, FK'd via
//                  shift_id (table `till_sessions`) — a shift can span
//                  multiple till sessions if the till is closed/reopened.
// Both tables + `cash_movements` already existed in the DB (Drizzle schema
// in packages/db/src/schema/{shifts,till-sessions}.ts predates this work);
// only the HTTP layer was missing. Both enforce "one open per device" via a
// partial unique index, so races surface as a friendly 409 (pg code 23505).
// ============================================================================

const ZREPORT_METHODS = ['cash', 'debit', 'credit', 'baes', 'qr', 'transfer'] as const

async function computeTillZReport(tillId: string): Promise<any | null> {
  const [till] = await sql`
    SELECT ts.id, ts.session_number, ts.shift_id, ts.opening_float, ts.opened_at, ts.closed_at,
           s.shift_number, u.name AS cashier_name
    FROM till_sessions ts
    JOIN shifts s ON s.id = ts.shift_id
    JOIN users u ON u.id = ts.opened_by
    WHERE ts.id = ${tillId}
  `
  if (!till) return null

  const [agg] = await sql`
    SELECT
      count(*) FILTER (WHERE status != 'cancelada') AS ticket_count,
      count(*) FILTER (WHERE status = 'cancelada')  AS void_count,
      COALESCE(sum(total) FILTER (WHERE status != 'cancelada'), 0) AS gross_total
    FROM orders WHERE till_session_id = ${tillId}
  `

  const methodRows = await sql`
    SELECT op.method, COALESCE(sum(op.amount), 0) AS amount
    FROM order_payments op
    JOIN orders o ON o.id = op.order_id
    WHERE o.till_session_id = ${tillId} AND o.status != 'cancelada'
    GROUP BY op.method
  `

  const [refundAgg] = await sql`
    SELECT count(*) AS refund_count, COALESCE(sum(r.refund_amount_clp), 0) AS refund_total
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    WHERE o.till_session_id = ${tillId} AND r.status = 'processed'
  `

  const byMethod: Record<string, number> = Object.fromEntries(ZREPORT_METHODS.map(m => [m, 0]))
  for (const row of methodRows) {
    byMethod[row.method] = (byMethod[row.method] ?? 0) + Number(row.amount)
  }

  const grossTotal = Number(agg.gross_total)
  const refundTotal = Number(refundAgg.refund_total)
  const openingFloat = Number(till.opening_float)

  return {
    tillId: till.id,
    tillSessionNumber: till.session_number,
    shiftId: till.shift_id,
    shiftNumber: till.shift_number,
    cashierName: till.cashier_name,
    openedAt: till.opened_at,
    closedAt: till.closed_at,
    openingFloat,
    ticketCount: Number(agg.ticket_count),
    voidCount: Number(agg.void_count),
    refundCount: Number(refundAgg.refund_count),
    grossTotal,
    refundTotal,
    netTotal: grossTotal - refundTotal,
    byMethod,
    expectedCash: openingFloat + (byMethod.cash ?? 0),
  }
}

async function computeMasterZReport(shiftId: string): Promise<any | null> {
  const [shift] = await sql`SELECT id, shift_number, opened_at, closed_at FROM shifts WHERE id = ${shiftId}`
  if (!shift) return null

  const tillRows = await sql`SELECT id FROM till_sessions WHERE shift_id = ${shiftId} ORDER BY session_number ASC`
  const tillReports: any[] = []
  for (const t of tillRows) {
    const r = await computeTillZReport(t.id)
    if (r) tillReports.push(r)
  }

  const byMethod: Record<string, number> = Object.fromEntries(ZREPORT_METHODS.map(m => [m, 0]))
  for (const r of tillReports) {
    for (const [method, amount] of Object.entries(r.byMethod as Record<string, number>)) {
      byMethod[method] = (byMethod[method] ?? 0) + Number(amount)
    }
  }

  const grossTotal = tillReports.reduce((s, r) => s + r.grossTotal, 0)
  const refundTotal = tillReports.reduce((s, r) => s + r.refundTotal, 0)

  return {
    shiftId: shift.id,
    shiftNumber: shift.shift_number,
    openedAt: shift.opened_at,
    closedAt: shift.closed_at,
    tillCount: tillReports.length,
    totalTickets: tillReports.reduce((s, r) => s + r.ticketCount, 0),
    totalVoids: tillReports.reduce((s, r) => s + r.voidCount, 0),
    totalRefunds: tillReports.reduce((s, r) => s + r.refundCount, 0),
    grossTotal,
    refundTotal,
    netTotal: grossTotal - refundTotal,
    byMethod,
    tills: tillReports.map(r => ({
      tillId: r.tillId,
      tillSessionNumber: r.tillSessionNumber,
      cashierName: r.cashierName,
      openedAt: r.openedAt,
      closedAt: r.closedAt,
      openingFloat: r.openingFloat,
      ticketCount: r.ticketCount,
      netTotal: r.netTotal,
      byMethod: r.byMethod,
    })),
  }
}

// --- Shifts ---

app.post('/api/shifts/open', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const deviceId = body.device_id
  const openingFloat = Number(body.opening_float_clp) || 0
  if (!deviceId) return c.json({ error: 'Missing device_id' }, 400)

  try {
    const [shift] = await sql`
      INSERT INTO shifts (opened_by, device_id, opening_float)
      VALUES (${authUser.id}, ${deviceId}, ${openingFloat})
      RETURNING id, shift_number, opened_at, opening_float, device_id
    `
    return c.json({
      shift: {
        id: shift.id, shiftNumber: shift.shift_number, openedAt: shift.opened_at,
        openingFloat: shift.opening_float, deviceId: shift.device_id,
      },
    })
  } catch (err: any) {
    if (err?.code === '23505') return c.json({ error: 'Ya hay un turno abierto en este dispositivo' }, 409)
    console.error('Open shift error:', err)
    return c.json({ error: err.message || 'Error al abrir turno' }, 500)
  }
})

app.get('/api/shifts/active', async (c) => {
  // Migrated to requireSession (S01 proof-of-concept, bloqueador P0 #2).
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const deviceId = c.req.query('device_id')
  if (!deviceId) return c.json({ error: 'Missing device_id' }, 400)

  try {
    const [shift] = await sql`
      SELECT id, shift_number, opened_at, opening_float, device_id
      FROM shifts WHERE device_id = ${deviceId} AND status = 'open'
    `
    return c.json({
      shift: shift ? {
        id: shift.id, shiftNumber: shift.shift_number, openedAt: shift.opened_at,
        openingFloat: shift.opening_float, deviceId: shift.device_id,
      } : null,
    })
  } catch (err) {
    console.error('Active shift error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.get('/api/shifts/history', async (c) => {
  // Migrated to requireSession (S01 proof-of-concept, bloqueador P0 #2).
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '30', 10) || 30, 1), 100)

  try {
    const rows = await sql`
      SELECT s.id, s.shift_number, s.device_id, s.status, s.opened_at, s.closed_at,
             s.opening_float, s.closing_summary, u.name AS cashier_name, u.email AS cashier_email
      FROM shifts s
      JOIN users u ON u.id = s.opened_by
      ORDER BY s.opened_at DESC
      LIMIT ${limit}
    `
    return c.json({
      shifts: rows.map((r: any) => ({
        id: r.id, shiftNumber: r.shift_number, deviceId: r.device_id, status: r.status,
        openedAt: r.opened_at, closedAt: r.closed_at, openingFloat: r.opening_float,
        cashierName: r.cashier_name, cashierEmail: r.cashier_email,
        closingSummary: r.closing_summary,
      })),
    })
  } catch (err) {
    console.error('Shift history error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.get('/api/shifts/:id/z-report', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const masterReport = await computeMasterZReport(c.req.param('id'))
    if (!masterReport) return c.json({ error: 'Shift not found' }, 404)
    return c.json({ masterReport })
  } catch (err) {
    console.error('Master z-report error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.post('/api/shifts/:id/close', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  const id = c.req.param('id')
  try {
    const [shift] = await sql`SELECT id FROM shifts WHERE id = ${id}`
    if (!shift) return c.json({ error: 'Shift not found' }, 404)

    const openTills = await sql`SELECT id FROM till_sessions WHERE shift_id = ${id} AND status = 'open'`
    if (openTills.length > 0) {
      return c.json({
        error: 'Hay una caja abierta en este turno. Ciérrala antes de cerrar el turno.',
        openTillIds: openTills.map((t: any) => t.id),
      }, 409)
    }

    const masterReport = await computeMasterZReport(id)
    await sql`
      UPDATE shifts SET status = 'closed', closed_at = NOW(), closing_summary = ${masterReport}
      WHERE id = ${id}
    `
    return c.json({ masterReport })
  } catch (err) {
    console.error('Close shift error:', err)
    return c.json({ error: 'Error al cerrar turno' }, 500)
  }
})

// --- Till sessions ---

app.post('/api/till-sessions/open', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const shiftId = body.shift_id
  const deviceId = body.device_id
  const openingFloat = Number(body.opening_float_clp) || 0
  if (!shiftId || !deviceId) return c.json({ error: 'Missing shift_id or device_id' }, 400)

  try {
    const [shift] = await sql`SELECT id, status FROM shifts WHERE id = ${shiftId}`
    if (!shift) return c.json({ error: 'Shift not found' }, 404)
    if (shift.status !== 'open') return c.json({ error: 'El turno no está abierto' }, 409)

    const [till] = await sql`
      INSERT INTO till_sessions (shift_id, opened_by, device_id, opening_float)
      VALUES (${shiftId}, ${authUser.id}, ${deviceId}, ${openingFloat})
      RETURNING id, session_number, shift_id, opened_at, opening_float, device_id
    `
    return c.json({
      tillSession: {
        id: till.id, sessionNumber: till.session_number, shiftId: till.shift_id,
        openedAt: till.opened_at, openingFloat: till.opening_float, deviceId: till.device_id,
        openedByName: authUser.name,
      },
    })
  } catch (err: any) {
    if (err?.code === '23505') return c.json({ error: 'Ya hay una caja abierta en este dispositivo' }, 409)
    console.error('Open till error:', err)
    return c.json({ error: err.message || 'Error al abrir caja' }, 500)
  }
})

app.get('/api/till-sessions/active', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  const deviceId = c.req.query('device_id')
  if (!deviceId) return c.json({ error: 'Missing device_id' }, 400)

  try {
    const [till] = await sql`
      SELECT ts.id, ts.session_number, ts.shift_id, ts.opened_at, ts.opening_float, ts.device_id,
             u.name AS opened_by_name
      FROM till_sessions ts
      JOIN users u ON u.id = ts.opened_by
      WHERE ts.device_id = ${deviceId} AND ts.status = 'open'
    `
    return c.json({
      tillSession: till ? {
        id: till.id, sessionNumber: till.session_number, shiftId: till.shift_id,
        openedAt: till.opened_at, openingFloat: till.opening_float, deviceId: till.device_id,
        openedByName: till.opened_by_name,
      } : null,
    })
  } catch (err) {
    console.error('Active till error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.get('/api/till-sessions/:id/z-report', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const zReport = await computeTillZReport(c.req.param('id'))
    if (!zReport) return c.json({ error: 'Till session not found' }, 404)
    return c.json({ zReport })
  } catch (err) {
    console.error('Till z-report error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.post('/api/till-sessions/:id/close', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  const id = c.req.param('id')
  try {
    const [till] = await sql`SELECT id FROM till_sessions WHERE id = ${id}`
    if (!till) return c.json({ error: 'Till session not found' }, 404)

    const zReport = await computeTillZReport(id)
    await sql`
      UPDATE till_sessions SET status = 'closed', closed_at = NOW(), closing_summary = ${zReport}
      WHERE id = ${id}
    `
    return c.json({ zReport })
  } catch (err) {
    console.error('Close till error:', err)
    return c.json({ error: 'Error al cerrar caja' }, 500)
  }
})

// ============================================================================
// B2C ENDPOINTS (7 emails)
// ============================================================================

// Proteger endpoints de órdenes — requieren autenticación
app.use('/api/orders*', requireAuthMiddleware)
app.use('/api/orders*', requireScopeMiddleware(['orders:write']))

// POST /api/orders — checkout real de POS (SEUL_SESSION_boletas-80mm, fuera de
// numeración S01-S17). Este endpoint solía asumir el shape de un pedido web
// (customer_email/items/total planos) que apps/pos/.../checkout-shell.tsx
// (la UI de cobro realmente montada en apps/pos/src/app/page.tsx) NUNCA
// llamó con esa forma — toda venta en caja fallaba con 400 "Missing fields"
// antes de llegar siquiera a intentar el INSERT. Reescrito para el payload
// real que envía handleConfirm() en apps/pos/src/app/page.tsx: items con
// productId/quantity/unitPrice/isBaes, payments[], shiftId/tillSessionId,
// dteType, receiver opcional (factura). El endpoint de web público vive
// aparte en POST /api/public/orders (ver comentario ahí) y no se toca acá.
app.post('/api/orders', async (c) => {
  // Rate limit (S02, bloqueador P0 #3): 20 pedidos / 5 min por usuario o IP.
  const rl = await checkAndRecordRateLimit(c, 'orders:create', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  const auth = c.get('auth') as { userId?: string } | undefined

  try {
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ error: 'JSON inválido' }, 400)

    const items: Array<{ productId?: string; quantity?: number; unitPrice?: number; isBaes?: boolean; name?: string }> =
      Array.isArray(body.items) ? body.items : []
    const payments: Array<{ method?: string; amount?: number; meta?: unknown }> =
      Array.isArray(body.payments) ? body.payments : []
    let receiver = body.receiver as
      | { rut?: string; razonSocial?: string; giro?: string; direccion?: string; comuna?: string }
      | undefined
    const deliveryMode = typeof body.deliveryMode === 'string' ? body.deliveryMode : 'pickup'
    // Comuna de entrega estructurada (adición post-entrega, migración
    // 0024c) — distinta de receiver.comuna (esa es la comuna del RECEPTOR
    // para la boleta/factura B2B, un concepto separado).
    const deliveryComuna = typeof body.comuna === 'string' ? body.comuna.trim() || null : null

    if (items.length === 0) return c.json({ error: 'El pedido no tiene productos' }, 400)
    for (const it of items) {
      if (!it.productId || !(Number(it.quantity) > 0) || !(Number(it.unitPrice) >= 0)) {
        return c.json({ error: 'Ítem inválido en el pedido' }, 400)
      }
    }

    // Venta B2B presencial en POS (adición post-entrega, punto 6 del flujo de
    // aprobación de crédito B2B pedido por el dueño). `companyId` es
    // opcional — un toggle "Venta B2B" en el POS lo setea cuando el cajero
    // atiende a un mayorista en mostrador, nunca obligatorio (no rompe el
    // flujo normal de venta). channel se mantiene 'pos' a propósito (la
    // plata sigue entrando por caja, cuenta igual en el z-report) —
    // `company_id` es el diferenciador para reportes/futuro SII (factura vs
    // boleta/nota). Si el cajero no llenó el panel de receptor a mano, se
    // autocompleta desde los datos de la empresa para que la venta quede
    // trazable al RUT correcto sin un paso manual extra.
    let companyId: string | null = null
    if (body.companyId) {
      const [company] = await sql`
        SELECT id, razon_social, rut, giro, address FROM b2b_companies WHERE id = ${body.companyId}
      `
      if (!company) return c.json({ error: 'Empresa B2B no encontrada' }, 404)
      companyId = company.id
      if (!receiver || (!receiver.rut && !receiver.razonSocial)) {
        receiver = {
          rut: company.rut, razonSocial: company.razon_social,
          giro: company.giro || undefined, direccion: company.address || undefined,
        }
      }
    }

    const subtotal = items.reduce((acc, it) => acc + Number(it.unitPrice) * Number(it.quantity), 0)
    const baesAmount = items
      .filter(it => it.isBaes)
      .reduce((acc, it) => acc + Number(it.unitPrice) * Number(it.quantity), 0)
    const total = subtotal - baesAmount

    // DTE real (Haulmer/OpenFactura/SimpleAPI) es decisión de negocio pendiente,
    // post-entrega v1.0 — ver PLAN_MAESTRO_SEUL_KING_OS.md. Hoy TODO pedido de
    // POS se fuerza a 'nota_venta' (documento no tributario, legal de emitir
    // sin timbre SII) sin importar lo que envíe el cliente — defensa en
    // profundidad; la UI de POS (checkout-shell.tsx) ya solo deja elegir Nota
    // de Venta, esto es el respaldo del lado servidor. Cuando el dueño
    // conecte un proveedor real: (1) leer `body.dteType` acá en vez de forzar
    // la constante, (2) pasar DTE_PROVIDER/DTE_API_KEY reales a emitDte() más
    // abajo. El resto (checkout, impresión, order_items, dte_events) no
    // necesita cambios — ese es el punto del seam en @seul/dte.
    const dteType = 'nota_venta' as const

    const order = await sql.begin(async (tx: any) => {
      // orders.number no tiene constraint UNIQUE (migración 0000) — se
      // serializa la asignación con un advisory lock en vez de agregar una
      // migración nueva solo para esto.
      await tx`SELECT pg_advisory_xact_lock(778899123)`
      const [{ next_number }] = await tx`
        SELECT COALESCE(MAX(number), 0) + 1 AS next_number FROM orders
      `

      const [ord] = await tx`
        INSERT INTO orders (
          number, channel, customer_id, delivery_mode, delivery_address, delivery_comuna,
          subtotal, baes_amount, total, dte_type, dte_status,
          receiver_rut, receiver_name, receiver_giro, receiver_address, receiver_comuna,
          guest_name, guest_phone, guest_email,
          shift_id, till_session_id, cashier_id, company_id,
          payment_status
        ) VALUES (
          ${next_number}, 'pos', ${body.customerId || null}, ${deliveryMode}, ${body.deliveryAddress || null}, ${deliveryComuna},
          ${subtotal}, ${baesAmount}, ${total}, ${dteType}, 'pending',
          ${receiver?.rut || null}, ${receiver?.razonSocial || null}, ${receiver?.giro || null}, ${receiver?.direccion || null}, ${receiver?.comuna || null},
          ${body.guestName || null}, ${body.guestPhone || null}, ${body.guestEmail || null},
          ${body.shiftId || null}, ${body.tillSessionId || null}, ${auth?.userId || null}, ${companyId},
          'confirmed'
        )
        RETURNING id, number
      `

      for (const it of items) {
        await tx`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, is_baes, subtotal)
          VALUES (${ord.id}, ${it.productId}, ${it.quantity}, ${it.unitPrice}, ${!!it.isBaes}, ${Number(it.unitPrice) * Number(it.quantity)})
        `
      }

      for (const p of payments) {
        if (!p.method || !(Number(p.amount) >= 0)) continue
        // postgres.js serializa objetos JS a jsonb automáticamente para una
        // columna jsonb — pasar JSON.stringify(...) (ya un string) hace que
        // lo serialice OTRA VEZ, guardando un string-escapado en vez de un
        // objeto real. El objeto JS directo (sin stringify, sin ::jsonb) es
        // lo correcto acá.
        await tx`
          INSERT INTO order_payments (order_id, method, amount, meta)
          VALUES (${ord.id}, ${p.method}, ${p.amount}, ${p.meta ?? {}})
        `
      }

      // Mismo gap real cerrado en POST /api/public/orders (adición
      // post-entrega, 3-sep-2026) — un pedido delivery cargado desde POS
      // (modal "Pedido Delivery", modo 'delivery') tampoco creaba nunca una
      // fila en delivery_assignments, así que tampoco le llegaba nada a
      // Despacho/Drive. 'pickup' no aplica (retiro en el local).
      if (deliveryMode === 'delivery') {
        await tx`
          INSERT INTO delivery_assignments (order_id, status)
          VALUES (${ord.id}, 'pending')
        `
      }

      return ord
    })

    // MockDTEProvider (único activo hoy): registra el intento en dte_events
    // con provider:'mock', sin ninguna llamada de red externa — ver
    // packages/dte/src/providers/mock.ts + factory.ts.
    let dteStatus: 'issued' | 'failed' = 'issued'
    try {
      const dteReq: DteRequest = {
        type: dteType,
        idempotencyKey: `${order.id}-1`,
        emitter: {
          rut: STORE_INFO.rut,
          razonSocial: STORE_INFO.name,
          giro: STORE_INFO.giro,
          direccion: STORE_INFO.address,
          comuna: '', // no centralizado aún en STORE_INFO — ver constants.ts
        },
        items: items.map(it => ({
          sku: it.productId,
          name: it.name ?? '',
          qty: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
        payments: payments
          .filter(p => p.method && Number(p.amount) >= 0)
          .map(p => ({ method: String(p.method), amount: Number(p.amount) })),
        totalNet: subtotal,
        totalIva: 0,
        totalGross: total,
      }
      const dteRes = await emitDte(dteReq, { DTE_PROVIDER: 'mock' })

      await sql`
        UPDATE orders SET dte_status = 'issued', dte_provider = 'mock', dte_track_id = ${dteRes.trackId}, updated_at = NOW()
        WHERE id = ${order.id}
      `
      // Mismo motivo que el comentario en order_payments.meta arriba: objeto
      // JS directo, sin JSON.stringify ni ::jsonb — postgres.js ya sabe
      // serializarlo para una columna jsonb.
      await sql`
        INSERT INTO dte_events (order_id, attempt, status, provider, request_payload, response_payload)
        VALUES (${order.id}, 1, 'sent', 'mock', ${dteReq}, ${dteRes})
      `
    } catch (dteErr) {
      // La venta YA está guardada (orders/order_items/order_payments) — un
      // fallo del mock (no debería ocurrir, no hay red de por medio) nunca
      // debe tumbar el checkout. Se registra en dte_events como 'error' y el
      // pedido queda con dte_status='failed' para revisión, pero el ticket
      // igual se imprime como nota_venta desde el POS.
      dteStatus = 'failed'
      console.error('DTE mock error:', dteErr)
      await sql`UPDATE orders SET dte_status = 'failed', dte_provider = 'mock', updated_at = NOW() WHERE id = ${order.id}`
      await sql`
        INSERT INTO dte_events (order_id, attempt, status, provider, error_message)
        VALUES (${order.id}, 1, 'error', 'mock', ${dteErr instanceof Error ? dteErr.message : String(dteErr)})
      `
    }

    // SSE (S08, Fase 2): notifica a las demás terminales POS en tiempo real.
    // channel:'pos' (antes decía 'web' por error — este endpoint nunca lo
    // llamó un cliente web real). El filtro `data.channel !== 'pos'` en
    // apps/pos/src/lib/order-events.ts ya está pensado para esto: cada
    // terminal ignora el eco de sus propias ventas y solo reacciona a
    // pedidos creados por OTROS canales/terminales.
    emitPosEvent({
      type: 'order.created',
      channel: 'pos',
      payload: {
        orderId: order.id,
        number: order.number,
        channel: 'pos',
        total,
        deliveryMode,
        itemCount: items.length,
        createdAt: new Date().toISOString(),
      },
    })

    console.log(`✅ POS order created: #${order.number} (dte:${dteStatus})`)
    return c.json({ orderId: order.id, number: order.number, total, dteStatus })
  } catch (err) {
    console.error('POS order error:', err)
    return c.json({ error: 'Error al crear el pedido' }, 500)
  }
})

// GET /api/orders/:id/dte-status — usado por el polling de checkout-shell.tsx
// tras confirmar una venta. Con MockDTEProvider el estado ya queda resuelto
// (issued/failed) en el mismo POST /api/orders, así que esto normalmente
// responde de inmediato en el primer poll; queda listo para cuando el DTE
// real sea asíncrono (proveedor real → 'pending'/'sending' por más tiempo).
app.get('/api/orders/:id/dte-status', async (c) => {
  const { id } = c.req.param()
  try {
    const [row] = await sql`
      SELECT dte_status, dte_folio, pdf_url FROM orders WHERE id = ${id}
    `
    if (!row) return c.json({ error: 'Pedido no encontrado' }, 404)
    return c.json({ status: row.dte_status, folio: row.dte_folio ?? undefined, pdfUrl: row.pdf_url ?? undefined })
  } catch (err) {
    console.error('DTE status error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/orders/:id/comanda — payload de comanda para impresión (Kitchen/
// Prep Ticket, sin precios). GAP encontrado en esta sesión: apps/pos/.../
// incoming-orders-drawer.tsx (S08, Fase 2) ya llama este endpoint desde el
// botón "Imprimir comanda" pero nunca existió en el backend — el botón
// 404-eaba en silencio para todo pedido web desde que se construyó. Se
// arregla ahora porque además lo necesita el flujo de pago web (adición
// post-entrega): tras confirmar el pago de un pedido, el frontend dispara
// la impresión automática de comanda llamando primero a este GET para
// resolver los nombres de producto (order_items solo guarda product_id).
app.get('/api/orders/:id/comanda', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  try {
    const [order] = await sql`
      SELECT o.id, o.number, o.channel, o.delivery_mode, o.metro_station, o.metro_slot,
             o.delivery_date, o.notes, o.created_at, u.name AS cashier_name,
             o.company_id, comp.razon_social,
             COALESCE(o.guest_name, cu.name) AS resolved_customer_name
      FROM orders o
      LEFT JOIN users u ON u.id = o.cashier_id
      LEFT JOIN b2b_companies comp ON comp.id = o.company_id
      LEFT JOIN customers cu ON cu.id = o.customer_id
      WHERE o.id = ${id}
    `
    if (!order) return c.json({ error: 'Pedido no encontrado' }, 404)

    const items = await sql`
      SELECT oi.quantity, p.name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ${id}
      ORDER BY oi.id
    `

    // Destinatario — CUALQUIER canal, no solo B2B (adición post-entrega,
    // 3-sep-2026). Para B2B, el titular de la cuenta es la empresa, no
    // necesariamente quien recibe físicamente — se extrae el "Recibe: X"
    // que el checkout B2B ya guarda en notes (mismo regex que
    // GET /api/orders/:id/etiqueta). Para cualquier otro canal, el nombre
    // del cliente/invitado YA ES quien recibe (no hace falta notes especial).
    const recibeMatch = typeof order.notes === 'string' ? order.notes.match(/^Recibe: (.+?)(?: — |$)/) : null
    const recipientName = order.company_id ? (recibeMatch?.[1] ?? undefined) : (order.resolved_customer_name ?? undefined)

    // Canal calculado para la comanda: un pedido con company_id es
    // mayorista de cara al equipo de preparación (etiqueta "MAYORISTA"),
    // aunque orders.channel siga guardando 'web'/'pos' — mismo criterio de
    // company_id como diferenciador que el resto del rediseño B2B de hoy.
    const comanda = {
      orderId:      order.id,
      number:       order.number,
      channel:      order.company_id ? 'b2b' : order.channel,
      createdAt:    order.created_at,
      items:        items.map((it: any) => ({ name: it.name, qty: Number(it.quantity) })),
      deliveryMode: order.delivery_mode,
      deliveryDate: order.delivery_date ?? undefined,
      recipientName,
      notes:        order.company_id ? order.razon_social : undefined,
      metroStation: order.metro_station ?? undefined,
      metroSlot:    order.metro_slot ?? undefined,
      cashierName:  order.channel === 'pos' ? (order.cashier_name ?? undefined) : undefined,
    }

    return c.json({ comanda })
  } catch (err) {
    console.error('Comanda payload error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/orders/:id/etiqueta — payload de etiqueta de caja (adición
// post-entrega, rediseño B2B, punto "etiquetas que se imprimen para colocar
// en cajas"). Se imprime desde el mismo punto que la comanda.
app.get('/api/orders/:id/etiqueta', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  try {
    const [order] = await sql`
      SELECT o.id, o.number, o.channel, o.delivery_mode, o.delivery_address,
             o.metro_station, o.metro_slot, o.delivery_date, o.company_id, o.notes,
             comp.razon_social,
             COALESCE(o.guest_name, cu.name) AS resolved_customer_name,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
      FROM orders o
      LEFT JOIN b2b_companies comp ON comp.id = o.company_id
      LEFT JOIN customers cu ON cu.id = o.customer_id
      WHERE o.id = ${id}
    `
    if (!order) return c.json({ error: 'Pedido no encontrado' }, 404)

    // "Recibe: Nombre" se guarda como prefijo de notes en el checkout B2B
    // (ver POST /api/public/orders) — se extrae acá para la etiqueta. Para
    // cualquier otro canal (adición post-entrega, 3-sep-2026), el nombre del
    // cliente/invitado YA ES quien recibe.
    const recipientMatch = typeof order.notes === 'string' ? order.notes.match(/^Recibe: (.+?)(?: — |$)/) : null
    const recipient = order.company_id ? recipientMatch?.[1] : order.resolved_customer_name

    const etiqueta = {
      orderId:         order.id,
      number:          order.number,
      channel:         order.company_id ? 'b2b' : order.channel,
      companyName:     order.razon_social ?? undefined,
      recipient:       recipient ?? undefined,
      deliveryMode:    order.delivery_mode,
      deliveryAddress: order.delivery_address ?? undefined,
      metroStation:    order.metro_station ?? undefined,
      metroSlot:       order.metro_slot ?? undefined,
      deliveryDate:    order.delivery_date ?? undefined,
      itemCount:       Number(order.item_count ?? 0),
    }

    return c.json({ etiqueta })
  } catch (err) {
    console.error('Etiqueta payload error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/orders/:id/ticket — payload de Nota de Venta/Boleta para
// impresión (mismo shape TicketPayload que checkout-shell.tsx arma
// localmente en memoria justo al cobrar una venta POS). Se reconstruye acá
// desde la BD porque hace falta imprimir el comprobante de pedidos que NO
// se acaban de cobrar en esa misma sesión de navegador — el caso principal
// es un pedido web recién confirmado desde Comandas/Despacho (adición
// post-entrega, flujo de pago web), pero sirve igual para reimprimir
// cualquier pedido ya facturado.
app.get('/api/orders/:id/ticket', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  try {
    const [order] = await sql`
      SELECT o.id, o.number, o.channel, o.dte_type, o.dte_status, o.dte_folio,
             o.subtotal, o.baes_amount, o.total, o.created_at,
             o.payment_status, o.payment_method,
             o.delivery_mode, o.delivery_address, o.delivery_comuna,
             o.metro_station, o.metro_slot, o.delivery_date,
             u.name AS cashier_name
      FROM orders o
      LEFT JOIN users u ON u.id = COALESCE(o.cashier_id, o.payment_confirmed_by)
      WHERE o.id = ${id}
    `
    if (!order) return c.json({ error: 'Pedido no encontrado' }, 404)

    const items = await sql`
      SELECT oi.quantity, oi.unit_price, oi.subtotal, oi.is_baes, p.name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ${id}
      ORDER BY oi.id
    `

    let payments: Array<{ method: string; amount: number; label: string }> = []
    if (order.channel === 'pos') {
      const rows = await sql`SELECT method, amount FROM order_payments WHERE order_id = ${id}`
      const LABELS: Record<string, string> = { cash: 'Efectivo', debit: 'Débito', credit: 'Crédito', baes: 'BAES', qr: 'QR', transfer: 'Transferencia' }
      payments = rows.map((p: any) => ({ method: p.method, amount: Number(p.amount), label: LABELS[p.method] ?? p.method }))
    } else if (order.payment_method) {
      const LABELS: Record<string, string> = {
        transferencia: 'Transferencia bancaria (confirmada)',
        efectivo: 'Por cobrar en la puerta — Efectivo',
        transbank: 'Por cobrar en la puerta — Transbank',
        credito_b2b: 'Cargado a línea de crédito B2B',
      }
      payments = [{ method: order.payment_method, amount: Number(order.total), label: LABELS[order.payment_method] ?? order.payment_method }]
    }

    const ticket = {
      orderId:    order.id,
      ticketType: order.dte_type,
      number:     order.number,
      folio:      order.dte_folio ?? undefined,
      date:       order.created_at,
      cashier:    order.cashier_name ?? undefined,
      items: items.map((it: any) => ({
        name:      it.name,
        qty:       Number(it.quantity),
        unitPrice: Number(it.unit_price),
        subtotal:  Number(it.subtotal),
        isBaes:    !!it.is_baes,
      })),
      subtotal:   Number(order.subtotal),
      baesAmount: Number(order.baes_amount ?? 0),
      total:      Number(order.total),
      payments,
      storeInfo:  { ...STORE_INFO },
      dteStatus:  order.dte_status,
      // Entrega (adición post-entrega, 3-sep-2026 — pedido explícito del
      // dueño: la boleta/nota de venta nunca mostraba dirección/estación
      // para pedidos con delivery, solo la comanda y la etiqueta la tenían).
      deliveryMode:    order.delivery_mode ?? undefined,
      deliveryAddress: order.delivery_address ?? undefined,
      deliveryComuna:  order.delivery_comuna ?? undefined,
      metroStation:    order.metro_station ?? undefined,
      metroSlot:       order.metro_slot ?? undefined,
      deliveryDate:    order.delivery_date ?? undefined,
    }

    return c.json({ ticket })
  } catch (err) {
    console.error('Ticket payload error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/orders/:id/confirm-payment — flujo de pago para pedidos web
// (adición post-entrega, pedido explícito del dueño). Un pedido web nace
// payment_status='pending' (migración 0021) sin ninguna coordinación de
// pago — hoy el pedido queda en 'nueva' y ahí se estanca. Este endpoint es
// la acción de staff que resuelve esa coordinación:
//
//   - method:'transferencia' → el cliente YA pagó (verificado por fuera del
//     sistema, ej. comprobante bancario). No hay nada que cobrar en la
//     puerta — si el pedido ya tiene una delivery_assignment (staff pudo
//     asignar repartidor antes de coordinar el pago), se limpia a
//     payment_at_door='not_required'.
//   - method:'efectivo' | 'transbank' → el cliente pagará al recibir. Es la
//     información que el repartidor necesita para cobrar correctamente: si
//     ya existe una delivery_assignment para este pedido, se le escribe
//     amount_to_collect=total, payment_at_door='pending', payment_method —
//     mismos campos que S07 ya diseñó y que el z-report de repartidor
//     (GET /api/delivery/drivers/:driverId/z-report) ya suma vía
//     `SUM(amount_to_collect) FILTER (WHERE payment_at_door='collected')`.
//     Si el pedido es 'pickup' (retiro en tienda, sin repartidor), esta
//     información queda en la orden para que el cajero que atienda el
//     retiro sepa cómo cobrar.
//
// En ambos casos dispara (solo si el DTE de este pedido sigue 'pending',
// nunca dos veces) la emisión de Nota de Venta vía el mismo seam
// MockDTEProvider que usa el POS (ver POST /api/orders más arriba) — un
// pedido web nunca emitía DTE hasta esta sesión (POST /api/public/orders
// deja dte_status='pending' para siempre, pdfToken null). El frontend, tras
// un 200 de este endpoint, dispara la impresión de comanda + ticket — 100%
// client-side (ver print-service.ts), el backend en Railway no tiene acceso
// a ninguna impresora física.
//
// Idempotente: si el pedido ya está payment_status='confirmed', no repite
// side-effects (no re-emite DTE, no vuelve a tocar delivery_assignments) —
// solo devuelve el estado actual, para que un doble-click o un reintento de
// red no genere un dte_events duplicado.
app.post('/api/orders/:id/confirm-payment', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'JSON inválido' }, 400) }

  const method = body.method
  const VALID_METHODS = ['transferencia', 'efectivo', 'transbank', 'credito_b2b']
  if (!VALID_METHODS.includes(method)) {
    return c.json({ error: 'method debe ser transferencia, efectivo, transbank o credito_b2b' }, 400)
  }

  try {
    const [order] = await sql`
      SELECT id, number, channel, total, dte_type, dte_status, payment_status, company_id
      FROM orders WHERE id = ${id}
    `
    if (!order) return c.json({ error: 'Pedido no encontrado' }, 404)
    if (order.channel !== 'web') {
      return c.json({ error: 'Solo pedidos del canal web usan este flujo (POS ya cobra al crear la venta)' }, 400)
    }

    // Idempotencia: ya confirmado, no repetir side-effects.
    if (order.payment_status === 'confirmed') {
      return c.json({
        ok: true,
        alreadyConfirmed: true,
        orderId: order.id,
        number: order.number,
        paymentStatus: 'confirmed',
        dteStatus: order.dte_status,
      })
    }

    // Cargo a línea de crédito B2B — solo pedidos con company_id (adición
    // post-entrega, punto 6 del flujo B2B). Valida cupo disponible ANTES de
    // confirmar; nunca deja el crédito en negativo. Se registra en
    // b2b_credit_movements (no en b2b_wallet_ledger — ver comentario de la
    // migración 0023b, son conceptos distintos: línea de crédito vs wallet
    // prepago).
    if (method === 'credito_b2b') {
      if (!order.company_id) {
        return c.json({ error: 'Este pedido no está asociado a una empresa B2B.' }, 400)
      }
      const [company] = await sql`
        SELECT id, credit_limit_clp, credit_used_clp FROM b2b_companies WHERE id = ${order.company_id}
      `
      if (!company) return c.json({ error: 'Empresa B2B no encontrada.' }, 404)
      const limit = Number(company.credit_limit_clp ?? 0)
      const used  = Number(company.credit_used_clp ?? 0)
      const available = limit - used
      if (available < Number(order.total)) {
        return c.json({ error: `Cupo de crédito insuficiente (disponible: $${available.toLocaleString('es-CL')}).` }, 400)
      }
      const newUsed = used + Number(order.total)
      await sql`UPDATE b2b_companies SET credit_used_clp = ${newUsed} WHERE id = ${order.company_id}`
      await sql`
        INSERT INTO b2b_credit_movements (company_id, order_id, amount_clp, credit_used_after_clp, notes, created_by)
        VALUES (${order.company_id}, ${order.id}, ${Number(order.total)}, ${newUsed}, ${'Pedido #' + order.number}, ${authUser.id})
      `
    }

    await sql`
      UPDATE orders
      SET payment_status = 'confirmed', payment_method = ${method},
          payment_confirmed_at = NOW(), payment_confirmed_by = ${authUser.id},
          updated_at = NOW()
      WHERE id = ${id}
    `

    // Delivery: si ya hay asignación (staff pudo asignar repartidor antes de
    // coordinar el pago), reflejar el método de cobro para que el repartidor
    // sepa qué hacer en la puerta. No falla el endpoint si no hay ninguna
    // asignación todavía (UPDATE de 0 filas es un no-op válido). Crédito B2B
    // ya quedó cobrado internamente — igual que transferencia, nada que
    // cobrar en la puerta.
    if (method === 'transferencia' || method === 'credito_b2b') {
      await sql`
        UPDATE delivery_assignments
        SET payment_at_door = 'not_required', amount_to_collect = 0, payment_method = NULL, updated_at = NOW()
        WHERE order_id = ${id}
      `
    } else {
      await sql`
        UPDATE delivery_assignments
        SET payment_at_door = 'pending', amount_to_collect = ${order.total}, payment_method = ${method}, updated_at = NOW()
        WHERE order_id = ${id}
      `
    }

    // DTE: emitir Nota de Venta (mismo seam que POS, ver POST /api/orders).
    let dteStatus = order.dte_status
    if (order.dte_status === 'pending') {
      try {
        const items = await sql`
          SELECT oi.product_id, oi.quantity, oi.unit_price, p.name
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ${id}
        `
        const dteReq: DteRequest = {
          type: (order.dte_type ?? 'nota_venta') as DteRequest['type'],
          idempotencyKey: `${id}-1`,
          emitter: {
            rut: STORE_INFO.rut,
            razonSocial: STORE_INFO.name,
            giro: STORE_INFO.giro,
            direccion: STORE_INFO.address,
            comuna: '',
          },
          items: items.map((it: any) => ({
            sku:       it.product_id,
            name:      it.name,
            qty:       Number(it.quantity),
            unitPrice: Number(it.unit_price),
          })),
          payments: [{ method, amount: Number(order.total) }],
          totalNet:   Number(order.total),
          totalIva:   0,
          totalGross: Number(order.total),
        }
        const dteRes = await emitDte(dteReq, { DTE_PROVIDER: 'mock' })
        await sql`
          UPDATE orders SET dte_status = 'issued', dte_provider = 'mock', dte_track_id = ${dteRes.trackId}, updated_at = NOW()
          WHERE id = ${id}
        `
        await sql`
          INSERT INTO dte_events (order_id, attempt, status, provider, request_payload, response_payload)
          VALUES (${id}, 1, 'sent', 'mock', ${dteReq}, ${dteRes})
        `
        dteStatus = 'issued'
      } catch (dteErr) {
        console.error('DTE mock error (confirm-payment):', dteErr)
        await sql`UPDATE orders SET dte_status = 'failed', dte_provider = 'mock', updated_at = NOW() WHERE id = ${id}`
        await sql`
          INSERT INTO dte_events (order_id, attempt, status, provider, error_message)
          VALUES (${id}, 1, 'error', 'mock', ${dteErr instanceof Error ? dteErr.message : String(dteErr)})
        `
        dteStatus = 'failed'
      }
    }

    console.log(`✅ Payment confirmed: order #${order.number} (${method}, dte:${dteStatus})`)
    return c.json({
      ok: true,
      orderId: order.id,
      number: order.number,
      paymentStatus: 'confirmed',
      paymentMethod: method,
      dteStatus,
    })
  } catch (err) {
    console.error('Confirm payment error:', err)
    return c.json({ error: 'Error al confirmar el pago' }, 500)
  }
})

// POST /api/orders/:id/ready — marca un pedido "listo para retirar" y avisa
// al cliente por correo (adición post-entrega, punto 3 del rediseño B2B:
// "falta forma de marcar listo para retirar" — pero aplica a CUALQUIER canal
// con deliveryMode pickup/metro, no solo B2B). Idempotente: un segundo
// llamado no reenvía el correo (devuelve alreadyReady:true).
app.post('/api/orders/:id/ready', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  try {
    const [order] = await sql`
      SELECT o.id, o.number, o.delivery_mode, o.metro_station, o.ready_at, o.company_id,
             c.email AS customer_email, c.name AS customer_name,
             comp.razon_social
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN b2b_companies comp ON comp.id = o.company_id
      WHERE o.id = ${id}
    `
    if (!order) return c.json({ error: 'Pedido no encontrado' }, 404)
    if (!['pickup', 'metro'].includes(order.delivery_mode)) {
      return c.json({ error: 'Solo pedidos de retiro en tienda o Metro usan este flujo.' }, 400)
    }
    if (order.ready_at) {
      return c.json({ ok: true, alreadyReady: true, orderId: order.id, number: order.number })
    }

    await sql`UPDATE orders SET ready_at = NOW(), updated_at = NOW() WHERE id = ${id}`

    // Auto-asignación de repartidor — se deja también acá por si algún día
    // se llama sin pasar por el cambio de status (idempotente, ver
    // autoAssignDriverIfPending). El gancho REAL que de verdad se usa hoy
    // vive en handleOrderStatusUpdate (ver abajo) — ni cerebro ni POS llaman
    // a este endpoint desde el Kanban, usan PATCH .../status arrastrando la
    // tarjeta (hallazgo del 3-sep-2026: por eso la primera versión de este
    // gancho, puesta solo acá, nunca se disparó en producción).
    await autoAssignDriverIfPending(id, order.delivery_mode)

    let place = 'nuestra tienda'
    if (order.delivery_mode === 'metro') {
      const [cfg] = await sql`SELECT value FROM tienda_config WHERE key = 'metro_station_name'`
      place = `la estación ${cfg?.value ?? 'Metro Merval'}`
    }

    if (order.customer_email) {
      const greeting = order.razon_social ? order.razon_social : order.customer_name
      await enqueueEmail(
        order.customer_email,
        `📦 Tu pedido #${order.number} está listo para retirar`,
        `<div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; border-top: 4px solid #d7263d;">
            <h1 style="color: #d7263d; margin-top: 0;">¡Tu pedido está listo!</h1>
            <p style="color: #555; line-height: 1.6;">Hola <strong>${greeting}</strong>, tu pedido <strong>#${order.number}</strong> ya está listo para retirar en ${place}.</p>
          </div>
        </div>`,
        'delivery-update'
      )
    }

    console.log(`✅ Order marked ready: #${order.number}`)
    return c.json({ ok: true, orderId: order.id, number: order.number })
  } catch (err) {
    console.error('Mark order ready error:', err)
    return c.json({ error: 'Error al marcar el pedido como listo' }, 500)
  }
})

// Auto-asignación de repartidor al pasar un pedido a "lista" (adición
// post-entrega, 3-sep-2026). Cubre 'metro' y 'delivery' (el delivery propio
// que se carga desde POS) — ambos ya tienen su fila en delivery_assignments
// creada automáticamente al hacer el pedido (fix de la sesión anterior);
// acá solo se le busca conductor si sigue 'pending' sin asignar. 'pickup'
// (retira el propio cliente) y 'shipping' (Chilexpress, no usa repartidor
// propio) no llaman esto. Si nadie tiene turno abierto, la entrega queda
// 'pending' igual que hoy — el staff la asigna a mano desde Despacho, nunca
// bloquea el flujo de marcar listo.
async function autoAssignDriverIfPending(orderId: string, deliveryMode: string) {
  if (!['metro', 'delivery'].includes(deliveryMode)) return
  try {
    const [pendingAssignment] = await sql`
      SELECT id FROM delivery_assignments
      WHERE order_id = ${orderId} AND status = 'pending' AND driver_id IS NULL
    `
    if (pendingAssignment) {
      const driverId = await pickActiveDriver()
      if (driverId) await assignDriverToAssignment(pendingAssignment.id, driverId)
    }
  } catch (assignErr) {
    console.error('Auto-assign driver error:', assignErr)
  }
}

// POST /api/orders/:id/status
// También registrado como PATCH: apps/cerebro/.../comandas/page.tsx (drag-and-drop
// del Kanban, agregado en S04) llama PATCH en vez de POST — mismo handler, dos
// métodos, para no romper ningún consumidor existente que ya use POST.
async function handleOrderStatusUpdate(c: any) {
  try {
    const { id } = c.req.param()
    const { status, customer_email, eta } = await c.req.json()
    if (!status) return c.json({ error: 'Missing status' }, 400)

    // Bug real cerrado (adición post-entrega, 3-sep-2026 — el dueño reportó
    // que nunca llegan correos de actualización de estado): este endpoint
    // SOLO enviaba el correo si el body incluía `customer_email` — y
    // apps/cerebro/.../comandas/page.tsx handleMove() (el único caller real,
    // vía drag-and-drop del Kanban) nunca lo manda (`{ status }`, sin
    // email). El mecanismo de envío funcionaba perfecto, simplemente nunca
    // se disparaba porque dependía de un dato que el caller nunca pasó.
    // Ahora se resuelve el email del propio pedido — ya no depende de que
    // ningún frontend se acuerde de mandarlo. `customer_email` del body se
    // conserva como override manual (ej. un futuro flujo que quiera avisar
    // a otra dirección), pero deja de ser la única fuente.
    const [order] = await sql`
      UPDATE orders SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, number, guest_email, delivery_mode,
        (SELECT email FROM customers WHERE id = orders.customer_id) AS customer_email
    `

    if (!order) return c.json({ error: 'Order not found' }, 404)

    // Auto-asignación de repartidor (adición post-entrega, 3-sep-2026 —
    // pedido explícito del dueño: "cuando le dé listo se asigne el
    // delivery, según los que estén activos en ese turno"). ESTE es el
    // gancho real — arrastrar la tarjeta a "Lista" en el Kanban (cerebro Y
    // POS) es lo único que ambos frontends de verdad llaman; la primera
    // versión de este gancho vivía solo en POST .../ready (el botón
    // "marcar listo para retirar"), que nunca se usa desde el Kanban — por
    // eso nunca se disparó en producción pese a estar desplegado.
    if (status === 'lista') {
      await autoAssignDriverIfPending(order.id, order.delivery_mode)
    }

    const resolvedEmail = customer_email || order.guest_email || order.customer_email

    let queue_id: string | undefined
    if (resolvedEmail) {
      // order_status enum real: 'nueva' | 'preparando' | 'lista' | 'en_ruta' | 'entregada' | 'cancelada'
      const emailType = status === 'en_ruta' ? 'order-shipped'
        : status === 'entregada' ? 'order-delivered'
        : 'delivery-update'
      queue_id = await enqueueEmail(
        resolvedEmail,
        `Actualización: Orden #${order.number}`,
        templates.orderStatus(order, status, eta),
        emailType
      )
    }

    console.log(`✅ Order status: #${order.number} → ${status}${resolvedEmail ? ` (correo a ${resolvedEmail})` : ' (sin email para notificar)'}`)
    return c.json({ ok: true, status, queue_id })
  } catch (err) {
    console.error('Status error:', err)
    return c.json({ error: 'Error' }, 500)
  }
}
app.post('/api/orders/:id/status', handleOrderStatusUpdate)
app.patch('/api/orders/:id/status', handleOrderStatusUpdate)

// POST /api/orders/:id/void (gap crítico — apps/pos/.../void-auth-modal.tsx
// ya lo llama, 404 hoy: "Anular venta" del drawer de POS). Cubierto además
// por el `app.use('/api/orders*', requireAuthMiddleware)` de arriba (acepta
// API key O cookie de sesión) — el requireSession de acá adentro es el que
// filtra por ROL, mismo patrón ya usado por GET /api/orders más abajo.
//
// PIN: usa 'void_pin' en tienda_config — clave DISTINTA de 'analytics_pin'
// (ver comentario en POST /api/analytics/pin-check). Solo se LEE para
// comparar, nunca se sobreescribe acá — el incidente de S16 (void_pin real
// pisado durante pruebas) fue justo al revés (un PUT de prueba), no aplica a
// este endpoint de solo lectura del PIN.
//
// Inventario: POST /api/orders (crear venta) no descuenta `inventory` en
// ningún punto del código hoy (confirmado por grep) — así que anular NO
// necesita revertir stock, no hay nada que revertir todavía. Si en el futuro
// se agrega descuento de inventario al crear la venta, este endpoint deberá
// revertirlo también.
//
// Rate limit: el PIN es de pocos dígitos — 10 intentos/5min por usuario,
// mismo criterio que analytics:pin-check (S14).
app.post('/api/orders/:id/void', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()

  const rl = await checkAndRecordRateLimit(c, 'orders:void', { limit: 10, windowMinutes: 5 }, authUser.id)
  if (!rl.allowed) {
    return c.json({ error: `Demasiados intentos. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'JSON inválido' }, 400) }
  const pin    = String(body.pin ?? '')
  const reason = String(body.reason ?? '').trim()
  if (!pin) return c.json({ error: 'PIN requerido' }, 400)
  if (!reason) return c.json({ error: 'Motivo de anulación requerido' }, 400)

  try {
    const [pinRow] = await sql`SELECT value FROM tienda_config WHERE key = 'void_pin'`
    // Sin PIN configurado todavía → deniega por defecto, mismo criterio que
    // analytics_pin (nunca un fallback hardcodeado tipo '1234').
    if (!pinRow?.value || pinRow.value !== pin) {
      return c.json({ error: 'PIN incorrecto' }, 403)
    }

    const [order] = await sql`SELECT id, number, status, total FROM orders WHERE id = ${id}`
    if (!order) return c.json({ error: 'Pedido no encontrado' }, 404)
    if (order.status === 'cancelada') return c.json({ error: 'El pedido ya estaba anulado' }, 409)

    await sql`
      UPDATE orders
      SET status = 'cancelada', voided_by = ${authUser.id}, voided_at = NOW(), void_reason = ${reason}, updated_at = NOW()
      WHERE id = ${id}
    `

    await sql`
      INSERT INTO pos_void_events (order_id, voided_by, reason, amount_clp)
      VALUES (${id}, ${authUser.id}, ${reason}, ${Math.round(Number(order.total))})
    `

    await recordAuditLog(c, authUser, 'order.void', { table: 'orders', id }, {
      number: order.number, reason, amount: order.total,
    })

    // SSE — otras terminales POS deben reflejar la anulación en vivo (mismo
    // canal 'pos' que order.created).
    emitPosEvent({
      type: 'order.voided',
      channel: 'pos',
      payload: { orderId: id, number: order.number, voidedBy: authUser.name, reason, voidedAt: new Date().toISOString() },
    })

    console.log(`🗑️  Order voided: #${order.number} by ${authUser.email} (${reason})`)
    return c.json({ ok: true, orderId: id, number: order.number })
  } catch (err) {
    console.error('Void order error:', err)
    return c.json({ error: 'Error al anular el pedido' }, 500)
  }
})

// POST /api/deliveries/:id/photo
app.post('/api/deliveries/:id/photo', async (c) => {
  try {
    const { id } = c.req.param()
    const { customer_email } = await c.req.json()

    const [assignment] = await sql`SELECT * FROM delivery_assignments WHERE id = ${id}`
    if (!assignment) return c.json({ error: 'Delivery not found' }, 404)

    // Save pod
    await sql`
      INSERT INTO delivery_pods (assignment_id, r2_key, captured_at, uploaded_at)
      VALUES (${id}, ${'pods/' + assignment.order_id + '/photo.jpg'}, NOW(), NOW())
    `

    // Update delivery & order
    await sql`UPDATE delivery_assignments SET status = 'delivered', delivered_at = NOW() WHERE id = ${id}`
    const [order] = await sql`UPDATE orders SET status = 'entregada' WHERE id = ${assignment.order_id} RETURNING number`

    let queue_id: string | undefined
    if (customer_email) {
      queue_id = await enqueueEmail(
        customer_email,
        `✅ Entregado: Orden #${order.number}`,
        templates.deliveryPhoto(order),
        'order-delivered'
      )
    }

    console.log(`✅ Delivery completed`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    console.error('Photo error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// B2B ENDPOINTS (3 emails)
// ============================================================================

// Proteger endpoints B2B — requieren autenticación
// NOTA (S11, Fase 3): estrechado de '/api/b2b*' a '/api/b2b/quotes*'. El wildcard
// original protegía correctamente las 3 rutas que existían hasta hoy (todas bajo
// /api/b2b/quotes) exigiendo API key con scope orders:write o sesión STAFF — pero
// como Hono compone TODOS los middlewares cuyo patrón matchea la ruta de la
// request (sin importar en qué orden del archivo se registran los handlers
// específicos), ese wildcard habría bloqueado con 401 cualquier ruta nueva bajo
// /api/b2b/* añadida más abajo (registro público, catálogo/empresa/wallet con
// sesión de CLIENTE, no de staff) antes de que sus propios handlers pudieran
// siquiera evaluar la sesión de cliente. Estrechar el patrón no cambia el
// comportamiento de ninguna ruta que ya funcionaba (las 3 de /quotes siguen
// exactamente igual de protegidas) — cero regresión.
app.use('/api/b2b/quotes*', requireAuthMiddleware)
app.use('/api/b2b/quotes*', requireScopeMiddleware(['orders:write']))

// POST /api/b2b/quotes
app.post('/api/b2b/quotes', async (c) => {
  // Rate limit (S02, bloqueador P0 #3): 20 cotizaciones / 5 min por usuario o IP.
  const rl = await checkAndRecordRateLimit(c, 'b2b/quotes:create', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const { company_id, buyer_name, buyer_email, items, total, valid_days } = await c.req.json()
    if (!company_id || !buyer_email) return c.json({ error: 'Missing fields' }, 400)

    const quote_number = Math.floor(Math.random() * 100000)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (valid_days || 7))

    await sql`
      INSERT INTO b2b_quotes (number, company_id, buyer_name, buyer_email, status, items, subtotal, total, valid_until_at, sent_at)
      VALUES (${quote_number}, ${company_id}, ${buyer_name}, ${buyer_email}, 'sent', ${JSON.stringify(items)}, ${total}, ${total}, ${validUntil}, NOW())
    `

    const queueIdBuyer = await enqueueEmail(
      buyer_email,
      `📋 Cotización #${quote_number}`,
      templates.quote({ number: quote_number, total, validUntilAt: validUntil.toLocaleDateString('es-CL') }),
      'quote-sent'
    )

    const queueIdAdmin = await enqueueEmail(
      ADMIN_EMAIL,
      `📋 Cotización #${quote_number} enviada`,
      `<p>Cotización enviada a ${buyer_email}</p>`,
      'quote-sent'
    )

    console.log(`✅ Quote: #${quote_number}`)
    return c.json({ ok: true, quote_number, queue_ids: [queueIdBuyer, queueIdAdmin] })
  } catch (err) {
    console.error('Quote error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/b2b/quotes/:id/accept
app.post('/api/b2b/quotes/:id/accept', async (c) => {
  try {
    const { id } = c.req.param()
    const [quote] = await sql`
      UPDATE b2b_quotes SET status = 'accepted', accepted_at = NOW()
      WHERE id = ${id}
      RETURNING number, buyer_email
    `

    if (!quote) return c.json({ error: 'Quote not found' }, 404)

    const queue_id = await enqueueEmail(
      quote.buyer_email,
      `✅ Cotización #${quote.number} Aceptada`,
      `<p>Tu cotización ha sido aceptada. Procederemos con la orden.</p>`,
      'quote-accepted'
    )

    console.log(`✅ Quote accepted`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/b2b/quotes/:id/reject
app.post('/api/b2b/quotes/:id/reject', async (c) => {
  try {
    const { id } = c.req.param()
    const { reason } = await c.req.json()
    const [quote] = await sql`
      UPDATE b2b_quotes SET status = 'rejected', rejected_at = NOW(), rejection_reason = ${reason}
      WHERE id = ${id}
      RETURNING number, buyer_name
    `

    if (!quote) return c.json({ error: 'Quote not found' }, 404)

    const queue_id = await enqueueEmail(
      ADMIN_EMAIL,
      `❌ Cotización #${quote.number} Rechazada`,
      `<p>Rechazada por ${quote.buyer_name}. Razón: ${reason || 'No especificada'}</p>`,
      'quote-rejected'
    )

    console.log(`✅ Quote rejected`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// PORTAL B2B — empresa mayorista (S11, Fase 3)
// ============================================================================
// DECISIÓN DE ARQUITECTURA (verificada contra el modelo de datos antes de
// escribir código): el portal B2B usa EXACTAMENTE la misma sesión de cliente
// que B2C (`seul_customer_session` / requireCustomerSession) — NO existe un
// login ni una cookie propios para empresas. `b2b_companies.customer_id` es
// NOT NULL y apunta a una sola fila de `customers` (un dueño/contacto por
// empresa, no varios usuarios por empresa — packages/db/src/schema/customers.ts).
// Confirma la decisión: apps/web/.../b2b/login/page.tsx (escrito antes de esta
// sesión) ya llama /api/customer/login + /api/customer/me, y el comentario de
// CUSTOMER AUTH ENDPOINTS más arriba (línea ~608) ya decía "tienda B2C y portal
// B2B comparten la misma tabla customers / mismo login" — esta sesión solo
// construye el backend que faltaba, no inventa el diseño.
//
// requireB2BCompany(c) es el "requireB2BSession" del brief: llama a
// requireCustomerSession y resuelve la empresa asociada a ese customerId. Un
// cliente B2C normal (sesión de cliente válida, pero sin empresa) recibe 403 —
// así nunca puede alcanzar precios/datos B2B con su propia sesión, que es el
// requisito de aislamiento explícito de esta sesión.
async function requireB2BCompany(c: any): Promise<
  | { customer: { customerId: string; email: string; name: string }; company: any }
  | Response
> {
  const customer = await requireCustomerSession(c)
  if (customer instanceof Response) return customer

  const [company] = await sql`
    SELECT id, customer_id, razon_social, rut, giro, address, tier, status,
           credit_limit_clp, credit_used_clp, wallet_balance_clp, payment_days,
           created_at, approved_at
    FROM b2b_companies
    WHERE customer_id = ${customer.customerId}
    ORDER BY created_at ASC
    LIMIT 1
  `
  if (!company) {
    return c.json({ error: 'Tu cuenta no tiene una empresa B2B asociada.' }, 403)
  }
  return { customer, company }
}

// POST /api/b2b/registro — solicitud de cuenta mayorista, PÚBLICA (sin sesión)
// — apps/web/.../b2b/registro/page.tsx. Mismo patrón "reclamar cliente
// fantasma" que POST /api/customer/register (S09): customers.email es UNIQUE.
//
// DECISIÓN: a diferencia del registro B2C (donde reclamar un fantasma sin
// password es el único caso), aquí hay 3 casos posibles para el email
// recibido: (1) no existe → se crea con password temporal; (2) existe pero SIN
// password (fantasma de POS/checkout invitado) → se reclama con password
// temporal, igual que S09; (3) existe CON password (ya es cliente B2C activo)
// → NO se pisa su password (lo dejaría fuera de su cuenta actual), solo se le
// asocia la empresa nueva a su customer_id existente. En los 3 casos la cuenta
// queda logueable de inmediato — no existe hoy una pantalla en cerebro para
// "aprobar" el registro de una EMPRESA nueva (solo existe para solicitudes de
// CRÉDITO, ver /api/b2b/solicitudes más abajo, confirmado por grep antes de
// escribir esto), así que gatear el login detrás de una aprobación que ningún
// botón puede otorgar dejaría a todo registrante bloqueado para siempre.
// `status` de la empresa queda en 'pending' igual — el copy del formulario
// ("te contactaremos… para activar tu cuenta") se entiende como activar el
// CANAL DE PEDIDOS por WhatsApp, no el acceso al portal. Documentado como
// decisión de esta sesión, no como bug.
app.post('/api/b2b/registro', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const razonSocial = String(body.razonSocial || '').trim()
  const rutRaw = String(body.rut || '').trim()
  const giro = String(body.giro || '').trim()
  const address = String(body.address || '').trim()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const phone = body.phone ? String(body.phone).trim() : null

  if (!razonSocial || !rutRaw || !giro || !address || !name || !email) {
    return c.json({ ok: false, error: 'Completa todos los campos obligatorios.' }, 400)
  }
  if (!isValidEmail(email)) {
    return c.json({ ok: false, error: 'Correo electrónico inválido.' }, 400)
  }
  if (!isValidRUT(rutRaw)) {
    return c.json({ ok: false, error: 'RUT de empresa inválido.' }, 400)
  }
  const rut = normalizeRUT(rutRaw)

  const rl = await checkAndRecordRateLimit(c, 'b2b:registro', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const [existingCompany] = await sql`SELECT id FROM b2b_companies WHERE rut = ${rut} LIMIT 1`
    if (existingCompany) {
      return c.json({ ok: false, error: 'Ya existe una empresa registrada con ese RUT.' }, 409)
    }

    const existing = await sql`
      SELECT id, password_hash FROM customers WHERE lower(email) = ${email} AND deleted_at IS NULL LIMIT 1
    `

    if (existing.length > 0) {
      const [ownedCompany] = await sql`SELECT id FROM b2b_companies WHERE customer_id = ${existing[0].id} LIMIT 1`
      if (ownedCompany) {
        return c.json({ ok: false, error: 'Ya existe una cuenta B2B con este correo.' }, 409)
      }
    }

    let customerId: string
    let tempPassword: string | null = null

    if (existing.length > 0 && existing[0].password_hash) {
      // Caso 3: ya es cliente activo (B2C) — no se toca su password.
      customerId = existing[0].id
    } else if (existing.length > 0) {
      // Caso 2: fantasma sin password — reclamar, mismo criterio que S09.
      customerId = existing[0].id
      tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
      const passwordHash = PasswordService.hashPassword(tempPassword)
      await sql`
        UPDATE customers
        SET name = ${name}, phone = COALESCE(${phone}, phone),
            password_hash = ${passwordHash}, must_change_password = true
        WHERE id = ${customerId}
      `
    } else {
      // Caso 1: nuevo.
      tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
      const passwordHash = PasswordService.hashPassword(tempPassword)
      const [created] = await sql`
        INSERT INTO customers (email, name, phone, password_hash, must_change_password, email_verified, created_channel)
        VALUES (${email}, ${name}, ${phone}, ${passwordHash}, true, false, 'b2b')
        RETURNING id
      `
      customerId = created.id
    }

    await sql`
      INSERT INTO b2b_companies (customer_id, razon_social, rut, giro, address, status, tier)
      VALUES (${customerId}, ${razonSocial}, ${rut}, ${giro}, ${address}, 'pending', 'hoobae')
    `

    const credentialsBlock = tempPassword
      ? `<div style="background: #f0f0f0; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #888;"><small>Ya puedes entrar a tu Portal Mayorista con estas credenciales:</small></p>
          <p style="margin: 5px 0; font-family: monospace; font-size: 14px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0; font-family: monospace; font-size: 14px;"><strong>Contraseña temporal:</strong> ${tempPassword}</p>
        </div>`
      : `<p style="color: #555;">Ya puedes entrar al Portal Mayorista con tu correo y contraseña habituales.</p>`

    await enqueueEmail(
      email,
      '¡Solicitud recibida! — Portal Mayorista Seoul Shop',
      `<div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: white; padding: 30px; border-radius: 8px; border-top: 4px solid #d7263d;">
          <h1 style="color: #d7263d; margin-top: 0;">¡Solicitud recibida!</h1>
          <p style="color: #555; line-height: 1.6;">Hola <strong>${name}</strong>, tu solicitud de cuenta mayorista para <strong>${razonSocial}</strong> fue recibida. Te contactaremos por correo en 24–48 horas hábiles.</p>
          ${credentialsBlock}
          <div style="margin: 30px 0;">
            <a href="${CUSTOMER_WEB_URL}/b2b/login" style="display: inline-block; background: #d7263d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir al Portal Mayorista →</a>
          </div>
        </div>
      </div>`,
      'welcome'
    )

    await enqueueEmail(
      ADMIN_EMAIL,
      `🏢 Nueva solicitud B2B — ${razonSocial}`,
      `<p>Nueva empresa mayorista registrada: <strong>${razonSocial}</strong> (${rut}). Contacto: ${name} · ${email}${phone ? ' · ' + phone : ''}.</p>`,
      'contact-form-reply'
    )

    return c.json({ ok: true })
  } catch (err: any) {
    console.error('B2B registro error:', err)
    if (err?.code === '23505') {
      return c.json({ ok: false, error: 'Ya existe una empresa o cuenta con esos datos.' }, 409)
    }
    return c.json({ ok: false, error: 'No se pudo enviar la solicitud.' }, 500)
  }
})

// POST /api/b2b/postventa — apps/web/.../b2b/postventa/page.tsx. Adición
// post-entrega (3-sep-2026): esa pantalla NUNCA guardaba nada — solo abría
// un link de WhatsApp con el mensaje armado, cero persistencia en el
// sistema. Ahora se guarda en b2b_credit... perdón, b2b_postventa_requests
// (migración 0024b) y se avisa al staff por correo, mismo patrón que
// POST /api/b2b/registro de arriba.
app.post('/api/b2b/postventa', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { customer, company } = session

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'JSON inválido' }, 400) }

  const VALID_ISSUE_TYPES = ['return', 'exchange', 'complaint', 'missing_item']
  const issueType = body.issueType
  const description = String(body.description || '').trim()
  if (!VALID_ISSUE_TYPES.includes(issueType)) return c.json({ error: 'Tipo de solicitud inválido' }, 400)
  if (!description) return c.json({ error: 'Describe el problema' }, 400)

  const orderNumber = body.orderNumber ? String(body.orderNumber).trim() : null
  const contactPhone = body.contactPhone ? String(body.contactPhone).trim() : null

  try {
    await sql`
      INSERT INTO b2b_postventa_requests (company_id, issue_type, order_number, description, contact_phone)
      VALUES (${company.id}, ${issueType}, ${orderNumber}, ${description}, ${contactPhone})
    `

    const ISSUE_LABELS: Record<string, string> = {
      return: 'Devolución de producto', exchange: 'Cambio de producto',
      complaint: 'Reclamo / calidad', missing_item: 'Producto faltante',
    }
    await enqueueEmail(
      ADMIN_EMAIL,
      `📋 Postventa B2B — ${ISSUE_LABELS[issueType]} — ${company.razon_social}`,
      `<p><strong>${company.razon_social}</strong> (${company.rut}) — ${ISSUE_LABELS[issueType]}</p>
       ${orderNumber ? `<p>Pedido: #${orderNumber}</p>` : ''}
       <p>${description}</p>
       <p>Contacto: ${customer.email}${contactPhone ? ' · ' + contactPhone : ''}</p>`,
      'contact-form-reply'
    )

    return c.json({ ok: true })
  } catch (err) {
    console.error('B2B postventa error:', err)
    return c.json({ error: 'No se pudo enviar la solicitud.' }, 500)
  }
})

// GET /api/b2b/empresa/me — apps/web/.../b2b/dashboard/page.tsx
app.get('/api/b2b/empresa/me', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  const limit = Number(company.credit_limit_clp ?? 0)
  const used = Number(company.credit_used_clp ?? 0)
  const creditPct = limit > 0 ? Math.round((used / limit) * 100) : 0

  return c.json({
    id: company.id,
    razonSocial: company.razon_social,
    rut: company.rut,
    giro: company.giro,
    address: company.address,
    tier: company.tier,
    status: company.status,
    creditLimitClp: limit,
    creditUsedClp: used,
    walletBalanceClp: Number(company.wallet_balance_clp ?? 0),
    paymentDays: Number(company.payment_days ?? 0),
    customerId: company.customer_id,
    creditPct,
  })
})

// GET /api/b2b/catalogo — precios netos mayoristas. SOLO empresa autenticada
// (nunca público anónimo, nunca cliente B2C normal — requisito explícito de
// esta sesión). apps/web/.../b2b/catalogo/page.tsx corre como Server Component
// y reenvía la cookie de sesión a mano (mismo patrón que serverFetch de
// apps/cerebro/src/lib/api.ts — no una excepción nueva).
app.get('/api/b2b/catalogo', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session

  const q = c.req.query('q')?.trim()
  const qCond = q
    ? sql`AND (p.name ILIKE ${'%' + q + '%'} OR p.sku ILIKE ${'%' + q + '%'} OR p.brand ILIKE ${'%' + q + '%'})`
    : sql``

  try {
    const rows = await sql`
      SELECT p.id, p.sku, p.slug, p.name, p.brand, p.price_retail, p.price_b2b,
             p.cold_chain, p.is_baes_eligible, p.weight_grams,
             COALESCE(stock.qty_total, 0) AS stock_total
      FROM products p
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.quantity), 0) AS qty_total FROM inventory i WHERE i.product_id = p.id
      ) stock ON true
      WHERE p.status = 'active' AND p.price_b2b IS NOT NULL ${qCond}
      ORDER BY p.name ASC
      LIMIT 500
    `

    return c.json({
      products: rows.map((r: any) => ({
        id: r.id, sku: r.sku, slug: r.slug, name: r.name, brand: r.brand,
        priceRetail: Number(r.price_retail), priceB2B: Number(r.price_b2b),
        coldChain: r.cold_chain, isBaesEligible: r.is_baes_eligible,
        weightGrams: r.weight_grams, stock: Number(r.stock_total),
      })),
    })
  } catch (err) {
    console.error('B2B catálogo error:', err)
    return c.json({ error: 'Error al listar catálogo B2B' }, 500)
  }
})

// POST /api/b2b/credit-request — apps/web/.../b2b/credito/page.tsx. company_id
// SIEMPRE de la sesión (nunca del body) — mismo criterio que S10 con
// customerId en /api/public/orders: una empresa no puede solicitar crédito a
// nombre de otra adivinando su UUID. (El frontend anterior a esta sesión
// mandaba un companyId tecleado a mano en un input de texto — se corrigió en
// el mismo commit, ver apps/web/.../b2b/credito/page.tsx).
app.post('/api/b2b/credit-request', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const amountClp = parseInt(body.amountClp, 10)
  const reason = body.reason ? String(body.reason).trim() : null

  if (!amountClp || amountClp <= 0) {
    return c.json({ ok: false, error: 'Monto inválido.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'b2b:credit-request', { limit: 20, windowMinutes: 5 }, company.id)
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const [created] = await sql`
      INSERT INTO b2b_credit_requests (company_id, amount_clp, reason, status)
      VALUES (${company.id}, ${amountClp}, ${reason}, 'pending')
      RETURNING id
    `

    await enqueueEmail(
      ADMIN_EMAIL,
      `💳 Solicitud de crédito B2B — ${company.razon_social}`,
      `<p><strong>${company.razon_social}</strong> (${company.rut}) solicitó ${amountClp.toLocaleString('es-CL')} CLP de crédito. Motivo: ${reason || 'No especificado'}.</p>`,
      'contact-form-reply'
    )

    return c.json({ ok: true, id: created.id })
  } catch (err) {
    console.error('B2B credit-request error:', err)
    return c.json({ ok: false, error: 'No se pudo enviar la solicitud.' }, 500)
  }
})

// GET /api/b2b/credit-requests/:id — detalle de una solicitud. Accesible por
// la empresa dueña (sesión B2B) o por staff owner/admin (mismo consumidor
// potencial que /api/b2b/solicitudes, aunque hoy ningún frontend llama este
// endpoint puntual — se construye igual porque el plan lo pide explícitamente
// y GET /api/b2b/wallet/:id ya establece el mismo criterio de :id-vs-sesión).
app.get('/api/b2b/credit-requests/:id', async (c) => {
  const id = c.req.param('id')

  const staffUser = await getOptionalSession(c)
  if (staffUser && ['owner', 'admin'].includes(staffUser.role)) {
    const [row] = await sql`
      SELECT cr.id, cr.company_id, cr.amount_clp, cr.approved_amount_clp,
             cr.commission_pct, cr.commission_clp, cr.reason, cr.status,
             cr.reviewed_at, cr.reviewer_note, cr.created_at,
             comp.razon_social, comp.rut
      FROM b2b_credit_requests cr
      JOIN b2b_companies comp ON comp.id = cr.company_id
      WHERE cr.id = ${id}
      LIMIT 1
    `
    if (!row) return c.json({ error: 'Solicitud no encontrada' }, 404)
    return c.json({
      id: row.id, companyId: row.company_id, amountClp: Number(row.amount_clp),
      approvedAmountClp: row.approved_amount_clp !== null ? Number(row.approved_amount_clp) : null,
      commissionPct: row.commission_pct !== null ? Number(row.commission_pct) : null,
      commissionClp: row.commission_clp !== null ? Number(row.commission_clp) : null,
      reason: row.reason, status: row.status, reviewedAt: row.reviewed_at,
      reviewerNote: row.reviewer_note, createdAt: row.created_at,
      razonSocial: row.razon_social, rut: row.rut,
    })
  }

  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  const [row] = await sql`
    SELECT id, company_id, amount_clp, approved_amount_clp, commission_pct, commission_clp,
           reason, status, reviewed_at, reviewer_note, created_at
    FROM b2b_credit_requests
    WHERE id = ${id} AND company_id = ${company.id}
    LIMIT 1
  `
  if (!row) return c.json({ error: 'Solicitud no encontrada' }, 404)
  return c.json({
    id: row.id, companyId: row.company_id, amountClp: Number(row.amount_clp),
    approvedAmountClp: row.approved_amount_clp !== null ? Number(row.approved_amount_clp) : null,
    commissionPct: row.commission_pct !== null ? Number(row.commission_pct) : null,
    commissionClp: row.commission_clp !== null ? Number(row.commission_clp) : null,
    reason: row.reason, status: row.status, reviewedAt: row.reviewed_at,
    reviewerNote: row.reviewer_note, createdAt: row.created_at,
  })
})

// Resuelve acceso dual (staff owner/admin, o la empresa dueña de la
// solicitud) para los endpoints de documentos de crédito B2B de abajo. No usa
// requireB2BCompany() directo porque necesita permitir TAMBIÉN acceso staff
// sin fallar primero — mismo patrón ya usado en GET /api/b2b/credit-requests/:id.
async function resolveCreditRequestAccess(c: any, requestId: string): Promise<
  | { ok: true; requestRow: any; actor: { id: string | null; email: string; role: string } }
  | Response
> {
  const [reqRow] = await sql`
    SELECT cr.id, cr.company_id, cr.status, comp.razon_social, comp.customer_id
    FROM b2b_credit_requests cr
    JOIN b2b_companies comp ON comp.id = cr.company_id
    WHERE cr.id = ${requestId}
    LIMIT 1
  `
  if (!reqRow) return c.json({ error: 'Solicitud no encontrada' }, 404)

  const staffUser = await getOptionalSession(c)
  if (staffUser && ['owner', 'admin'].includes(staffUser.role)) {
    return { ok: true, requestRow: reqRow, actor: { id: staffUser.id, email: staffUser.email, role: staffUser.role } }
  }

  const customer = await getOptionalCustomerSession(c)
  if (customer) {
    const [company] = await sql`SELECT id FROM b2b_companies WHERE id = ${reqRow.company_id} AND customer_id = ${customer.customerId}`
    if (company) {
      return { ok: true, requestRow: reqRow, actor: { id: null, email: customer.email, role: 'b2b_company' } }
    }
  }

  return c.json({ error: 'No autorizado' }, 403)
}

// GET /api/b2b/credit-requests/:id/documents — lista documentos de respaldo
// (cédula/RUT empresa, respaldo financiero) subidos para una solicitud.
// Acceso dual: staff owner/admin (revisando para aprobar) o la empresa dueña
// (portal B2B, viendo lo que ya subió). Adición post-entrega — punto 2 del
// flujo de aprobación de crédito B2B pedido por el dueño: "antes de aprobar
// un crédito, deben poder subirse documentos importantes".
app.get('/api/b2b/credit-requests/:id/documents', async (c) => {
  const id = c.req.param('id')
  const access = await resolveCreditRequestAccess(c, id)
  if (access instanceof Response) return access

  try {
    const rows = await sql`
      SELECT id, filename, original_name, uploaded_by, uploaded_at
      FROM b2b_credit_documents
      WHERE request_id = ${id}
      ORDER BY uploaded_at ASC
    `
    return c.json({
      documents: rows.map((r: any) => ({
        id: r.id,
        originalName: r.original_name ?? r.filename,
        url: `${API_PUBLIC_URL}/b2b-docs/${r.filename}`,
        uploadedAt: r.uploaded_at,
      })),
    })
  } catch (err) {
    console.error('List B2B credit documents error:', err)
    return c.json({ error: 'Error al listar documentos' }, 500)
  }
})

// POST /api/b2b/credit-requests/:id/documents — sube 1 documento de respaldo
// (multipart, campo "file"). Mismo patrón pragmático de disco local que
// POST /api/products/:productId/images (sin R2 configurado hoy). No se
// permite subir documentos a una solicitud ya revisada (approved/rejected) —
// no tendría efecto sobre una decisión ya tomada.
app.post('/api/b2b/credit-requests/:id/documents', async (c) => {
  const id = c.req.param('id')
  const access = await resolveCreditRequestAccess(c, id)
  if (access instanceof Response) return access
  if (access.requestRow.status !== 'pending') {
    return c.json({ error: 'Esta solicitud ya fue revisada, no se pueden agregar más documentos.' }, 409)
  }

  try {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) return c.json({ error: 'Falta el documento (campo "file")' }, 400)
    if (file.size === 0) return c.json({ error: 'Archivo vacío' }, 400)
    if (file.size > 8 * 1024 * 1024) return c.json({ error: 'Documento demasiado grande (máx 8MB)' }, 400)

    const EXT_BY_MIME: Record<string, string> = {
      'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    }
    const ext = EXT_BY_MIME[file.type]
    if (!ext) return c.json({ error: 'Formato no soportado (usa PDF, JPG, PNG o WebP)' }, 400)

    const filename = `${id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`

    fs.mkdirSync(B2B_DOC_UPLOAD_DIR, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(B2B_DOC_UPLOAD_DIR, filename), buf)

    const originalName = (body['originalName'] as string) || (file as any).name || filename

    const [created] = await sql`
      INSERT INTO b2b_credit_documents (request_id, filename, original_name, uploaded_by)
      VALUES (${id}, ${filename}, ${String(originalName).slice(0, 255)}, ${access.actor.id})
      RETURNING id, uploaded_at
    `

    return c.json({
      ok: true,
      id: created.id,
      url: `/b2b-docs/${filename}`,
      uploadedAt: created.uploaded_at,
    })
  } catch (err) {
    console.error('Upload B2B credit document error:', err)
    return c.json({ error: 'Error al subir el documento' }, 500)
  }
})

// PATCH /api/b2b/credit-requests/:id/review — SOLO `owner` (pedido explícito
// del dueño: "solo el jefe/gerente puede aprobar una cuenta B2B y, si quiere,
// aprobarle una línea de crédito"). Antes de esta sesión aceptaba
// owner+admin; se estrecha a owner porque el brief lo pidió sin ambigüedad —
// `admin` conserva acceso de SOLO LECTURA (GET /api/b2b/solicitudes y
// GET .../credit-requests/:id siguen aceptando owner+admin, sin cambios) pero
// ya no puede ejecutar la aprobación/rechazo. Decisión documentada acá y en
// el plan maestro.
//
// Cambios de esta sesión (flujo de aprobación de crédito B2B):
//   - `approvedAmountClp` opcional en el body: el ejecutivo puede aprobar un
//     monto DISTINTO al solicitado (no solo aceptar/rechazar el monto pedido
//     tal cual) — si se omite, se usa el monto solicitado (amount_clp) como
//     antes. Validado: si se aprueba, el monto aprobado debe ser >= $100.000
//     (piso pedido explícitamente por el dueño; no hay techo — "hasta un
//     monto que decida el ejecutivo").
//   - Comisión: se calcula sobre el monto APROBADO usando el % vigente en
//     tienda_config (key 'b2b_credit_commission_pct', default '2' = 2% si el
//     dueño nunca lo configuró) — se guarda como snapshot en
//     commission_pct/commission_clp de la fila, para no cambiar
//     retroactivamente si el % default se edita después de aprobar. Ver
//     Ajustes/tienda_config para el campo editable.
//   - El monto acreditado en la wallet (b2b_wallet_ledger +
//     b2b_companies.wallet_balance_clp) ahora es el monto APROBADO, no el
//     solicitado — cambio de comportamiento deliberado vs. antes de esta sesión.
app.patch('/api/b2b/credit-requests/:id/review', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  const id = c.req.param('id')
  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const status = body.status
  const reviewerNote = body.reviewerNote ? String(body.reviewerNote).trim() : null

  if (!['approved', 'rejected'].includes(status)) {
    return c.json({ error: 'status debe ser approved o rejected' }, 400)
  }

  const MIN_APPROVED_AMOUNT_CLP = 100_000

  try {
    const [reqRow] = await sql`
      SELECT cr.id, cr.company_id, cr.amount_clp, cr.status, comp.razon_social, comp.customer_id
      FROM b2b_credit_requests cr
      JOIN b2b_companies comp ON comp.id = cr.company_id
      WHERE cr.id = ${id}
      LIMIT 1
    `
    if (!reqRow) return c.json({ error: 'Solicitud no encontrada' }, 404)
    if (reqRow.status !== 'pending') {
      return c.json({ error: 'Esta solicitud ya fue revisada' }, 409)
    }

    let approvedAmount: number | null = null
    let commissionPct: number | null = null
    let commissionClp: number | null = null

    if (status === 'approved') {
      approvedAmount = body.approvedAmountClp != null && body.approvedAmountClp !== ''
        ? parseInt(body.approvedAmountClp, 10)
        : Number(reqRow.amount_clp)

      if (!(approvedAmount >= MIN_APPROVED_AMOUNT_CLP)) {
        return c.json({ error: `El monto aprobado debe ser al menos ${MIN_APPROVED_AMOUNT_CLP.toLocaleString('es-CL')} CLP.` }, 400)
      }

      const [commissionCfg] = await sql`SELECT value FROM tienda_config WHERE key = 'b2b_credit_commission_pct'`
      commissionPct = commissionCfg?.value ? Number(commissionCfg.value) : 2
      if (!(commissionPct >= 0)) commissionPct = 2
      commissionClp = Math.round(approvedAmount * (commissionPct / 100))
    }

    await sql`
      UPDATE b2b_credit_requests
      SET status = ${status}, reviewed_by = ${authUser.id}, reviewed_at = NOW(),
          reviewer_note = ${reviewerNote}, updated_at = NOW(),
          approved_amount_clp = ${approvedAmount}, commission_pct = ${commissionPct}, commission_clp = ${commissionClp}
      WHERE id = ${id}
    `

    if (status === 'approved' && approvedAmount !== null) {
      const [comp] = await sql`SELECT wallet_balance_clp FROM b2b_companies WHERE id = ${reqRow.company_id}`
      const newBalance = Number(comp.wallet_balance_clp) + approvedAmount

      await sql`UPDATE b2b_companies SET wallet_balance_clp = ${newBalance} WHERE id = ${reqRow.company_id}`
      await sql`
        INSERT INTO b2b_wallet_ledger (company_id, type, amount_clp, balance_after, reference_id, reference_type, notes, created_by)
        VALUES (${reqRow.company_id}, 'credit', ${approvedAmount}, ${newBalance}, ${reqRow.id}, 'credit_request', ${reviewerNote}, ${authUser.id})
      `
    }

    const [customerRow] = await sql`SELECT email FROM customers WHERE id = ${reqRow.customer_id}`
    const contactEmail = customerRow?.email ?? null

    if (contactEmail) {
      const label = status === 'approved' ? '✅ Aprobada' : '❌ Rechazada'
      const amountLabel = status === 'approved' && approvedAmount !== null
        ? `${approvedAmount.toLocaleString('es-CL')} CLP`
        : `${Number(reqRow.amount_clp).toLocaleString('es-CL')} CLP`
      await enqueueEmail(
        contactEmail,
        `${label} — Solicitud de crédito ${reqRow.razon_social}`,
        `<p>Tu solicitud de crédito fue ${status === 'approved' ? `aprobada por ${amountLabel}` : 'rechazada'}.${reviewerNote ? ' Nota: ' + reviewerNote : ''}</p>`,
        status === 'approved' ? 'quote-accepted' : 'quote-rejected'
      )
    }

    return c.json({ ok: true, approvedAmountClp: approvedAmount, commissionPct, commissionClp })
  } catch (err) {
    console.error('B2B credit review error:', err)
    return c.json({ error: 'Error al revisar solicitud' }, 500)
  }
})

// GET /api/b2b/credit-suggestions — owner-only. Sugerencia proactiva de subir
// línea de crédito a empresas B2B con volumen de compra creciente (pedido
// explícito del dueño, punto 5 del flujo de aprobación de crédito B2B).
// v1.0: consulta SQL simple, sin algoritmo sofisticado — compara el total de
// pedidos asociados a la empresa (orders.company_id, ver migración 0022c y
// POST /api/orders — venta B2B en POS) en los últimos 30 días vs. los 30
// días anteriores. Requiere volumen real en AMBOS períodos para calcular un
// % de crecimiento (evita "creció infinito" de una empresa sin historial
// previo). Sugiere subir el límite a ~2x el volumen reciente, redondeado a
// $50.000, solo si eso es mayor al límite actual.
app.get('/api/b2b/credit-suggestions', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  const GROWTH_THRESHOLD_PCT = 20 // crecimiento mínimo para sugerir revisión

  try {
    const rows = await sql`
      SELECT
        comp.id, comp.razon_social, comp.rut, comp.tier,
        comp.credit_limit_clp, comp.credit_used_clp, comp.wallet_balance_clp,
        COALESCE(recent.total, 0) AS recent_total,
        COALESCE(prior.total, 0) AS prior_total
      FROM b2b_companies comp
      LEFT JOIN LATERAL (
        SELECT SUM(o.total) AS total FROM orders o
        WHERE o.company_id = comp.id AND o.created_at >= NOW() - INTERVAL '30 days'
      ) recent ON true
      LEFT JOIN LATERAL (
        SELECT SUM(o.total) AS total FROM orders o
        WHERE o.company_id = comp.id
          AND o.created_at >= NOW() - INTERVAL '60 days' AND o.created_at < NOW() - INTERVAL '30 days'
      ) prior ON true
      WHERE comp.status != 'suspended'
    `

    const suggestions = rows
      .map((r: any) => {
        const recentTotal = Number(r.recent_total)
        const priorTotal = Number(r.prior_total)
        const currentLimit = Number(r.credit_limit_clp ?? 0)
        if (priorTotal <= 0 || recentTotal <= 0) return null
        const growthPct = Math.round(((recentTotal - priorTotal) / priorTotal) * 100)
        if (growthPct < GROWTH_THRESHOLD_PCT) return null
        const suggestedLimitClp = Math.round((recentTotal * 2) / 50_000) * 50_000
        if (suggestedLimitClp <= currentLimit) return null
        return {
          companyId: r.id, razonSocial: r.razon_social, rut: r.rut, tier: r.tier,
          currentLimitClp: currentLimit, creditUsedClp: Number(r.credit_used_clp ?? 0),
          walletBalanceClp: Number(r.wallet_balance_clp ?? 0),
          recentTotalClp: recentTotal, priorTotalClp: priorTotal, growthPct,
          suggestedLimitClp,
        }
      })
      .filter((s: any) => s !== null)
      .sort((a: any, b: any) => b.growthPct - a.growthPct)
      .slice(0, 20)

    return c.json({ suggestions })
  } catch (err) {
    console.error('B2B credit suggestions error:', err)
    return c.json({ error: 'Error al calcular sugerencias' }, 500)
  }
})

// GET /api/b2b/companies — búsqueda de empresas B2B por RUT/razón social,
// STAFF (owner/admin/staff — incluye cajero de POS). Adición post-entrega:
// venta presencial B2B en POS (punto 6 del flujo de aprobación de crédito
// B2B) — el cajero necesita buscar/seleccionar una empresa existente al
// iniciar una venta mayorista en mostrador. Devuelve solo lo necesario para
// identificar/aplicar precios B2B — nunca datos de crédito/wallet (eso es
// terreno de /api/b2b/solicitudes y /api/b2b/wallet/:id, staff owner/admin
// solamente).
app.get('/api/b2b/companies', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const q = c.req.query('q')?.trim()
  if (!q || q.length < 2) return c.json({ companies: [] })

  const normalizedRutQ = q.replace(/[.\-]/g, '').toUpperCase()

  try {
    const rows = await sql`
      SELECT id, razon_social, rut, giro, status, tier
      FROM b2b_companies
      WHERE razon_social ILIKE ${'%' + q + '%'} OR REPLACE(REPLACE(rut, '.', ''), '-', '') ILIKE ${'%' + normalizedRutQ + '%'}
      ORDER BY razon_social ASC
      LIMIT 20
    `
    return c.json({
      companies: rows.map((r: any) => ({
        id: r.id, razonSocial: r.razon_social, rut: r.rut, giro: r.giro,
        status: r.status, tier: r.tier,
      })),
    })
  } catch (err) {
    console.error('B2B companies search error:', err)
    return c.json({ error: 'Error al buscar empresas' }, 500)
  }
})

// GET /api/b2b/companies-pending — STAFF (owner/admin). GAP REAL cerrado hoy:
// ningún endpoint en todo el sistema listaba ni aprobaba el REGISTRO de una
// empresa B2B nueva (b2b_companies.status) — solo existía aprobación de
// CRÉDITO (b2b_credit_requests, ver GET /api/b2b/solicitudes abajo). Una
// empresa recién registrada (POST /api/b2b/registro) queda 'pending' PARA
// SIEMPRE sin este endpoint + el de abajo — confirmado el 2-sep-2026 cuando
// el dueño reportó "no veo la solicitud en el cmr" para una cuenta de prueba
// real que llevaba registrada desde el día anterior.
app.get('/api/b2b/companies-pending', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT comp.id, comp.razon_social, comp.rut, comp.giro, comp.address, comp.tier, comp.created_at,
             cust.name AS contact_name, cust.email AS contact_email
      FROM b2b_companies comp
      JOIN customers cust ON cust.id = comp.customer_id
      WHERE comp.status = 'pending'
      ORDER BY comp.created_at ASC
    `
    return c.json({
      companies: rows.map((r: any) => ({
        id: r.id, razonSocial: r.razon_social, rut: r.rut, giro: r.giro, address: r.address,
        tier: r.tier, createdAt: r.created_at, contactName: r.contact_name, contactEmail: r.contact_email,
      })),
    })
  } catch (err) {
    console.error('B2B companies pending error:', err)
    return c.json({ error: 'Error al listar empresas pendientes' }, 500)
  }
})

// PATCH /api/b2b/companies/:id/status — SOLO owner (mismo criterio que la
// aprobación de crédito: "solo el jefe/gerente puede aprobar una cuenta
// B2B"). status: 'approved' | 'rejected'. Avisa por correo al contacto.
app.patch('/api/b2b/companies/:id/status', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'JSON inválido' }, 400) }

  const status = body.status
  if (!['approved', 'rejected'].includes(status)) {
    return c.json({ error: 'status debe ser approved o rejected' }, 400)
  }

  try {
    const [company] = await sql`
      SELECT comp.id, comp.razon_social, comp.status, cust.name AS contact_name, cust.email AS contact_email
      FROM b2b_companies comp
      JOIN customers cust ON cust.id = comp.customer_id
      WHERE comp.id = ${id}
    `
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404)
    if (company.status !== 'pending') {
      return c.json({ error: 'Esta empresa ya fue revisada' }, 409)
    }

    if (status === 'approved') {
      await sql`UPDATE b2b_companies SET status = 'approved', approved_at = NOW() WHERE id = ${id}`
    } else {
      await sql`UPDATE b2b_companies SET status = 'rejected' WHERE id = ${id}`
    }

    await recordAuditLog(c, authUser, 'b2b_company.review', { table: 'b2b_companies', id }, { status })

    if (company.contact_email) {
      const label = status === 'approved' ? '✅ Cuenta aprobada' : '❌ Solicitud rechazada'
      const bodyMsg = status === 'approved'
        ? `<p>Tu cuenta mayorista <strong>${company.razon_social}</strong> fue aprobada. Ya puedes ingresar al <a href="${CUSTOMER_WEB_URL}/b2b/login">Portal Mayorista</a> y hacer pedidos a precio neto.</p>`
        : `<p>Tu solicitud de cuenta mayorista para <strong>${company.razon_social}</strong> no fue aprobada. Si crees que es un error, contáctanos.</p>`
      await enqueueEmail(company.contact_email, `${label} — ${company.razon_social}`, bodyMsg, status === 'approved' ? 'quote-accepted' : 'quote-rejected')
    }

    return c.json({ ok: true })
  } catch (err) {
    console.error('B2B company review error:', err)
    return c.json({ error: 'Error al revisar la empresa' }, 500)
  }
})

// GET /api/b2b/solicitudes — STAFF (owner/admin), apps/cerebro/.../b2b/solicitudes/page.tsx.
// Pese al nombre ("solicitudes"), es específicamente el listado de solicitudes
// de CRÉDITO (b2b_credit_requests) — no hay una pantalla de aprobación de
// registro de EMPRESA nueva en cerebro hoy (ver decisión documentada en
// POST /api/b2b/registro arriba). Confirmado leyendo el componente ya
// existente antes de escribir esta ruta (grep, lección explícita de esta
// sesión: verificar shape/consumidor real antes de construir).
app.get('/api/b2b/solicitudes', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const status = c.req.query('status')
  const statusCond = status && ['pending', 'approved', 'rejected'].includes(status)
    ? sql`WHERE cr.status = ${status}`
    : sql``

  try {
    const rows = await sql`
      SELECT cr.id, cr.company_id, cr.amount_clp, cr.reason, cr.status,
             cr.reviewed_at, cr.reviewer_note, cr.created_at,
             comp.razon_social, comp.rut, comp.tier
      FROM b2b_credit_requests cr
      JOIN b2b_companies comp ON comp.id = cr.company_id
      ${statusCond}
      ORDER BY cr.created_at DESC
      LIMIT 200
    `
    return c.json({
      solicitudes: rows.map((r: any) => ({
        id: r.id, companyId: r.company_id, amountClp: Number(r.amount_clp),
        reason: r.reason, status: r.status, reviewedAt: r.reviewed_at,
        reviewerNote: r.reviewer_note, createdAt: r.created_at,
        razonSocial: r.razon_social, rut: r.rut, tier: r.tier,
      })),
    })
  } catch (err) {
    console.error('B2B solicitudes error:', err)
    return c.json({ error: 'Error al listar solicitudes' }, 500)
  }
})

// GET /api/b2b/pedidos/:id — apps/web/.../b2b/dashboard/page.tsx. :id es el id
// de la EMPRESA (empresa.id, no de un pedido) — confirmado leyendo el
// componente (`fetch(.../b2b/pedidos/${data.id})` justo después de cargar
// /empresa/me). El :id del param se verifica contra la empresa de la sesión —
// 403 si no coincide (una empresa no puede leer los pedidos de otra
// adivinando su UUID). Los pedidos B2B no tienen columna propia en `orders`
// (no existe orders.company_id) — se resuelven por customer_id = el dueño de
// la empresa + channel = 'b2b', el mismo criterio que ya usa el enum
// order_channel (packages/db/src/schema/orders.ts).
app.get('/api/b2b/pedidos/:id', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  const id = c.req.param('id')
  if (id !== company.id) {
    return c.json({ error: 'No autorizado para ver los pedidos de esta empresa' }, 403)
  }

  try {
    const rows = await sql`
      SELECT id, number, total, status, dte_status, dte_folio, created_at
      FROM orders
      WHERE customer_id = ${company.customer_id} AND channel = 'b2b'
      ORDER BY created_at DESC
      LIMIT 50
    `
    return c.json({
      pedidos: rows.map((r: any) => ({
        id: r.id, number: r.number, total: r.total, status: r.status,
        dteStatus: r.dte_status, dteFolio: r.dte_folio, createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('B2B pedidos error:', err)
    return c.json({ error: 'Error al listar pedidos' }, 500)
  }
})

// GET /api/b2b/wallet/:id — apps/web/.../b2b/estado-cuenta/page.tsx. Mismo
// criterio de verificación de :id que /pedidos/:id arriba.
app.get('/api/b2b/wallet/:id', async (c) => {
  const session = await requireB2BCompany(c)
  if (session instanceof Response) return session
  const { company } = session

  const id = c.req.param('id')
  if (id !== company.id) {
    return c.json({ error: 'No autorizado para ver la wallet de esta empresa' }, 403)
  }

  try {
    const ledger = await sql`
      SELECT id, type, amount_clp, balance_after, notes, created_at
      FROM b2b_wallet_ledger
      WHERE company_id = ${company.id}
      ORDER BY created_at DESC
      LIMIT 100
    `
    return c.json({
      empresa: {
        id: company.id,
        razonSocial: company.razon_social,
        walletBalanceClp: Number(company.wallet_balance_clp ?? 0),
        creditLimitClp: Number(company.credit_limit_clp ?? 0),
        creditUsedClp: Number(company.credit_used_clp ?? 0),
      },
      ledger: ledger.map((r: any) => ({
        id: r.id, type: r.type, amountClp: Number(r.amount_clp),
        balanceAfter: Number(r.balance_after), notes: r.notes, createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('B2B wallet error:', err)
    return c.json({ error: 'Error al obtener wallet' }, 500)
  }
})

// ============================================================================
// DRIVER ENDPOINTS (2 emails)
// ============================================================================

// Proteger endpoints de logística — requieren autenticación
app.use('/api/deliveries*', requireAuthMiddleware)
app.use('/api/deliveries*', requireScopeMiddleware(['orders:write']))

// POST /api/deliveries/assign
app.post('/api/deliveries/assign', async (c) => {
  try {
    const { assignment_id, driver_id, driver_email } = await c.req.json()
    if (!assignment_id || !driver_id) return c.json({ error: 'Missing fields' }, 400)

    await sql`
      UPDATE delivery_assignments
      SET driver_id = ${driver_id}, status = 'assigned', assigned_at = NOW()
      WHERE id = ${assignment_id}
    `

    let queue_id: string | undefined
    if (driver_email) {
      queue_id = await enqueueEmail(
        driver_email,
        `🚚 Nueva Entrega Asignada`,
        templates.deliveryAssigned(),
        'delivery-assigned'
      )
    }

    console.log(`✅ Delivery assigned`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/deliveries/:id/status
app.post('/api/deliveries/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const { status } = await c.req.json()

    await sql`UPDATE delivery_assignments SET status = ${status} WHERE id = ${id}`

    let queue_id: string | undefined
    if (status === 'failed') {
      queue_id = await enqueueEmail(
        ADMIN_EMAIL,
        'Entrega fallida — acción requerida',
        templates.deliveryFailed(id),
        'delivery-failed'
      )
    }

    console.log(`✅ Delivery status: ${status}`)
    return c.json({ ok: true, queue_id })
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// DESPACHO PANEL (Cerebro admin) — /api/delivery/... (singular)
// Distinct route prefix from the driver-facing /api/deliveries/... (plural)
// above: those are gated behind requireAuthMiddleware, which today only
// validates API Keys (JWT branch is a TODO in auth.middleware.ts) and would
// 401 every session-cookie admin request. Reuses the same delivery_assignments
// table/business logic — only the list+assign HTTP surface was missing.
// ============================================================================

// S16 (Fase 5 — Hardening): estaba solo con getAuthUser() (cualquier rol
// autenticado, incluyendo 'delivery'/'viewer') pese a devolver PII de clientes
// (nombre/teléfono/dirección) de TODAS las entregas de la tienda, no solo las
// propias. Grep confirmó los únicos 2 consumidores reales (despacho/page.tsx
// en cerebro, dispatch-bifurcation-panel.tsx en pos) son ambos pantallas de
// staff — apps/repartidor solo llama /assignments/mine, nunca este endpoint —
// así que restringir a los mismos roles que su hermano PUT .../:id/assign
// (owner/admin/staff) no regresiona nada real.
app.get('/api/delivery/assignments', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT
        da.id, da.order_id, da.driver_id, da.status, da.amount_to_collect, da.payment_at_door,
        da.route_index, da.assigned_at, da.delivered_at, da.created_at,
        o.number AS order_number, o.total AS order_total, o.delivery_mode,
        o.delivery_address, o.metro_station, o.metro_slot,
        COALESCE(o.guest_name, cu.name)   AS customer_name,
        COALESCE(o.guest_phone, cu.phone) AS customer_phone
      FROM delivery_assignments da
      JOIN orders o ON o.id = da.order_id
      LEFT JOIN customers cu ON cu.id = o.customer_id
      ORDER BY da.created_at DESC
    `
    return c.json({
      assignments: rows.map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        driverId: r.driver_id,
        status: r.status,
        amountToCollect: r.amount_to_collect,
        paymentAtDoor: r.payment_at_door,
        routeIndex: r.route_index,
        assignedAt: r.assigned_at,
        deliveredAt: r.delivered_at,
        createdAt: r.created_at,
        orderNumber: r.order_number,
        orderTotal: r.order_total,
        deliveryMode: r.delivery_mode,
        deliveryAddress: r.delivery_address,
        metroStation: r.metro_station,
        metroSlot: r.metro_slot,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
      })),
    })
  } catch (err) {
    console.error('List delivery assignments error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// Asignar un repartidor a una entrega — UPDATE + alerta SSE dirigida.
// Extraído a función compartida (adición post-entrega, 3-sep-2026) porque
// ahora hay DOS callers: la asignación manual desde Despacho (de siempre) y
// la auto-asignación al marcar un pedido Metro "listo" (ver pickActiveDriver
// + POST /api/orders/:id/ready más abajo) — mismo criterio que ya se usó hoy
// para ComandaPaymentPanel: un solo lugar de verdad, no dos copias que se
// puedan desincronizar.
async function assignDriverToAssignment(assignmentId: string, driverId: string): Promise<boolean> {
  // driver_shift_id (adición post-entrega, 3-sep-2026): vínculo explícito al
  // turno abierto del repartidor EN ESTE MOMENTO — así el resumen de cobros
  // por turno (GET /api/delivery/shifts) sabe exactamente qué entregas caen
  // en qué turno, sin inferirlo por rango de fechas. NULL si se asigna a un
  // repartidor sin turno abierto (override manual fuera de turno).
  const [openShift] = await sql`SELECT id FROM driver_shifts WHERE driver_id = ${driverId} AND status = 'open'`

  const [assignment] = await sql`
    UPDATE delivery_assignments
    SET driver_id = ${driverId}, status = 'assigned', assigned_at = NOW(),
        driver_shift_id = ${openShift?.id ?? null}, updated_at = NOW()
    WHERE id = ${assignmentId}
    RETURNING id
  `
  if (!assignment) return false

  // SSE (S08, Fase 2): fire a targeted dispatch alert to the assigned
  // driver only — never a broadcast (see sse-broadcaster.ts). One extra
  // read here, triggered only by an actual assign action (not a timer),
  // so it does not add per-connection DB load.
  try {
    const [details] = await sql`
      SELECT
        da.id AS assignment_id, da.amount_to_collect, da.payment_at_door,
        o.id AS order_id, o.number AS order_number, o.total, o.delivery_mode,
        o.delivery_address, o.metro_station, o.metro_slot,
        COALESCE(o.guest_name, cu.name)   AS customer_name,
        COALESCE(o.guest_phone, cu.phone) AS customer_phone,
        cu.commune
      FROM delivery_assignments da
      JOIN orders o ON o.id = da.order_id
      LEFT JOIN customers cu ON cu.id = o.customer_id
      WHERE da.id = ${assignmentId}
    `
    if (details) {
      emitDeliveryEvent(driverId, {
        type: 'order.ready_for_dispatch',
        payload: {
          orderId: details.order_id,
          orderNumber: details.order_number,
          assignmentId: details.assignment_id,
          driverId,
          total: details.total,
          amountToCollect: details.amount_to_collect,
          paymentAtDoor: details.payment_at_door,
          deliveryMode: details.delivery_mode,
          customerName: details.customer_name,
          customerPhone: details.customer_phone,
          deliveryAddress: details.delivery_address,
          commune: details.commune,
          metroStation: details.metro_station,
          metroSlot: details.metro_slot,
        },
      })
    }
  } catch (sseErr) {
    // Never fail the assign action because of a notification error.
    console.error('SSE delivery emit error:', sseErr)
  }

  return true
}

// Elige el repartidor activo con menos entregas en curso ahora mismo —
// criterio de reparto justo entre quienes tienen turno abierto (adición
// post-entrega, 3-sep-2026). Devuelve null si nadie tiene turno abierto —
// el caller debe dejar la entrega 'pending' sin repartidor como red de
// seguridad (el staff la asigna a mano desde Despacho).
async function pickActiveDriver(): Promise<string | null> {
  const [driver] = await sql`
    SELECT ds.driver_id,
      (SELECT count(*) FROM delivery_assignments da
       WHERE da.driver_id = ds.driver_id AND da.status NOT IN ('delivered', 'failed')) AS active_count
    FROM driver_shifts ds
    WHERE ds.status = 'open'
    ORDER BY active_count ASC, ds.opened_at ASC
    LIMIT 1
  `
  return driver?.driver_id ?? null
}

// RBAC (S02, matriz sección 6.1): Despacho es owner/admin/staff (no delivery, no viewer).
app.put('/api/delivery/assignments/:id/assign', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const driverId = body.driverId
  if (!driverId) return c.json({ error: 'Missing driverId' }, 400)

  try {
    const ok = await assignDriverToAssignment(id, driverId)
    if (!ok) return c.json({ error: 'Assignment not found' }, 404)
    return c.json({ ok: true })
  } catch (err) {
    console.error('Assign driver error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/delivery/drivers/active — repartidores con turno abierto ahora
// (adición post-entrega, 3-sep-2026). Consumido por Despacho (para no
// ofrecer asignar a alguien que no está trabajando) y por pickActiveDriver.
app.get('/api/delivery/drivers/active', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT u.id, u.name, ds.opened_at,
        (SELECT count(*) FROM delivery_assignments da
         WHERE da.driver_id = u.id AND da.status NOT IN ('delivered', 'failed')) AS active_count
      FROM driver_shifts ds
      JOIN users u ON u.id = ds.driver_id
      WHERE ds.status = 'open'
      ORDER BY ds.opened_at ASC
    `
    return c.json({
      drivers: rows.map((r: any) => ({ id: r.id, name: r.name, openedAt: r.opened_at, activeCount: Number(r.active_count) })),
    })
  } catch (err) {
    console.error('List active drivers error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/delivery/shifts — historial de turnos de repartidor (adición
// post-entrega, 3-sep-2026 — el dueño pidió ver, al cerrar turno, cuánto
// cobró cada repartidor por método de pago). Mismo patrón que
// GET /api/shifts/history (turnos de caja POS): abiertos primero, luego
// cerrados por fecha. El desglose por método viene de orders.payment_method
// — NO de delivery_assignments.payment_method (ese campo es solo para cobro
// contra-entrega/COD y el repartidor siempre manda 'cash' ahí; la fuente
// real de "cómo se pagó" es el pedido, resuelto casi siempre ANTES de que
// llegue al repartidor vía ComandaPaymentPanel).
app.get('/api/delivery/shifts', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '30', 10) || 30, 1), 100)

  try {
    const shifts = await sql`
      SELECT ds.id, ds.status, ds.opened_at, ds.closed_at, u.name AS driver_name
      FROM driver_shifts ds
      JOIN users u ON u.id = ds.driver_id
      ORDER BY (ds.status = 'open') DESC, ds.opened_at DESC
      LIMIT ${limit}
    `
    if (shifts.length === 0) return c.json({ shifts: [] })

    const deliveries = await sql`
      SELECT da.driver_shift_id, o.payment_method, o.total
      FROM delivery_assignments da
      JOIN orders o ON o.id = da.order_id
      WHERE da.status = 'delivered' AND da.driver_shift_id = ANY(${shifts.map((s: any) => s.id)})
    `

    return c.json({
      shifts: shifts.map((s: any) => {
        const rows = deliveries.filter((d: any) => d.driver_shift_id === s.id)
        const byMethod: Record<string, number> = {}
        for (const r of rows) {
          const key = r.payment_method ?? 'sin_metodo'
          byMethod[key] = (byMethod[key] ?? 0) + Number(r.total)
        }
        return {
          id: s.id, status: s.status, openedAt: s.opened_at, closedAt: s.closed_at,
          driverName: s.driver_name, deliveredCount: rows.length, byMethod,
        }
      }),
    })
  } catch (err) {
    console.error('Delivery shifts history error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// REPARTIDOR (driver-facing app) — /api/delivery/... (S07, Fase 2)
// Role `delivery` only (matriz sección 6.1) — a driver only ever sees/reports
// their OWN assignments, keyed off authUser.id from the session, never a
// client-supplied driver id.
// ============================================================================

// Turno de repartidor (adición post-entrega, 3-sep-2026) — apps/repartidor,
// pestaña Perfil. 'owner' agregado por el mismo motivo que en
// /api/delivery/assignments/mine: el dueño quiere poder probar el flujo
// completo con su única cuenta owner.
app.post('/api/driver/shifts/start', async (c) => {
  const authUser = await requireSession(c, ['delivery', 'owner'])
  if (authUser instanceof Response) return authUser

  try {
    const [existing] = await sql`
      SELECT id, opened_at FROM driver_shifts WHERE driver_id = ${authUser.id} AND status = 'open'
    `
    if (existing) return c.json({ ok: true, alreadyOpen: true, shift: { id: existing.id, openedAt: existing.opened_at } })

    const [shift] = await sql`
      INSERT INTO driver_shifts (driver_id, status) VALUES (${authUser.id}, 'open')
      RETURNING id, opened_at
    `
    return c.json({ ok: true, shift: { id: shift.id, openedAt: shift.opened_at } })
  } catch (err) {
    console.error('Start driver shift error:', err)
    return c.json({ error: 'Error al iniciar turno' }, 500)
  }
})

app.post('/api/driver/shifts/end', async (c) => {
  const authUser = await requireSession(c, ['delivery', 'owner'])
  if (authUser instanceof Response) return authUser

  try {
    const [shift] = await sql`
      UPDATE driver_shifts SET status = 'closed', closed_at = NOW()
      WHERE driver_id = ${authUser.id} AND status = 'open'
      RETURNING id
    `
    if (!shift) return c.json({ ok: true, alreadyClosed: true })
    return c.json({ ok: true })
  } catch (err) {
    console.error('End driver shift error:', err)
    return c.json({ error: 'Error al terminar turno' }, 500)
  }
})

app.get('/api/driver/shifts/mine', async (c) => {
  const authUser = await requireSession(c, ['delivery', 'owner'])
  if (authUser instanceof Response) return authUser

  try {
    const [shift] = await sql`
      SELECT id, opened_at FROM driver_shifts WHERE driver_id = ${authUser.id} AND status = 'open'
    `
    return c.json({ shift: shift ? { id: shift.id, openedAt: shift.opened_at } : null })
  } catch (err) {
    console.error('Get my driver shift error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/delivery/assignments/mine — apps/repartidor/src/app/page.tsx
// (loadAssignments). Frontend does its own client-side split into "Activos"
// (status not in delivered/failed) vs. "Historial" (delivered/failed) from
// this SAME array — so this endpoint intentionally returns everything for
// the driver, not just pending ones. Shape matches the `Assignment`
// interface in page.tsx exactly (customerName/guestName kept separate —
// frontend does its own `?? ` fallback, no COALESCE server-side here).
app.get('/api/delivery/assignments/mine', async (c) => {
  // 'owner' agregado (aviso del dueño): quiere probar el flujo completo de
  // repartidor con su única cuenta owner. La matriz de roles (sección 6.1 del
  // plan maestro) ya dice "owner: todo, sin restricción" — este era un
  // desalineamiento del código contra esa regla, no un cambio de alcance.
  const authUser = await requireSession(c, ['delivery', 'owner'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT
        da.id, da.order_id, da.status, da.amount_to_collect, da.payment_at_door,
        da.route_index, da.delivered_at, da.failed_at, da.failure_reason,
        o.number AS order_number, o.total AS order_total, o.delivery_mode,
        o.delivery_address, o.metro_station, o.metro_slot,
        cu.name  AS customer_name, cu.phone AS customer_phone,
        o.guest_name, o.guest_phone,
        EXISTS (
          SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = o.id AND p.cold_chain = 'frozen'
        ) AS has_frozen,
        EXISTS (
          SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = o.id AND p.cold_chain = 'refrigerated'
        ) AS has_refrigerated
      FROM delivery_assignments da
      JOIN orders o ON o.id = da.order_id
      LEFT JOIN customers cu ON cu.id = o.customer_id
      WHERE da.driver_id = ${authUser.id}
      ORDER BY
        (da.status NOT IN ('delivered', 'failed')) DESC,
        da.route_index ASC NULLS LAST,
        da.assigned_at ASC NULLS LAST,
        da.created_at DESC
    `
    return c.json({
      assignments: rows.map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        status: r.status,
        amountToCollect: r.amount_to_collect,
        paymentAtDoor: r.payment_at_door,
        routeIndex: r.route_index,
        orderNumber: r.order_number,
        orderTotal: r.order_total,
        deliveryMode: r.delivery_mode,
        deliveryAddress: r.delivery_address,
        metroStation: r.metro_station,
        metroSlot: r.metro_slot,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        guestName: r.guest_name,
        guestPhone: r.guest_phone,
        hasFrozen: r.has_frozen,
        hasRefrigerated: r.has_refrigerated,
        deliveredAt: r.delivered_at,
        failedAt: r.failed_at,
        failureReason: r.failure_reason,
      })),
    })
  } catch (err) {
    console.error('List my delivery assignments error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// PUT /api/delivery/assignments/:id/status — apps/repartidor/src/app/page.tsx
// (handleStatusUpdate, handleAcceptAlert). Found missing during S07's audit:
// the ONLY status-update route that existed was `POST /api/deliveries/:id/status`
// (plural, gated behind requireAuthMiddleware which only validates API keys —
// a driver's session cookie would 401 there even if the path matched). Same
// fix pattern as Despacho admin (S02): reuse delivery_assignments, add the
// session-cookie-auth surface under the singular /api/delivery/* prefix.
// A driver may only update an assignment that's actually theirs.
app.put('/api/delivery/assignments/:id/status', async (c) => {
  // 'owner' agregado (aviso del dueño) — ver nota en /assignments/mine arriba.
  const authUser = await requireSession(c, ['delivery', 'owner'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const status = body.status
  if (!status) return c.json({ error: 'Missing status' }, 400)

  try {
    const [existing] = await sql`SELECT driver_id, order_id FROM delivery_assignments WHERE id = ${id}`
    if (!existing) return c.json({ error: 'Assignment not found' }, 404)
    if (existing.driver_id !== authUser.id) return c.json({ error: 'Forbidden' }, 403)

    const timestampCol = status === 'accepted' ? sql`accepted_at = NOW(),`
      : status === 'in_transit' ? sql`picked_up_at = NOW(),`
      : status === 'delivered' ? sql`delivered_at = NOW(),`
      : status === 'failed' ? sql`failed_at = NOW(),`
      : sql``

    const paymentCond = body.amountCollected
      ? sql`payment_at_door = 'collected', payment_method = ${body.paymentMethod ?? 'cash'},`
      : sql``

    await sql`
      UPDATE delivery_assignments
      SET status = ${status}, ${timestampCol} ${paymentCond} updated_at = NOW()
      WHERE id = ${id}
    `

    if (status === 'delivered') {
      await sql`UPDATE orders SET status = 'entregada' WHERE id = ${existing.order_id}`
    }

    return c.json({ ok: true, status })
  } catch (err) {
    console.error('Driver status update error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/delivery/assignments/:id/pod (gap crítico — apps/repartidor/src/app/page.tsx
// línea ~292, uploadPod(), ya lo llama con multipart/form-data — 404 hoy).
// Sin credenciales R2 configuradas (verificado, cero env vars R2_*): mismo
// criterio pragmático que las fotos de producto/hero de esta sesión, PERO
// NO se guarda en apps/web/public — esa app corre en Vercel, un deploy sin
// filesystem compartido con esta API (confirmado revisando Dockerfile: no
// copia apps/web al runtime de @seul/api). La foto se guarda en disco local
// de ESTE servicio (Railway) y se sirve desde GET /pod/:filename (ver arriba,
// junto a /health). Limitación conocida: almacenamiento efímero, se pierde en
// cada redeploy — aceptable para v1.0, documentado en el plan maestro.
//
// Un repartidor solo puede subir POD de una asignación que sea suya (mismo
// invariante que PUT .../status y POST /location — driver_id siempre de la
// sesión, nunca del body/param). El frontend llama a este endpoint y LUEGO,
// por separado, PUT .../status con status:'delivered' (uploadPod() → advance
// ('delivered')) — así que este endpoint también avanza el estado como red
// de seguridad (si esa segunda request fallara por corte de red, la foto ya
// quedó guardada y la entrega ya cuenta como completada), de forma idempotente
// (WHERE status != 'delivered').
app.post('/api/delivery/assignments/:id/pod', async (c) => {
  // 'owner' agregado (aviso del dueño) — ver nota en /assignments/mine arriba.
  const authUser = await requireSession(c, ['delivery', 'owner'])
  if (authUser instanceof Response) return authUser

  const { id } = c.req.param()

  try {
    const [assignment] = await sql`SELECT id, order_id, driver_id FROM delivery_assignments WHERE id = ${id}`
    if (!assignment) return c.json({ error: 'Entrega no encontrada' }, 404)
    if (assignment.driver_id !== authUser.id) return c.json({ error: 'Forbidden' }, 403)

    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) return c.json({ error: 'Falta la foto (campo "file")' }, 400)
    if (file.size === 0) return c.json({ error: 'Archivo vacío' }, 400)
    if (file.size > 8 * 1024 * 1024) return c.json({ error: 'Foto demasiado grande (máx 8MB)' }, 400)

    const latRaw = body['lat']
    const lngRaw = body['lng']
    const lat = typeof latRaw === 'string' && latRaw !== '' ? Number(latRaw) : null
    const lng = typeof lngRaw === 'string' && lngRaw !== '' ? Number(lngRaw) : null

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const filename = `${id}-${Date.now()}.${ext}`

    fs.mkdirSync(POD_UPLOAD_DIR, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(POD_UPLOAD_DIR, filename), buf)

    const publicUrl = `${API_PUBLIC_URL}/pod/${filename}`

    await sql`
      INSERT INTO delivery_pods (assignment_id, r2_key, latitude, longitude, captured_at, uploaded_at)
      VALUES (${id}, ${filename}, ${lat}, ${lng}, NOW(), NOW())
    `

    // Idempotente y coherente con PUT .../status: solo toca la fila si todavía
    // no estaba marcada delivered (esa segunda request del frontend puede
    // llegar antes, después, o no llegar — la foto no debe depender de eso).
    await sql`
      UPDATE delivery_assignments SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND status != 'delivered'
    `
    await sql`UPDATE orders SET status = 'entregada' WHERE id = ${assignment.order_id}`

    await recordAuditLog(c, authUser, 'delivery.pod_upload', { table: 'delivery_pods', id }, { filename, lat, lng })

    console.log(`✅ POD uploaded for assignment ${id}`)
    return c.json({ ok: true, url: publicUrl })
  } catch (err) {
    console.error('POD upload error:', err)
    return c.json({ error: 'Error al subir la foto' }, 500)
  }
})

// POST /api/delivery/location — GPS ping while `status = in_transit`
// (apps/repartidor/src/app/page.tsx, watchPosition + 30s interval fallback).
// Writes to delivery_location_pings (packages/db/src/schema/delivery.ts) — a
// standalone tracking table, separate from delivery_assignments itself, so a
// dense stream of pings never touches the assignment row. driver_id always
// comes from the session, never the request body.
app.post('/api/delivery/location', async (c) => {
  // 'owner' agregado (aviso del dueño) — ver nota en /assignments/mine arriba.
  const authUser = await requireSession(c, ['delivery', 'owner'])
  if (authUser instanceof Response) return authUser

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const { assignmentId, latitude, longitude, accuracy } = body
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return c.json({ error: 'Missing latitude/longitude' }, 400)
  }

  try {
    await sql`
      INSERT INTO delivery_location_pings (driver_id, assignment_id, latitude, longitude, accuracy)
      VALUES (${authUser.id}, ${assignmentId ?? null}, ${latitude}, ${longitude}, ${accuracy ?? null})
    `
    return c.json({ ok: true })
  } catch (err) {
    console.error('Location ping error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// DESPACHO — repartidores / Rappi / liquidaciones (Cerebro + POS admin views)
// Role owner/admin/staff (matriz sección 6.1 — mismo grupo que Despacho arriba).
// ============================================================================

// GET /api/delivery/drivers — selector de repartidor en Despacho
// (apps/pos/src/components/pos/delivery/{assign-driver-modal,dispatch-panel,
// dispatch-bifurcation-panel}.tsx). Distinct from `GET /api/auth/users`
// (which also lists staff/admin/owner accounts, no `activeJobs`) — this is
// scoped to role=delivery only and adds the one field those 3 modals all
// actually need: how many jobs each driver currently has in flight.
app.get('/api/delivery/drivers', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT
        u.id, u.name, u.email,
        COUNT(da.id) FILTER (WHERE da.status IN ('assigned', 'accepted', 'in_transit')) AS active_jobs
      FROM users u
      LEFT JOIN delivery_assignments da ON da.driver_id = u.id
      WHERE u.role = 'delivery' AND u.is_active = true
      GROUP BY u.id, u.name, u.email
      ORDER BY u.name ASC
    `
    return c.json({
      drivers: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        activeJobs: Number(r.active_jobs),
      })),
    })
  } catch (err) {
    console.error('List drivers error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/delivery/dispatch-rappi — apps/pos/.../rappi-dispatch-modal.tsx.
// NO REAL RAPPI INTEGRATION EXISTS. This does not call any Rappi API — Seoul
// Kims has no Rappi merchant/API credentials configured today (see CLAUDE.md
// "Logística: Rappi + Metro Merval" — mentioned as a channel, no credentials
// documented anywhere in this repo's env vars). What this endpoint does is
// exactly what the schema already models for this case (`dispatch_type`,
// `third_party_name`, `third_party_tracking` on delivery_assignments, added
// in migrate-0009 "Bifurcación de flota: interna vs. terceros"): record, in
// our own DB, that staff manually handed the order to a Rappi courier whose
// name/tracking code they read off the Rappi app/SMS and typed into the
// modal. If/when the business gets real Rappi API credentials, this is the
// endpoint to extend with an actual outbound call — until then this is
// bookkeeping, not dispatch automation, and must not be presented as more.
app.post('/api/delivery/dispatch-rappi', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const { orderId, thirdPartyName, thirdPartyTracking, amountToCollect, paymentAtDoor } = body
  if (!orderId || !thirdPartyName) {
    return c.json({ error: 'Missing orderId or thirdPartyName' }, 400)
  }

  try {
    const [order] = await sql`SELECT id FROM orders WHERE id = ${orderId}`
    if (!order) return c.json({ error: 'Order not found' }, 404)

    const [existing] = await sql`SELECT id FROM delivery_assignments WHERE order_id = ${orderId}`

    let assignmentId: string
    if (existing) {
      await sql`
        UPDATE delivery_assignments
        SET dispatch_type = 'rappi',
            third_party_name = ${thirdPartyName},
            third_party_tracking = ${thirdPartyTracking ?? null},
            third_party_saved_at = NOW(),
            third_party_saved_by = ${authUser.id},
            status = 'assigned',
            assigned_at = NOW(),
            amount_to_collect = ${amountToCollect ?? 0},
            payment_at_door = ${paymentAtDoor ?? 'not_required'},
            updated_at = NOW()
        WHERE id = ${existing.id}
      `
      assignmentId = existing.id
    } else {
      const [created] = await sql`
        INSERT INTO delivery_assignments
          (order_id, dispatch_type, third_party_name, third_party_tracking,
           third_party_saved_at, third_party_saved_by, status, assigned_at,
           amount_to_collect, payment_at_door)
        VALUES
          (${orderId}, 'rappi', ${thirdPartyName}, ${thirdPartyTracking ?? null},
           NOW(), ${authUser.id}, 'assigned', NOW(),
           ${amountToCollect ?? 0}, ${paymentAtDoor ?? 'not_required'})
        RETURNING id
      `
      assignmentId = created.id
    }

    console.log(`✅ Rappi dispatch recorded for order ${orderId} (${thirdPartyName})`)
    return c.json({ ok: true, assignmentId })
  } catch (err) {
    console.error('Dispatch Rappi error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/delivery/drivers/:driverId/z-report — apps/pos/.../driver-z-report-modal.tsx.
// Computes the pending liquidation period for one driver: from the moment
// right after their last paid payout (or the epoch, if they've never been
// paid) up to now. KNOWN LIMITATION (documented, not fixed here — out of
// S07 scope): `distancia_km` / `monto_repartidor_clp` on delivery_assignments
// are columns modeled in migrate-0009 but NO endpoint anywhere in this
// codebase (this session included) ever writes them — there is no distance-
// tracking logic yet (would need to derive km from the location-ping trail
// this session just started collecting, or from a maps API). So `totalKm`
// and `grossClp` will correctly read as 0 today for every driver, and
// `netPayable` will be 0-minus-cashCollected, until a future session adds
// that computation. Not faked here.
app.get('/api/delivery/drivers/:driverId/z-report', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const { driverId } = c.req.param()

  try {
    const [driver] = await sql`SELECT id, name, email FROM users WHERE id = ${driverId} AND role = 'delivery'`
    if (!driver) return c.json({ error: 'Driver not found' }, 404)

    const [lastPayout] = await sql`
      SELECT period_to FROM delivery_payouts
      WHERE driver_id = ${driverId}
      ORDER BY period_to DESC
      LIMIT 1
    `
    const periodFrom = lastPayout?.period_to ?? new Date(0)
    const periodTo = new Date()

    const [agg] = await sql`
      SELECT
        COUNT(*) AS deliveries_count,
        COALESCE(SUM(distancia_km), 0) AS total_km,
        COALESCE(SUM(monto_repartidor_clp), 0) AS gross_clp,
        COALESCE(SUM(amount_to_collect) FILTER (WHERE payment_at_door = 'collected'), 0) AS cash_collected
      FROM delivery_assignments
      WHERE driver_id = ${driverId}
        AND status = 'delivered'
        AND delivered_at > ${periodFrom}
        AND delivered_at <= ${periodTo}
    `

    const grossClp = Number(agg.gross_clp)
    const cashCollected = Number(agg.cash_collected)

    return c.json({
      driver: { id: driver.id, name: driver.name, email: driver.email },
      periodFrom: periodFrom instanceof Date ? periodFrom.toISOString() : periodFrom,
      periodTo: periodTo.toISOString(),
      deliveriesCount: Number(agg.deliveries_count),
      totalKm: Number(agg.total_km),
      grossClp,
      cashCollected,
      netPayable: grossClp - cashCollected,
    })
  } catch (err) {
    console.error('Driver z-report error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// GET /api/delivery/payouts — historial de liquidaciones (sección 7 del plan
// maestro la lista explícitamente). Sin consumidor de GET en las 4 apps hoy
// (solo el POST de abajo, disparado por "Liquidar turno" en
// driver-z-report-modal.tsx) — se construye igual porque el plan la pide y
// porque es la lectura natural que necesitará una futura pantalla de
// historial de liquidaciones. Optional `?driverId=` filters to one driver.
app.get('/api/delivery/payouts', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const driverId = c.req.query('driverId')

  try {
    const rows = driverId
      ? await sql`
          SELECT dp.*, u.name AS driver_name, u.email AS driver_email
          FROM delivery_payouts dp
          JOIN users u ON u.id = dp.driver_id
          WHERE dp.driver_id = ${driverId}
          ORDER BY dp.created_at DESC
        `
      : await sql`
          SELECT dp.*, u.name AS driver_name, u.email AS driver_email
          FROM delivery_payouts dp
          JOIN users u ON u.id = dp.driver_id
          ORDER BY dp.created_at DESC
        `
    return c.json({
      payouts: rows.map((r: any) => ({
        id: r.id,
        driverId: r.driver_id,
        driverName: r.driver_name,
        driverEmail: r.driver_email,
        periodFrom: r.period_from,
        periodTo: r.period_to,
        deliveriesCount: r.deliveries_count,
        totalKm: r.total_km,
        grossClp: r.gross_clp,
        cashCollected: r.cash_collected,
        netPayable: r.net_payable,
        paidAt: r.paid_at,
        notes: r.notes,
      })),
    })
  } catch (err) {
    console.error('List payouts error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/delivery/payouts — "Liquidar turno" button in
// driver-z-report-modal.tsx. Registers (and immediately marks paid — this IS
// the "pay now" action, there's no separate approval step in the UI) a
// payout using the exact figures the z-report GET above just computed and
// the modal echoed back in the request body.
app.post('/api/delivery/payouts', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  const {
    driverId, periodFrom, periodTo, deliveriesCount,
    totalKm, grossClp, cashCollected, netPayable, notes,
  } = body
  if (!driverId || !periodFrom || !periodTo) {
    return c.json({ error: 'Missing driverId/periodFrom/periodTo' }, 400)
  }

  try {
    const [payout] = await sql`
      INSERT INTO delivery_payouts
        (driver_id, period_from, period_to, deliveries_count, total_km,
         gross_clp, cash_collected, net_payable, paid_at, paid_by, notes)
      VALUES
        (${driverId}, ${periodFrom}, ${periodTo}, ${deliveriesCount ?? 0}, ${totalKm ?? 0},
         ${grossClp ?? 0}, ${cashCollected ?? 0}, ${netPayable ?? 0}, NOW(), ${authUser.id}, ${notes ?? null})
      RETURNING id
    `
    console.log(`✅ Payout registered for driver ${driverId}: ${payout.id}`)
    return c.json({ ok: true, id: payout.id })
  } catch (err) {
    console.error('Create payout error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// TIENDA CONFIG (singleton key/value settings) — Ajustes / Seguridad panels
// `tienda_config` (key TEXT PK, value TEXT) already existed in prod, already
// populated (metro_station_name, void_pin, dte_provider, etc — see
// packages/db/src/schema/orders.ts). Generic GET/PUT by key on top of it
// covers the requested analytics_pin without a schema change.
// ============================================================================

// GET /api/tienda-config/public — bank-transfer / QR-payment details shown to whoever is
// paying, during POS checkout (components/pos/checkout/pay-qr.tsx expects
// { config: { bank_name, bank_account, bank_account_type, bank_rut, bank_holder } }).
// Deliberately public/no-auth (unlike the generic :key route below): it's the same bank
// account info a cashier reads out loud for a transfer, and pay-qr.tsx's fetch does not
// send credentials. Registered before the generic '/:key' route so 'public' isn't
// swallowed as an arbitrary settings key with a {key,value} shape.
app.get('/api/tienda-config/public', async (c) => {
  try {
    const keys = ['bank_name', 'bank_account', 'bank_account_type', 'bank_rut', 'bank_holder']
    const rows = await sql`SELECT key, value FROM tienda_config WHERE key IN ${sql(keys)}`
    const byKey = new Map(rows.map((r: any) => [r.key, r.value]))
    return c.json({
      config: {
        bank_name:         byKey.get('bank_name')         ?? null,
        bank_account:      byKey.get('bank_account')      ?? null,
        bank_account_type: byKey.get('bank_account_type') ?? null,
        bank_rut:          byKey.get('bank_rut')           ?? null,
        bank_holder:       byKey.get('bank_holder')        ?? null,
      },
    })
  } catch (err) {
    console.error('Get tienda-config public error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.get('/api/tienda-config/:key', async (c) => {
  // Migrated to requireSession (S01 proof-of-concept, bloqueador P0 #2).
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const key = c.req.param('key')
  try {
    const [row] = await sql`SELECT value FROM tienda_config WHERE key = ${key}`
    return c.json({ key, value: row?.value ?? null })
  } catch (err) {
    console.error('Get tienda-config error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

app.put('/api/tienda-config/:key', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Not authenticated' }, 401)

  const key = c.req.param('key')
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  if (typeof body.value !== 'string') return c.json({ error: 'Missing value' }, 400)

  try {
    const [before] = await sql`SELECT value FROM tienda_config WHERE key = ${key}`

    await sql`
      INSERT INTO tienda_config (key, value, updated_at)
      VALUES (${key}, ${body.value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `

    // Audit log (S16, Fase 5 — Hardening). `tienda_config` incluye secretos
    // como `void_pin`/`analytics_pin` — sus valores se enmascaran en el log
    // (el audit log en sí no debe volverse una forma de leer el PIN vigente
    // via su historial). El resto de claves (banco, estación Merval, etc.)
    // se registran completas.
    const isSecret = /pin/i.test(key)
    await recordAuditLog(c, authUser, 'tienda_config.update', { table: 'tienda_config', id: key }, {
      key,
      before: isSecret ? '••••' : (before?.value ?? null),
      after: isSecret ? '••••' : body.value,
    })

    return c.json({ ok: true, key, value: body.value })
  } catch (err) {
    console.error('Update tienda-config error:', err)
    return c.json({ error: 'Error' }, 500)
  }
})

// ============================================================================
// API KEY MIDDLEWARE & ENDPOINTS
// ============================================================================

app.use('/api/admin/*', validateApiKeyMiddleware())

// API Key Management (Admin)
app.post('/api/admin/api-keys', (c) => apiKeysController.create(c))
app.get('/api/admin/api-keys', (c) => apiKeysController.list(c))
app.post('/api/admin/api-keys/:id/revoke', (c) => apiKeysController.revoke(c))

// Admin: Seed test users (development only)
app.post('/api/admin/seed/users', async (c) => {
  if (process.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Only available in development' }, 403)
  }

  const TEST_USERS = [
    { email: 'founder@seoulshop.cl', password: 'Seoul2025!Founder', name: 'Fundador Seoul Kims', role: 'owner' },
    { email: 'gerente@seoulshop.cl', password: 'Seoul2025!Gerente', name: 'Gerente Operacional', role: 'admin' },
    { email: 'repartidor.test@seoulshop.cl', password: 'Seoul2025!Repartidor', name: 'Repartidor de Prueba', role: 'delivery' },
  ]

  try {
    const results = []
    for (const user of TEST_USERS) {
      const passwordHash = PasswordService.hashPassword(user.password)
      const existing = await sql`SELECT id FROM users WHERE email = ${user.email}`

      if (existing.length > 0) {
        results.push({ email: user.email, status: 'exists' })
        continue
      }

      const [inserted] = await sql`
        INSERT INTO users (email, password_hash, name, role, is_active)
        VALUES (${user.email}, ${passwordHash}, ${user.name}, ${user.role}, true)
        RETURNING id, email, name, role
      `

      results.push({ email: inserted.email, status: 'created', id: inserted.id })
    }

    return c.json({ ok: true, results })
  } catch (err: any) {
    console.error('Seed error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// ============================================================================
// LEGACY ENDPOINTS
// ============================================================================

// S16 (Fase 5 — Hardening): este endpoint no tenía NINGÚN auth check — cualquiera
// con el UUID (aleatorio, pero igual sin protección) podía leer `template_data`,
// que para el email de bienvenida incluye la contraseña temporal en texto plano
// (ver templates.initialCredentials). Grep confirmó cero consumidores en las 4
// apps (endpoint legacy/muerto) — agregar requireSession no regresiona nada real.
app.get('/api/email-queue/:id', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  try {
    const { id } = c.req.param()
    const [record] = await sql`SELECT * FROM email_queue WHERE id = ${id}`
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json(record)
  } catch (err) {
    return c.json({ error: 'Error' }, 500)
  }
})

// POST /api/auth/register — crea un usuario STAFF real (usado por el panel Usuarios).
// No es self-signup: requiere sesión válida (mismo guard que GET/PUT/DELETE /api/auth/users),
// genera una contraseña temporal (igual patrón que seedRealUsersIfNeeded) y la envía por
// email con la plantilla de credenciales iniciales — el password que venga en el body del
// formulario se ignora a propósito, nunca se persiste texto plano ni se elige por el creador.
// RBAC (S02, matriz sección 6.1): Usuarios (incluye crear cuentas nuevas) es owner-only.
app.post('/api/auth/register', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  // Rate limit (S02, bloqueador P0 #3): 20 registros / 5 min por owner autenticado.
  const rl = await checkAndRecordRateLimit(c, 'auth:register', { limit: 20, windowMinutes: 5 }, authUser.id)
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const email = String(body.email || '').toLowerCase().trim()
  const name = String(body.name || '').trim()
  const role = body.role || 'staff'
  const cargo = body.cargo || null
  const departamento = body.departamento || null
  const telefonoPersonal = body.telefonoPersonal || null

  if (!email || !name) {
    return c.json({ error: 'Faltan campos requeridos (nombre, email)' }, 400)
  }

  const VALID_ROLES = ['owner', 'admin', 'staff', 'delivery', 'viewer']
  if (!VALID_ROLES.includes(role)) {
    return c.json({ error: 'Rol inválido' }, 400)
  }

  try {
    const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing) {
      return c.json({ error: 'Ya existe un usuario con ese email' }, 409)
    }

    const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase()
    const passwordHash = PasswordService.hashPassword(tempPassword)

    const [created] = await sql`
      INSERT INTO users (email, password_hash, name, role, is_active, must_change_password, cargo, departamento, telefono_personal)
      VALUES (${email}, ${passwordHash}, ${name}, ${role}, true, true, ${cargo}, ${departamento}, ${telefonoPersonal})
      RETURNING id, email, name, role, is_active, cargo, departamento, telefono_personal, last_login_at, created_at
    `

    try {
      await enqueueEmail(
        email,
        '🎉 ¡Bienvenido a SEUL KING OS v1.0!',
        templates.initialCredentials({
          email,
          password: tempPassword,
          name,
          role,
        }),
        'welcome'
      )
    } catch (emailError) {
      console.error(`⚠️  Register — email error for ${email}:`, emailError)
    }

    // Audit log (S16, Fase 5 — Hardening). Nunca incluye la contraseña temporal
    // ni su hash — solo los campos no sensibles del usuario creado.
    await recordAuditLog(c, authUser, 'user.create', { table: 'users', id: created.id }, {
      email: created.email,
      name: created.name,
      role: created.role,
      cargo: created.cargo,
      departamento: created.departamento,
    })

    return c.json({
      ok: true,
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role,
        isActive: created.is_active,
        cargo: created.cargo,
        departamento: created.departamento,
        telefonoPersonal: created.telefono_personal,
        lastLoginAt: created.last_login_at,
        createdAt: created.created_at,
      },
    })
  } catch (err: any) {
    console.error('Register error:', err)
    if (err?.code === '23505') {
      return c.json({ error: 'Ya existe un usuario con ese email' }, 409)
    }
    return c.json({ error: 'Error al crear usuario' }, 500)
  }
})

// ============================================================================
// PRODUCTOS + INVENTARIO (S03 — Fase 1)
// ============================================================================
// Usa packages/db/src/schema/products.ts e inventory.ts tal cual modelados.
// Todos requieren sesión (requireSession sin restricción de rol — cualquier
// cuenta autenticada de cerebro/pos/web puede consultar catálogo/inventario;
// no hay dato sensible por rol en estos endpoints de solo lectura).

const VALID_PRODUCT_STATUS = ['active', 'inactive', 'discontinued']
const VALID_COLD_CHAIN = ['ambient', 'refrigerated', 'frozen']
const VALID_EXPIRY_FILTERS = ['fresh', 'warning', 'urgent', 'expired']
const VALID_SELLOS = ['sodio', 'grasas', 'azucares', 'calorias']

// Sesión OPCIONAL: apps/web (tienda pública, sin login de cliente aún — eso es
// Fase 3) necesita listar productos sin estar autenticado. Staff (cerebro/pos)
// sigue mandando su cookie y recibe el shape completo (costo, precio B2B,
// descuentos internos); un visitante público recibe solo los campos vendibles
// (ver `isStaff` más abajo) — nunca exponer costo/margen a un anónimo.
app.get('/api/products', async (c) => {
  const authUser = await getOptionalSession(c)
  const isStaff = authUser !== null

  const statusParam = c.req.query('status')
  const q = c.req.query('q')?.trim()
  const category = c.req.query('category')?.trim()
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '100', 10) || 100, 1), 500)

  // Default: solo activos (POS/web nunca deben listar inactivos/descontinuados por
  // accidente). `status=all`/`draft`/etc solo lo puede pedir staff autenticado —
  // un visitante público SIEMPRE ve solo 'active', sin importar el query param.
  const statusCond = !isStaff || !statusParam
    ? sql`AND p.status = 'active'`
    : statusParam === 'all'
      ? sql``
      : VALID_PRODUCT_STATUS.includes(statusParam)
        ? sql`AND p.status = ${statusParam}`
        : sql`AND p.status = 'active'`

  const qCond = q
    ? sql`AND (p.name ILIKE ${'%' + q + '%'} OR p.name_ko ILIKE ${'%' + q + '%'} OR p.sku ILIKE ${'%' + q + '%'} OR p.barcode ILIKE ${'%' + q + '%'} OR p.brand ILIKE ${'%' + q + '%'})`
    : sql``

  // `category` acepta id (uuid, usado por POS) o slug (usado por la tienda web) —
  // los dos frontends lo llaman de forma distinta, esto cubre ambos sin tocarlos.
  const categoryCond = category
    ? sql`AND (p.category_id::text = ${category} OR cat.slug = ${category})`
    : sql``

  try {
    const rows = await sql`
      SELECT
        p.id, p.sku, p.barcode, p.name, p.name_ko, p.slug, p.brand,
        p.cost_price, p.price_retail, p.price_web, p.price_pos, p.price_b2b,
        p.discount_web_pct, p.discount_pos_pct, p.discount_b2b_pct,
        p.is_baes_eligible, p.cold_chain, p.is_weighable, p.status, p.image_url,
        p.category_id, cat.name AS category_name,
        stock.qty_total AS stock_total,
        stock.next_expiry,
        COUNT(*) OVER() AS full_count
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      -- NOTA: inventory_summary existe en el schema pero su migración/trigger
      -- (packages/db/src/migrations/001_inventory_summary.sql) nunca se aplicó
      -- en producción (0 filas, sin trigger instalado) — se agrega en vivo desde
      -- la tabla inventory en vez de confiar en esa tabla derivada y desactualizada.
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(i.quantity), 0) AS qty_total,
          MIN(i.expires_at) FILTER (WHERE i.quantity > 0 AND i.expires_at IS NOT NULL) AS next_expiry
        FROM inventory i
        WHERE i.product_id = p.id
      ) stock ON true
      WHERE 1=1 ${statusCond} ${qCond} ${categoryCond}
      ORDER BY p.name ASC
      LIMIT ${limit}
    `

    return c.json({
      products: rows.map((r: any) => ({
        id: r.id, sku: r.sku, name: r.name, nameKo: r.name_ko,
        slug: r.slug, brand: r.brand,
        priceRetail: r.price_retail, priceWeb: r.price_web,
        isBaesEligible: r.is_baes_eligible, coldChain: r.cold_chain, isWeighable: r.is_weighable,
        status: r.status, imageUrl: r.image_url,
        categoryId: r.category_id, categoryName: r.category_name,
        stockTotal: Number(r.stock_total ?? 0),
        nextExpiry: r.next_expiry,
        // Solo staff autenticado (cerebro/pos) recibe costo, precios internos
        // (POS/B2B) y descuentos — nunca exponer margen a un visitante público.
        ...(isStaff ? {
          barcode: r.barcode,
          costPrice: r.cost_price,
          pricePOS: r.price_pos,
          priceB2B: r.price_b2b,
          discountWebPct: r.discount_web_pct,
          discountPOSPct: r.discount_pos_pct,
          discountB2BPct: r.discount_b2b_pct,
        } : {}),
      })),
      total: rows.length > 0 ? Number(rows[0].full_count) : 0,
    })
  } catch (err) {
    console.error('List products error:', err)
    return c.json({ error: 'Error al listar productos' }, 500)
  }
})

// POST /api/products (gap crítico — apps/cerebro/.../products/new ya lo llama,
// 404 hoy). Rol admin+ (matriz 6.1: edición de catálogo/precios) — a
// diferencia de las lecturas de arriba, que cualquier sesión válida puede
// consultar. Valida sku/slug/barcode únicos ANTES del insert (mensaje claro
// en vez de un 500 por violación de constraint) y también captura el 23505 de
// Postgres como red de seguridad ante una carrera entre el check y el insert.
app.post('/api/products', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'JSON inválido' }, 400) }

  const sku  = String(body.sku ?? '').trim()
  const name = String(body.name ?? '').trim()
  const slug = String(body.slug ?? '').trim()
  const barcode = body.barcode ? String(body.barcode).trim() : null
  const priceRetail = Number(body.priceRetail)

  if (!sku || !name || !slug) return c.json({ error: 'SKU, nombre y slug son obligatorios' }, 400)
  if (!(priceRetail >= 0)) return c.json({ error: 'Precio retail inválido' }, 400)

  const coldChain = VALID_COLD_CHAIN.includes(body.coldChain) ? body.coldChain : 'ambient'
  const status    = VALID_PRODUCT_STATUS.includes(body.status) ? body.status : 'active'
  const sellos: string[] = Array.isArray(body.sellos) ? body.sellos.filter((s: any) => VALID_SELLOS.includes(s)) : []

  try {
    const [dupSku] = await sql`SELECT id FROM products WHERE sku = ${sku}`
    if (dupSku) return c.json({ error: 'Ya existe un producto con ese SKU' }, 409)
    const [dupSlug] = await sql`SELECT id FROM products WHERE slug = ${slug}`
    if (dupSlug) return c.json({ error: 'Ya existe un producto con ese slug' }, 409)
    if (barcode) {
      const [dupBarcode] = await sql`SELECT id FROM products WHERE barcode = ${barcode}`
      if (dupBarcode) return c.json({ error: 'Ya existe un producto con ese código de barras' }, 409)
    }

    const [created] = await sql`
      INSERT INTO products (
        sku, barcode, name, name_ko, slug, description, brand, category_id,
        cost_price, price_retail, price_web, price_pos, price_b2b,
        discount_web_pct, discount_pos_pct, discount_b2b_pct,
        weight_grams, is_weighable, is_baes_eligible, cold_chain, status
      ) VALUES (
        ${sku}, ${barcode}, ${name}, ${body.nameKo || null}, ${slug},
        ${body.description || null}, ${body.brand || null}, ${body.categoryId || null},
        ${body.costPrice ?? null}, ${priceRetail}, ${body.priceWeb ?? null}, ${body.pricePOS ?? null}, ${body.priceB2B ?? null},
        ${Number(body.discountWebPct) || 0}, ${Number(body.discountPOSPct) || 0}, ${Number(body.discountB2BPct) || 0},
        ${body.weightGrams ?? null}, ${!!body.isWeighable}, ${!!body.isBaesEligible}, ${coldChain}, ${status}
      )
      RETURNING id
    `

    for (const s of sellos) {
      await sql`INSERT INTO product_sellos (product_id, sello) VALUES (${created.id}, ${s})`
    }

    await recordAuditLog(c, authUser, 'product.create', { table: 'products', id: created.id }, {
      sku, name, priceRetail,
      priceWeb: body.priceWeb ?? null, pricePOS: body.pricePOS ?? null, priceB2B: body.priceB2B ?? null, costPrice: body.costPrice ?? null,
    })

    console.log(`✅ Product created: ${sku} — ${name}`)
    return c.json({ ok: true, id: created.id })
  } catch (err: any) {
    console.error('Create product error:', err)
    if (err?.code === '23505') return c.json({ error: 'SKU, slug o código de barras ya existe' }, 409)
    return c.json({ error: 'Error al crear el producto' }, 500)
  }
})

// Público — apps/web (tienda sin login de cliente todavía) también lo consume,
// y no expone nada sensible (solo nombre/slug/emoji de categoría).
app.get('/api/products/meta/categories', async (c) => {
  try {
    const rows = await sql`
      SELECT id, name, slug, emoji, sort_order
      FROM categories
      ORDER BY sort_order ASC, name ASC
    `
    return c.json({
      categories: rows.map((r: any) => ({
        id: r.id, name: r.name, slug: r.slug, emoji: r.emoji, sortOrder: r.sort_order,
      })),
    })
  } catch (err) {
    console.error('List categories error:', err)
    return c.json({ error: 'Error al listar categorías' }, 500)
  }
})

// Usado por el escáner de código de barras del POS (apps/pos/src/app/page.tsx,
// handleScan). También matchea por SKU como fallback — el mismo criterio que ya
// usa el POS contra su caché local de productos antes de llamar a este endpoint.
app.get('/api/products/barcode/:code', async (c) => {
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const code = c.req.param('code')

  try {
    const [p] = await sql`
      SELECT
        p.id, p.sku, p.barcode, p.name, p.name_ko, p.slug, p.brand,
        p.cost_price, p.price_retail, p.price_web, p.price_pos, p.price_b2b,
        p.discount_web_pct, p.discount_pos_pct, p.discount_b2b_pct,
        p.is_baes_eligible, p.cold_chain, p.is_weighable, p.status, p.image_url,
        p.category_id, cat.name AS category_name,
        stock.qty_total AS stock_total
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.quantity), 0) AS qty_total
        FROM inventory i
        WHERE i.product_id = p.id
      ) stock ON true
      WHERE p.barcode = ${code} OR p.sku = ${code}
      LIMIT 1
    `

    if (!p) return c.json({ error: 'Producto no encontrado' }, 404)

    return c.json({
      product: {
        id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, nameKo: p.name_ko,
        slug: p.slug, brand: p.brand,
        costPrice: p.cost_price, priceRetail: p.price_retail, priceWeb: p.price_web,
        pricePOS: p.price_pos, priceB2B: p.price_b2b,
        discountWebPct: p.discount_web_pct, discountPOSPct: p.discount_pos_pct, discountB2BPct: p.discount_b2b_pct,
        isBaesEligible: p.is_baes_eligible, coldChain: p.cold_chain, isWeighable: p.is_weighable,
        status: p.status, imageUrl: p.image_url,
        categoryId: p.category_id, categoryName: p.category_name,
        stockTotal: Number(p.stock_total ?? 0),
      },
    })
  } catch (err) {
    console.error('Barcode lookup error:', err)
    return c.json({ error: 'Error al buscar producto' }, 500)
  }
})

// Detalle completo — usado por cerebro en /products/[id]/edit (getProductById).
// Incluye sellos "Alto En" (Ley 20.606, product_sellos) y galería de imágenes
// (product_images). Adición post-entrega 2-sep-2026: POST/DELETE
// /api/products/:productId/images ya existen (ver más abajo) y guardan en
// disco local de este servicio (sin R2_* configurado) — el campo `url` se
// arma con R2_PUBLIC_URL si algún día se configura, y si no con
// API_PUBLIC_URL + /product-photos/:filename (misma ruta pública que sirve
// esas fotos). Antes de este cambio quedaba `null` siempre porque
// R2_PUBLIC_URL nunca existió y no había fallback.
app.get('/api/products/id/:id', async (c) => {
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const id = c.req.param('id')

  try {
    const [p] = await sql`
      SELECT
        p.id, p.sku, p.barcode, p.name, p.name_ko, p.slug, p.description, p.brand,
        p.cost_price, p.price_retail, p.price_web, p.price_pos, p.price_b2b,
        p.discount_web_pct, p.discount_pos_pct, p.discount_b2b_pct,
        p.weight_grams, p.is_weighable, p.is_baes_eligible, p.cold_chain, p.status, p.image_url,
        p.category_id, cat.name AS category_name,
        stock.qty_total AS stock_total, stock.next_expiry
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(i.quantity), 0) AS qty_total,
          MIN(i.expires_at) FILTER (WHERE i.quantity > 0 AND i.expires_at IS NOT NULL) AS next_expiry
        FROM inventory i
        WHERE i.product_id = p.id
      ) stock ON true
      WHERE p.id = ${id}
      LIMIT 1
    `

    if (!p) return c.json({ error: 'Producto no encontrado' }, 404)

    const [sellos, images] = await Promise.all([
      sql`SELECT sello FROM product_sellos WHERE product_id = ${id}`,
      sql`SELECT id, r2_key, sort_order FROM product_images WHERE product_id = ${id} ORDER BY sort_order ASC`,
    ])

    const r2PublicUrl = process.env.R2_PUBLIC_URL || ''

    return c.json({
      id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, nameKo: p.name_ko,
      slug: p.slug, description: p.description, brand: p.brand,
      costPrice: p.cost_price, priceRetail: p.price_retail, priceWeb: p.price_web,
      pricePOS: p.price_pos, priceB2B: p.price_b2b,
      discountWebPct: p.discount_web_pct, discountPOSPct: p.discount_pos_pct, discountB2BPct: p.discount_b2b_pct,
      weightGrams: p.weight_grams, isWeighable: p.is_weighable, isBaesEligible: p.is_baes_eligible,
      coldChain: p.cold_chain, status: p.status, imageUrl: p.image_url,
      categoryId: p.category_id, categoryName: p.category_name,
      stockTotal: Number(p.stock_total ?? 0), nextExpiry: p.next_expiry,
      sellos: sellos.map((s: any) => s.sello),
      images: images.map((im: any) => ({
        id: im.id,
        url: r2PublicUrl ? `${r2PublicUrl}/${im.r2_key}` : `${API_PUBLIC_URL}/product-photos/${im.r2_key}`,
        r2Key: im.r2_key,
        sortOrder: im.sort_order,
      })),
    })
  } catch (err) {
    console.error('Product detail error:', err)
    return c.json({ error: 'Error al obtener producto' }, 500)
  }
})

// PUT /api/products/:id (gap crítico — apps/cerebro/.../products/[id]/edit ya
// lo llama, 404 hoy). Mismo rol admin+ que el POST de arriba. Reemplaza
// product_sellos por completo (delete+insert) en vez de diffear — la lista es
// corta (4 posibles) y product-form.tsx siempre manda el array completo, no
// un delta. Audita cualquier cambio de precio con before/after explícito
// (costPrice/priceRetail/priceWeb/pricePOS/priceB2B) — es el hallazgo de S16
// que dejó esto documentado como deuda ("edición de precio no es auditable
// porque el endpoint no existe"), así que el audit log nace completo desde el
// día uno de este endpoint.
app.put('/api/products/:id', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const id = c.req.param('id')

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'JSON inválido' }, 400) }

  const sku  = String(body.sku ?? '').trim()
  const name = String(body.name ?? '').trim()
  const slug = String(body.slug ?? '').trim()
  const barcode = body.barcode ? String(body.barcode).trim() : null
  const priceRetail = Number(body.priceRetail)

  if (!sku || !name || !slug) return c.json({ error: 'SKU, nombre y slug son obligatorios' }, 400)
  if (!(priceRetail >= 0)) return c.json({ error: 'Precio retail inválido' }, 400)

  const coldChain = VALID_COLD_CHAIN.includes(body.coldChain) ? body.coldChain : 'ambient'
  const status    = VALID_PRODUCT_STATUS.includes(body.status) ? body.status : 'active'
  const sellos: string[] = Array.isArray(body.sellos) ? body.sellos.filter((s: any) => VALID_SELLOS.includes(s)) : []

  try {
    const [before] = await sql`SELECT * FROM products WHERE id = ${id}`
    if (!before) return c.json({ error: 'Producto no encontrado' }, 404)

    const [dupSku] = await sql`SELECT id FROM products WHERE sku = ${sku} AND id != ${id}`
    if (dupSku) return c.json({ error: 'Ya existe otro producto con ese SKU' }, 409)
    const [dupSlug] = await sql`SELECT id FROM products WHERE slug = ${slug} AND id != ${id}`
    if (dupSlug) return c.json({ error: 'Ya existe otro producto con ese slug' }, 409)
    if (barcode) {
      const [dupBarcode] = await sql`SELECT id FROM products WHERE barcode = ${barcode} AND id != ${id}`
      if (dupBarcode) return c.json({ error: 'Ya existe otro producto con ese código de barras' }, 409)
    }

    await sql`
      UPDATE products SET
        sku = ${sku}, barcode = ${barcode}, name = ${name}, name_ko = ${body.nameKo || null},
        slug = ${slug}, description = ${body.description || null}, brand = ${body.brand || null},
        category_id = ${body.categoryId || null},
        cost_price = ${body.costPrice ?? null}, price_retail = ${priceRetail},
        price_web = ${body.priceWeb ?? null}, price_pos = ${body.pricePOS ?? null}, price_b2b = ${body.priceB2B ?? null},
        discount_web_pct = ${Number(body.discountWebPct) || 0}, discount_pos_pct = ${Number(body.discountPOSPct) || 0}, discount_b2b_pct = ${Number(body.discountB2BPct) || 0},
        weight_grams = ${body.weightGrams ?? null}, is_weighable = ${!!body.isWeighable}, is_baes_eligible = ${!!body.isBaesEligible},
        cold_chain = ${coldChain}, status = ${status}, updated_at = NOW()
      WHERE id = ${id}
    `

    await sql`DELETE FROM product_sellos WHERE product_id = ${id}`
    for (const s of sellos) {
      await sql`INSERT INTO product_sellos (product_id, sello) VALUES (${id}, ${s})`
    }

    // Diff de precios para el audit log — antes/después solo de lo que cambió.
    const priceFieldMap: Array<[string, string, any]> = [
      ['costPrice',   'cost_price',   body.costPrice ?? null],
      ['priceRetail', 'price_retail', priceRetail],
      ['priceWeb',    'price_web',    body.priceWeb ?? null],
      ['pricePOS',    'price_pos',    body.pricePOS ?? null],
      ['priceB2B',    'price_b2b',    body.priceB2B ?? null],
    ]
    const priceChanges: Record<string, { before: any; after: any }> = {}
    for (const [key, col, afterVal] of priceFieldMap) {
      const beforeVal = before[col]
      if (String(beforeVal ?? '') !== String(afterVal ?? '')) {
        priceChanges[key] = { before: beforeVal, after: afterVal }
      }
    }

    await recordAuditLog(c, authUser, 'product.update', { table: 'products', id }, {
      sku, name,
      ...(Object.keys(priceChanges).length > 0 ? { priceChanges } : {}),
    })

    console.log(`✅ Product updated: ${sku} — ${name}${Object.keys(priceChanges).length > 0 ? ' (precio cambiado)' : ''}`)
    return c.json({ ok: true })
  } catch (err: any) {
    console.error('Update product error:', err)
    if (err?.code === '23505') return c.json({ error: 'SKU, slug o código de barras ya existe' }, 409)
    return c.json({ error: 'Error al actualizar el producto' }, 500)
  }
})

// POST /api/products/:productId/images (adición post-entrega, 2-sep-2026 —
// apps/cerebro/.../image-uploader.tsx ya llama esto, 404 hoy). Mismo rol
// admin+ que crear/editar producto de arriba y mismo patrón pragmático de
// disco local que POST /api/delivery/assignments/:id/pod (ver constantes
// PRODUCT_UPLOAD_DIR / GET /product-photos/:filename junto a POD arriba):
// sin credenciales R2 configuradas hoy, la foto se guarda en disco local de
// este servicio (Railway, efímero) y `product_images.r2_key` guarda el
// nombre de archivo local en vez de una key real de R2.
//
// DECISIÓN (pedida explícitamente en el brief): si el producto no tenía
// `image_url` (la portada que usa el catálogo público, GET /api/products) y
// esta es su primera foto en la galería, se usa automáticamente como
// portada — así aparece en la tienda sin un paso manual extra en el form.
// `image_url` se guarda ABSOLUTA (API_PUBLIC_URL + /product-photos/...) a
// propósito: apps/web (seoulshop.cl, Vercel) renderiza `imageUrl` con
// next/image, que exige una URL absoluta y un host en `images.remotePatterns`
// (apps/web/next.config.js) — se agregó `api.seoulshop.cl` a esa lista como
// parte de este mismo cambio, si no la portada auto-asignada rompería con
// el mismo 400 INVALID_IMAGE_OPTIMIZE_REQUEST que ya se diagnosticó en S17
// para hosts no declarados.
app.post('/api/products/:productId/images', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const { productId } = c.req.param()

  try {
    const [product] = await sql`SELECT id, image_url FROM products WHERE id = ${productId}`
    if (!product) return c.json({ error: 'Producto no encontrado' }, 404)

    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) return c.json({ error: 'Falta la imagen (campo "file")' }, 400)
    if (file.size === 0) return c.json({ error: 'Archivo vacío' }, 400)
    // Mismo límite que ya anuncia el frontend (image-uploader.tsx: "máx 5MB").
    if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Imagen demasiado grande (máx 5MB)' }, 400)

    const EXT_BY_MIME: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
    }
    const ext = EXT_BY_MIME[file.type]
    if (!ext) return c.json({ error: 'Formato no soportado (usa JPG, PNG, WebP o AVIF)' }, 400)

    const filename = `${productId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`

    fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(PRODUCT_UPLOAD_DIR, filename), buf)

    const [{ next_sort }] = await sql`
      SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_sort FROM product_images WHERE product_id = ${productId}
    `

    const [created] = await sql`
      INSERT INTO product_images (product_id, r2_key, sort_order)
      VALUES (${productId}, ${filename}, ${next_sort})
      RETURNING id
    `

    const absoluteUrl = `${API_PUBLIC_URL}/product-photos/${filename}`

    // Primera foto de un producto sin portada → se vuelve la portada automáticamente.
    if (!product.image_url && Number(next_sort) === 0) {
      await sql`UPDATE products SET image_url = ${absoluteUrl}, updated_at = NOW() WHERE id = ${productId}`
    }

    await recordAuditLog(c, authUser, 'product.image_upload', { table: 'product_images', id: created.id }, { productId, filename })

    console.log(`✅ Product image uploaded: ${productId} — ${filename}`)
    // image-uploader.tsx (apps/cerebro) hace `${API_BASE}${data.url}`, así que
    // `url` va relativo a la API — mismo shape que espera el frontend ya escrito.
    return c.json({ ok: true, id: created.id, url: `/product-photos/${filename}` })
  } catch (err) {
    console.error('Product image upload error:', err)
    return c.json({ error: 'Error al subir la imagen' }, 500)
  }
})

// DELETE /api/products/:productId/images/:imageId (adición post-entrega,
// 2-sep-2026 — contraparte del POST de arriba, también llamada ya por
// image-uploader.tsx, 404 hoy). Mismo rol admin+. Borra la fila y, de forma
// prolija, también el archivo físico en disco. Si la imagen borrada era la
// portada (`products.image_url`), promueve la siguiente imagen restante
// (menor sort_order) a portada, o limpia `image_url` si no queda ninguna —
// evita dejar la portada del catálogo apuntando a un archivo que ya no existe.
app.delete('/api/products/:productId/images/:imageId', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const { productId, imageId } = c.req.param()

  try {
    const [image] = await sql`SELECT id, r2_key FROM product_images WHERE id = ${imageId} AND product_id = ${productId}`
    if (!image) return c.json({ error: 'Imagen no encontrada' }, 404)

    const [product] = await sql`SELECT image_url FROM products WHERE id = ${productId}`

    await sql`DELETE FROM product_images WHERE id = ${imageId}`

    const deletedUrl = `${API_PUBLIC_URL}/product-photos/${image.r2_key}`
    if (product?.image_url === deletedUrl) {
      const [next] = await sql`
        SELECT r2_key FROM product_images WHERE product_id = ${productId} ORDER BY sort_order ASC LIMIT 1
      `
      const newImageUrl = next ? `${API_PUBLIC_URL}/product-photos/${next.r2_key}` : null
      await sql`UPDATE products SET image_url = ${newImageUrl}, updated_at = NOW() WHERE id = ${productId}`
    }

    // No es obligatorio (fuera del brief), pero evita basura acumulándose en
    // disco efímero de Railway — best-effort, nunca bloquea la respuesta.
    try {
      const filePath = path.join(PRODUCT_UPLOAD_DIR, path.basename(image.r2_key))
      if (filePath.startsWith(PRODUCT_UPLOAD_DIR) && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (fileErr) {
      console.error('Product image file cleanup error (non-fatal):', fileErr)
    }

    await recordAuditLog(c, authUser, 'product.image_delete', { table: 'product_images', id: imageId }, { productId })

    return c.json({ ok: true })
  } catch (err) {
    console.error('Product image delete error:', err)
    return c.json({ error: 'Error al borrar la imagen' }, 500)
  }
})

// GET /api/products/:slug (S10, Fase 3) — detalle público para la tienda
// (apps/web, producto/[slug]/page.tsx vía apiServerFetch, GET /api/products/${slug}).
// Contraparte pública de /api/products/id/:id de arriba (esa exige sesión
// staff y sirve a cerebro por id, no por slug). Siempre público, sin sesión —
// mismo criterio de privacidad de precios que GET /api/products (S03): nunca
// expone costPrice/priceB2B/pricePOS/discountXXXPct a un visitante. Solo
// status='active' es alcanzable por slug — un producto draft/discontinued
// nunca debe ser visible en la tienda pública así se conozca el slug exacto.
//
// Segmento único (`:slug`) — no colisiona con las rutas de arriba
// (meta/categories, barcode/:code, id/:id) porque todas tienen 2 segmentos
// después de /products y esta tiene 1; Hono las distingue por profundidad de
// ruta, no por orden de registro.
app.get('/api/products/:slug', async (c) => {
  const slug = c.req.param('slug')

  try {
    const [p] = await sql`
      SELECT
        p.id, p.sku, p.name, p.name_ko, p.slug, p.description, p.brand,
        p.price_retail, p.price_web,
        p.weight_grams, p.is_weighable, p.is_baes_eligible, p.cold_chain, p.status, p.image_url,
        p.category_id, cat.name AS category_name,
        stock.qty_total AS stock_total, stock.next_expiry
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(i.quantity), 0) AS qty_total,
          MIN(i.expires_at) FILTER (WHERE i.quantity > 0 AND i.expires_at IS NOT NULL) AS next_expiry
        FROM inventory i
        WHERE i.product_id = p.id
      ) stock ON true
      WHERE p.slug = ${slug} AND p.status = 'active'
      LIMIT 1
    `

    if (!p) return c.json({ error: 'Producto no encontrado' }, 404)

    const [sellos, images] = await Promise.all([
      sql`SELECT sello FROM product_sellos WHERE product_id = ${p.id}`,
      sql`SELECT id, r2_key, sort_order FROM product_images WHERE product_id = ${p.id} ORDER BY sort_order ASC`,
    ])

    const r2PublicUrl = process.env.R2_PUBLIC_URL || ''

    return c.json({
      id: p.id, sku: p.sku, name: p.name, nameKo: p.name_ko,
      slug: p.slug, description: p.description, brand: p.brand,
      priceRetail: p.price_retail, priceWeb: p.price_web,
      weightGrams: p.weight_grams, isWeighable: p.is_weighable, isBaesEligible: p.is_baes_eligible,
      coldChain: p.cold_chain, status: p.status, imageUrl: p.image_url,
      categoryId: p.category_id, categoryName: p.category_name,
      stockTotal: Number(p.stock_total ?? 0), nextExpiry: p.next_expiry,
      sellos: sellos.map((s: any) => s.sello),
      images: images.map((im: any) => ({
        id: im.id,
        url: r2PublicUrl ? `${r2PublicUrl}/${im.r2_key}` : null,
        r2Key: im.r2_key,
        sortOrder: im.sort_order,
      })),
    })
  } catch (err) {
    console.error('Product detail by slug error:', err)
    return c.json({ error: 'Error al obtener producto' }, 500)
  }
})

// Listado de lotes de inventario — usado por cerebro en /inventory (getInventory).
// Semáforo de vencimiento (expiryStatus) con los mismos umbrales que
// packages/ui/src/badge-expiry.tsx (getStatus): <0d vencido, <15d urgente,
// <30d por vencer, resto fresco. Filtros calcados de la UI: category (id o
// slug), expiry, cold_chain, baes.
app.get('/api/inventory', async (c) => {
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const category = c.req.query('category')?.trim()
  const expiry = c.req.query('expiry')?.trim()
  const coldChain = c.req.query('cold_chain')?.trim()
  const baes = c.req.query('baes')?.trim()
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '300', 10) || 300, 1), 1000)

  const categoryCond = category
    ? sql`AND (p.category_id::text = ${category} OR cat.slug = ${category})`
    : sql``

  const expiryCond = expiry && VALID_EXPIRY_FILTERS.includes(expiry)
    ? expiry === 'expired'
      ? sql`AND i.expires_at IS NOT NULL AND i.expires_at < NOW()`
      : expiry === 'urgent'
        ? sql`AND i.expires_at IS NOT NULL AND i.expires_at >= NOW() AND i.expires_at < NOW() + INTERVAL '15 days'`
        : expiry === 'warning'
          ? sql`AND i.expires_at IS NOT NULL AND i.expires_at >= NOW() + INTERVAL '15 days' AND i.expires_at < NOW() + INTERVAL '30 days'`
          : sql`AND i.expires_at IS NOT NULL AND i.expires_at >= NOW() + INTERVAL '30 days'`
    : sql``

  const coldChainCond = coldChain && VALID_COLD_CHAIN.includes(coldChain)
    ? sql`AND p.cold_chain = ${coldChain}`
    : sql``

  const baesCond = baes === 'true' ? sql`AND p.is_baes_eligible = true` : sql``

  try {
    const rows = await sql`
      SELECT
        i.id, i.product_id, p.name AS product_name, p.sku, p.brand,
        i.lot, i.quantity, i.expires_at, i.location,
        p.cold_chain, p.is_baes_eligible, cat.name AS category_name,
        CASE
          WHEN i.expires_at IS NULL THEN NULL
          WHEN i.expires_at < NOW() THEN 'expired'
          WHEN i.expires_at < NOW() + INTERVAL '15 days' THEN 'urgent'
          WHEN i.expires_at < NOW() + INTERVAL '30 days' THEN 'warning'
          ELSE 'fresh'
        END AS expiry_status,
        COUNT(*) OVER() AS full_count
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE 1=1 ${categoryCond} ${expiryCond} ${coldChainCond} ${baesCond}
      ORDER BY i.expires_at ASC NULLS LAST
      LIMIT ${limit}
    `

    return c.json({
      items: rows.map((r: any) => ({
        id: r.id, productId: r.product_id, productName: r.product_name, sku: r.sku,
        brand: r.brand, lot: r.lot, quantity: r.quantity,
        expiresAt: r.expires_at, location: r.location,
        coldChain: r.cold_chain, isBaesEligible: r.is_baes_eligible,
        categoryName: r.category_name, expiryStatus: r.expiry_status,
      })),
      total: rows.length > 0 ? Number(rows[0].full_count) : 0,
    })
  } catch (err) {
    console.error('List inventory error:', err)
    return c.json({ error: 'Error al listar inventario' }, 500)
  }
})

// ============================================================================
// INVENTARIO CONSOLIDADO DENTRO DE EDITAR PRODUCTO (adición post-entrega,
// 2-sep-2026 — pedido explícito del dueño). Antes de esta sesión existía un
// flujo separado "Ingresar lote de inventario" (modal con selector de
// producto, apps/cerebro/.../inventory-lot-modal.tsx) que llamaba a
// POST /api/inventory/lot — un endpoint que NUNCA existió en el backend
// (grep confirmado antes de escribir código, 0 resultados), así que ese
// modal estaba 404-eando en silencio desde que se escribió, igual que las
// acciones inline +/-/vencido de inventory-row.tsx (POST /api/inventory/adjust,
// GET /api/inventory/:productId/movements — tampoco existían). El dueño pidió
// consolidar ese flujo DENTRO de Editar Producto — estos 3 endpoints nuevos
// reemplazan a los 3 rotos de arriba, con contexto de producto explícito en
// vez de un selector suelto, y GET .../movements reemplaza al historial
// inline del expand-row de la vista general (que ahora es de solo lectura).
// ============================================================================

// GET /api/products/:id/inventory — lotes actuales del producto + resumen de
// stock. Cualquier sesión de staff (misma apertura que GET /api/inventory
// general, sin restricción de rol — es lectura).
app.get('/api/products/:id/inventory', async (c) => {
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const productId = c.req.param('id')

  try {
    const [product] = await sql`SELECT id, name, sku FROM products WHERE id = ${productId}`
    if (!product) return c.json({ error: 'Producto no encontrado' }, 404)

    const lots = await sql`
      SELECT id, lot, quantity, expires_at, cost_per_unit, location, created_at,
        CASE
          WHEN expires_at IS NULL THEN NULL
          WHEN expires_at < NOW() THEN 'expired'
          WHEN expires_at < NOW() + INTERVAL '15 days' THEN 'urgent'
          WHEN expires_at < NOW() + INTERVAL '30 days' THEN 'warning'
          ELSE 'fresh'
        END AS expiry_status
      FROM inventory
      WHERE product_id = ${productId}
      ORDER BY expires_at ASC NULLS LAST, created_at DESC
    `

    const qtyTotal = lots.reduce((acc: number, l: any) => acc + Number(l.quantity), 0)

    return c.json({
      product: { id: product.id, name: product.name, sku: product.sku },
      qtyTotal,
      lots: lots.map((l: any) => ({
        id: l.id, lot: l.lot, quantity: Number(l.quantity),
        expiresAt: l.expires_at, costPerUnit: l.cost_per_unit != null ? Number(l.cost_per_unit) : null,
        location: l.location, createdAt: l.created_at, expiryStatus: l.expiry_status,
      })),
    })
  } catch (err) {
    console.error('Get product inventory error:', err)
    return c.json({ error: 'Error al obtener inventario del producto' }, 500)
  }
})

// POST /api/products/:id/inventory — agrega un lote nuevo. Reemplaza lo que
// hacía el modal "Ingresar lote de inventario" (ahora deprecado, ver
// apps/cerebro/.../inventory-lot-button.tsx), pero en el contexto del
// producto que ya se está editando en vez de un selector separado. Rol
// owner/admin (mismo criterio que crear/editar producto). Registra el
// movimiento en inventory_movements con type='purchase' — un lote nuevo es
// una entrada de stock, no un ajuste.
app.post('/api/products/:id/inventory', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const productId = c.req.param('id')

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'JSON inválido' }, 400) }

  const quantity = Number(body.quantity)
  if (!(quantity > 0)) return c.json({ error: 'La cantidad debe ser mayor a 0' }, 400)

  const costPerUnit = body.costPerUnit != null && body.costPerUnit !== '' ? Number(body.costPerUnit) : null
  const location = body.location ? String(body.location).trim() : 'main'
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  const lot = body.lot ? String(body.lot).trim() : null
  const notes = body.notes ? String(body.notes).trim() : 'Ingreso de lote desde Editar Producto'

  try {
    const [product] = await sql`SELECT id FROM products WHERE id = ${productId}`
    if (!product) return c.json({ error: 'Producto no encontrado' }, 404)

    const [created] = await sql`
      INSERT INTO inventory (product_id, lot, quantity, expires_at, cost_per_unit, location)
      VALUES (${productId}, ${lot}, ${quantity}, ${expiresAt}, ${costPerUnit}, ${location})
      RETURNING id, created_at
    `

    await sql`
      INSERT INTO inventory_movements (product_id, inventory_id, type, quantity, notes, created_by)
      VALUES (${productId}, ${created.id}, 'purchase', ${quantity}, ${notes}, ${authUser.id})
    `

    await recordAuditLog(c, authUser, 'inventory.lot_create', { table: 'inventory', id: created.id }, {
      productId, quantity, costPerUnit, location, expiresAt: body.expiresAt ?? null,
    })

    console.log(`✅ Inventory lot created: product ${productId} — qty ${quantity}`)
    return c.json({ ok: true, id: created.id, createdAt: created.created_at })
  } catch (err) {
    console.error('Create inventory lot error:', err)
    return c.json({ error: 'Error al ingresar el lote' }, 500)
  }
})

// GET /api/products/:id/inventory/movements — historial de movimientos del
// producto (reemplaza GET /api/inventory/:productId/movements, que
// inventory-row.tsx ya llamaba pero nunca existió en el backend — mismo gap
// que POST /api/inventory/lot de arriba). Sirve tanto a la sección
// "Inventario" de Editar Producto como al expand-row de solo lectura de la
// vista general de Inventario.
app.get('/api/products/:id/inventory/movements', async (c) => {
  const authUser = await requireSession(c)
  if (authUser instanceof Response) return authUser

  const productId = c.req.param('id')
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '30', 10) || 30, 1), 200)

  try {
    const rows = await sql`
      SELECT m.id, m.type, m.quantity, m.notes, m.created_at, m.created_by, u.name AS created_by_name
      FROM inventory_movements m
      LEFT JOIN users u ON u.id = m.created_by
      WHERE m.product_id = ${productId}
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `
    return c.json({
      movements: rows.map((m: any) => ({
        id: m.id, type: m.type, quantity: Number(m.quantity), notes: m.notes,
        createdAt: m.created_at, createdByName: m.created_by_name ?? null,
      })),
    })
  } catch (err) {
    console.error('Product inventory movements error:', err)
    return c.json({ error: 'Error al obtener movimientos' }, 500)
  }
})

// PATCH /api/inventory/:lotId — ajusta la cantidad de un lote existente
// (subir, bajar, o dar de baja con quantity:0). EXIGE `reason` en el body —
// requisito explícito del dueño ("que cada cambio pida un motivo/explicación
// al guardar, para llevar control"). Registra en inventory_movements con
// type='adjustment' y el motivo como notes. Rol owner/admin.
app.patch('/api/inventory/:lotId', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const lotId = c.req.param('lotId')

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ error: 'JSON inválido' }, 400) }

  const newQuantity = Number(body.quantity)
  const reason = body.reason ? String(body.reason).trim() : ''

  if (!(newQuantity >= 0)) return c.json({ error: 'La cantidad debe ser 0 o mayor' }, 400)
  if (!reason) return c.json({ error: 'El motivo del ajuste es obligatorio' }, 400)

  try {
    const [lot] = await sql`SELECT id, product_id, quantity FROM inventory WHERE id = ${lotId}`
    if (!lot) return c.json({ error: 'Lote no encontrado' }, 404)

    const delta = newQuantity - Number(lot.quantity)
    if (delta === 0) {
      return c.json({ ok: true, unchanged: true, quantity: newQuantity })
    }

    await sql`UPDATE inventory SET quantity = ${newQuantity} WHERE id = ${lotId}`

    const movementType = newQuantity === 0 ? 'expired' : 'adjustment'
    await sql`
      INSERT INTO inventory_movements (product_id, inventory_id, type, quantity, notes, created_by)
      VALUES (${lot.product_id}, ${lotId}, ${movementType}, ${delta}, ${reason}, ${authUser.id})
    `

    await recordAuditLog(c, authUser, 'inventory.adjust', { table: 'inventory', id: lotId }, {
      productId: lot.product_id, before: Number(lot.quantity), after: newQuantity, delta, reason,
    })

    console.log(`✅ Inventory lot adjusted: ${lotId} — ${Number(lot.quantity)} → ${newQuantity} (${reason})`)
    return c.json({ ok: true, quantity: newQuantity, delta })
  } catch (err) {
    console.error('Adjust inventory lot error:', err)
    return c.json({ error: 'Error al ajustar el lote' }, 500)
  }
})

// ============================================================================
// ORDERS + DASHBOARD (S04 — Fase 1, Comandas + Dashboard)
// ============================================================================
// Todo lo de aquí abajo requiere sesión de staff SIEMPRE (a diferencia de
// /api/products y /api/categories, que S03 tuvo que abrir con getOptionalSession
// porque la tienda pública los consume sin login). Se verificó con grep en las 4
// apps (`grep -rn "api/dashboard\|api/orders" apps/*/src`) que ni Comandas ni
// Dashboard son consumidos por apps/web (tienda pública) — solo por apps/cerebro
// (Dashboard, Comandas) y apps/pos (polling de pedidos entrantes, fallback de SSE
// de Fase 2/S08). Ningún dato aquí incluye costPrice/priceB2B/pricePOS ni margen —
// son pedidos y agregados de ventas, no el catálogo con precios internos.

const VALID_ORDER_STATUS  = ['nueva', 'preparando', 'lista', 'en_ruta', 'entregada', 'cancelada']
const VALID_ORDER_CHANNEL = ['pos', 'web', 'b2b', 'whatsapp']

// GET /api/orders — listar pedidos con filtros opcionales (status, channel, limit).
// Consumido por cerebro (`getRecentOrders`, Dashboard → tabla "Últimos pedidos",
// solo ?limit) y por POS (`order-events.ts`, fallback de polling cuando el SSE de
// S08 aún no existe, con ?channel=web&status=nueva&limit=10). Roles: owner/admin/
// staff (POS lo usa en operación diaria) + viewer (solo lectura de Dashboard).
app.get('/api/orders', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff', 'viewer'])
  if (authUser instanceof Response) return authUser

  const status  = c.req.query('status')?.trim()
  const channel = c.req.query('channel')?.trim()
  const limit   = Math.min(Math.max(parseInt(c.req.query('limit') || '20', 10) || 20, 1), 200)

  const statusCond = status && VALID_ORDER_STATUS.includes(status)
    ? sql`AND o.status = ${status}`
    : sql``
  const channelCond = channel && VALID_ORDER_CHANNEL.includes(channel)
    ? sql`AND o.channel = ${channel}`
    : sql``

  try {
    const rows = await sql`
      SELECT
        o.id, o.number, o.channel, o.status, o.delivery_mode,
        o.metro_station, o.metro_slot, o.notes, o.total, o.created_at,
        COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE 1=1 ${statusCond} ${channelCond}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `

    return c.json({
      orders: rows.map((r: any) => ({
        // `id` es el contrato de cerebro (RecentOrdersTable); `orderId` es un alias
        // para el tipo IncomingOrder que espera POS en su fallback de polling — las
        // dos apps consumen esta misma lista con nombres de campo distintos.
        id: r.id, orderId: r.id, number: r.number, channel: r.channel, status: r.status,
        deliveryMode: r.delivery_mode, metroStation: r.metro_station, metroSlot: r.metro_slot,
        notes: r.notes, total: r.total, itemCount: Number(r.item_count ?? 0),
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('List orders error:', err)
    return c.json({ error: 'Error al listar pedidos' }, 500)
  }
})

// GET /api/orders/comandas — vista Kanban de Comandas (cerebro): pedidos activos
// (nueva/preparando/lista — NO incluye en_ruta/entregada/cancelada) agrupados por
// columna. Roles: owner/admin/staff (matriz de sección 6.1 — viewer no ve Comandas).
app.get('/api/orders/comandas', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT
        o.id, o.number, o.channel, o.status, o.delivery_mode,
        o.metro_station, o.metro_slot, o.total, o.dte_status, o.created_at,
        o.payment_status, o.payment_method, o.company_id, o.ready_at,
        comp.razon_social,
        COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN b2b_companies comp ON comp.id = o.company_id
      WHERE o.status IN ('nueva', 'preparando', 'lista')
      GROUP BY o.id, comp.razon_social
      ORDER BY o.created_at ASC
    `

    const comandas = rows.map((r: any) => ({
      id: r.id, number: r.number, channel: r.company_id ? 'b2b' : r.channel, status: r.status,
      deliveryMode: r.delivery_mode, metroStation: r.metro_station, metroSlot: r.metro_slot,
      total: r.total, dteStatus: r.dte_status, createdAt: r.created_at,
      itemCount: Number(r.item_count ?? 0),
      // Adición post-entrega — flujo de pago web (ver POST
      // /api/orders/:id/confirm-payment). Solo es relevante para channel='web'
      // (POS ya nace payment_status='confirmed', ver migración 0021).
      paymentStatus: r.payment_status,
      paymentMethod: r.payment_method,
      // Rediseño B2B (adición post-entrega, 2-sep-2026): companyId habilita
      // el botón de cargo a crédito; razonSocial se muestra en la tarjeta;
      // readyAt habilita el botón "Marcar listo" para pickup/metro.
      companyId: r.company_id,
      razonSocial: r.razon_social,
      readyAt: r.ready_at,
    }))

    return c.json({
      nueva:      comandas.filter((o: any) => o.status === 'nueva'),
      preparando: comandas.filter((o: any) => o.status === 'preparando'),
      lista:      comandas.filter((o: any) => o.status === 'lista'),
    })
  } catch (err) {
    console.error('Comandas error:', err)
    return c.json({ error: 'Error al listar comandas' }, 500)
  }
})

// GET /api/dashboard/stats — KPIs del panel (cerebro Dashboard). Roles: owner/
// admin/viewer (matriz de sección 6.1 — staff no tiene Dashboard en su matriz;
// coincide con `nav[]` de sidebar.tsx: Dashboard → ['owner','admin','viewer']).
app.get('/api/dashboard/stats', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'viewer'])
  if (authUser instanceof Response) return authUser

  try {
    const [salesToday] = await sql`
      SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cnt
      FROM orders
      WHERE created_at::date = CURRENT_DATE AND status != 'cancelada' AND voided_at IS NULL
    `
    const [salesYesterday] = await sql`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM orders
      WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day' AND status != 'cancelada' AND voided_at IS NULL
    `
    const [activeOrders] = await sql`
      SELECT COUNT(*) AS cnt FROM orders WHERE status IN ('nueva', 'preparando', 'lista', 'en_ruta')
    `
    const [webPending] = await sql`
      SELECT COUNT(*) AS cnt FROM orders
      WHERE channel = 'web' AND status NOT IN ('entregada', 'cancelada')
    `
    // "B2B sin cobrar" (label del KPI en cerebro): sin sistema de wallet/cobranza
    // B2B todavía (Fase 3, S11/S12 — GET /api/b2b/wallet no existe), se define como
    // cotizaciones enviadas al cliente y aún sin resolver (sent/viewed) — lo más
    // cercano a "pendiente" que el modelo de datos permite hoy sin inventar columnas.
    const [b2bPending] = await sql`
      SELECT COUNT(*) AS cnt FROM b2b_quotes WHERE status IN ('sent', 'viewed')
    `
    const [expiringWeek] = await sql`
      SELECT COUNT(DISTINCT product_id) AS cnt FROM inventory
      WHERE quantity > 0 AND expires_at IS NOT NULL
        AND expires_at >= NOW() AND expires_at < NOW() + INTERVAL '7 days'
    `
    // "Stock crítico": no existe columna min_stock en products (packages/db/src/
    // schema/products.ts) — se usa un umbral fijo de 5 unidades totales por
    // producto activo, mismo tipo de decisión pragmática que S03 tomó con
    // inventory_summary (tabla derivada sin trigger, se calcula en vivo).
    const CRITICAL_STOCK_THRESHOLD = 5
    const [criticalStock] = await sql`
      SELECT COUNT(*) AS cnt FROM (
        SELECT p.id
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE p.status = 'active'
        GROUP BY p.id
        HAVING COALESCE(SUM(i.quantity), 0) <= ${CRITICAL_STOCK_THRESHOLD}
      ) low_stock
    `
    const top5 = await sql`
      SELECT p.id AS product_id, p.name, SUM(oi.quantity) AS units, SUM(oi.subtotal) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.created_at::date = CURRENT_DATE AND o.status != 'cancelada' AND o.voided_at IS NULL
      GROUP BY p.id, p.name
      ORDER BY units DESC
      LIMIT 5
    `

    const ventasHoy  = Number(salesToday.total)
    const ventasAyer = Number(salesYesterday.total)
    const deltaVentas = ventasAyer > 0 ? ((ventasHoy - ventasAyer) / ventasAyer) * 100 : null
    const ticketPromedio = Number(salesToday.cnt) > 0 ? ventasHoy / Number(salesToday.cnt) : 0

    return c.json({
      ventasHoy, ventasAyer, deltaVentas, ticketPromedio,
      pedidosActivos: Number(activeOrders.cnt),
      pedidosWebSinDespachar: Number(webPending.cnt),
      b2bPendientes: Number(b2bPending.cnt),
      vencenEstaSemana: Number(expiringWeek.cnt),
      stockCritico: Number(criticalStock.cnt),
      top5Productos: top5.map((r: any) => ({
        productId: r.product_id, name: r.name, units: Number(r.units), revenue: Number(r.revenue),
      })),
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return c.json({ error: 'Error al calcular estadísticas' }, 500)
  }
})

// GET /api/dashboard/alerts — semáforo de vencimiento + DTE fallidos (cerebro
// Dashboard, banners superiores). Roles: owner/admin/viewer (misma matriz que stats).
// Umbral de "urgentes" (3 días) sigue el copy hardcodeado en dashboard/page.tsx
// ("vencen en menos de 3 días") — es un umbral MÁS estricto que el semáforo de
// /api/inventory (15/30 días, BadgeExpiry), a propósito: esto es la alerta crítica
// del Dashboard, no la navegación completa del inventario.
app.get('/api/dashboard/alerts', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'viewer'])
  if (authUser instanceof Response) return authUser

  try {
    const vencidos = await sql`
      SELECT p.id AS product_id, p.name, SUM(i.quantity) AS quantity, MIN(i.expires_at) AS expires_at
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.quantity > 0 AND i.expires_at IS NOT NULL AND i.expires_at < NOW()
      GROUP BY p.id, p.name
      ORDER BY expires_at ASC
    `
    const urgentes = await sql`
      SELECT p.id AS product_id, p.name, SUM(i.quantity) AS quantity, MIN(i.expires_at) AS expires_at
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.quantity > 0 AND i.expires_at IS NOT NULL
        AND i.expires_at >= NOW() AND i.expires_at < NOW() + INTERVAL '3 days'
      GROUP BY p.id, p.name
      ORDER BY expires_at ASC
    `
    const dtesFallidos = await sql`
      SELECT id, number FROM orders WHERE dte_status = 'failed' ORDER BY created_at DESC LIMIT 20
    `

    const vencidosOut = vencidos.map((r: any) => ({
      productId: r.product_id, name: r.name, quantity: Number(r.quantity), expiresAt: r.expires_at,
    }))
    const urgentesOut = urgentes.map((r: any) => ({
      productId: r.product_id, name: r.name, quantity: Number(r.quantity), expiresAt: r.expires_at,
    }))
    const dtesFallidosOut = dtesFallidos.map((r: any) => ({ id: r.id, number: r.number }))

    return c.json({
      vencidos: vencidosOut,
      urgentes: urgentesOut,
      dtesFallidos: dtesFallidosOut,
      hasAlerts: vencidosOut.length > 0 || urgentesOut.length > 0 || dtesFallidosOut.length > 0,
    })
  } catch (err) {
    console.error('Dashboard alerts error:', err)
    return c.json({ error: 'Error al calcular alertas' }, 500)
  }
})

// ============================================================================
// SEGURIDAD / LEGAL — ARCOP (Ley 21.719) + DEVOLUCIONES (S13, Fase 4)
// ============================================================================
// GET /api/arcop y GET /api/returns: apps/cerebro/.../seguridad/page.tsx
// (ver apps/cerebro/src/lib/api.ts getARCOP/getReturns — Server Component que
// reenvía la cookie seul_session a mano, mismo patrón que dashboard/inventory/
// customers). Roles owner/admin, matriz sección 6.1 ("Seguridad").
//
// POST /api/arcop y POST /api/returns: PÚBLICOS, sin sesión — ya consumidos
// por apps/web/.../privacidad/page.tsx y apps/web/.../devoluciones/page.tsx
// (confirmados por grep antes de escribir esta ruta, lección de hoy). La Ley
// 21.719 exige que CUALQUIER persona pueda ejercer sus derechos ARCOP, tenga
// o no cuenta, así que no usan requireCustomerSession. Devoluciones tampoco
// exige cuenta: hoy el checkout emite Nota de Venta (no boleta SII real —
// S12 pospuesto post-entrega), así que el orderId es la única referencia
// confiable, igual que el flujo real de post-venta por WhatsApp.

function addBusinessDays(from: Date, days: number): Date {
  // Feriados chilenos no se calculan aquí (no hay tabla de feriados en el
  // sistema hoy) — solo se saltan sábado/domingo. Suficiente para el umbral
  // "≤3 días" que usa el panel de Seguridad; una discrepancia de 1-2 días
  // por feriado no cambia el semáforo salvo casos límite.
  const d = new Date(from)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

const ARCOP_TYPES = ['access', 'rectification', 'deletion', 'portability']

app.post('/api/arcop', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const type  = String(body.type || '').trim()
  const name  = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const notes = String(body.notes || '').trim()

  if (!ARCOP_TYPES.includes(type)) {
    return c.json({ ok: false, error: 'Tipo de solicitud inválido.' }, 400)
  }
  if (!name || !email || notes.length < 10) {
    return c.json({ ok: false, error: 'Completa todos los campos obligatorios.' }, 400)
  }
  if (!isValidEmail(email)) {
    return c.json({ ok: false, error: 'Correo electrónico inválido.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'arcop:create', { limit: 10, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const [existingCustomer] = await sql`
      SELECT id FROM customers WHERE lower(email) = ${email} AND deleted_at IS NULL LIMIT 1
    `
    const customerId = existingCustomer?.id ?? null
    const deadline = addBusinessDays(new Date(), 15) // Ley 21.719: 15 días hábiles

    const [created] = await sql`
      INSERT INTO arcop_requests (customer_id, type, status, notes, name, email, deadline)
      VALUES (${customerId}, ${type}, 'pending', ${notes}, ${name}, ${email}, ${deadline})
      RETURNING id, deadline
    `

    const deadlineLabel = created.deadline ? new Date(created.deadline).toLocaleDateString('es-CL') : ''

    enqueueEmail(
      email,
      'Solicitud ARCOP recibida — Seoul Kims',
      `<p>Hola ${name}, recibimos tu solicitud de <strong>${type}</strong> sobre tus datos personales (Ley 21.719). Te responderemos a este correo antes del ${deadlineLabel}.</p>`,
      'contact-form-reply'
    ).catch(err => console.error('ARCOP confirm email error:', err))

    enqueueEmail(
      ADMIN_EMAIL,
      `🛡️ Nueva solicitud ARCOP — ${type}`,
      `<p>${name} (${email}) solicitó <strong>${type}</strong>. Plazo de respuesta: ${deadlineLabel}.</p><p>${notes}</p>`,
      'contact-form-reply'
    ).catch(err => console.error('ARCOP admin email error:', err))

    return c.json({ ok: true, requestId: created.id, deadline: created.deadline })
  } catch (err) {
    console.error('ARCOP create error:', err)
    return c.json({ ok: false, error: 'No se pudo registrar la solicitud. Intenta de nuevo o escríbenos a contacto@seoulshop.cl.' }, 500)
  }
})

app.get('/api/arcop', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  try {
    const rows = await sql`
      SELECT id, type, status, notes, name, email, deadline, created_at, resolved_at
      FROM arcop_requests
      ORDER BY (status = 'pending') DESC, deadline ASC NULLS LAST, created_at DESC
      LIMIT 200
    `
    return c.json({
      requests: rows.map((r: any) => ({
        id: r.id, type: r.type, status: r.status, notes: r.notes,
        name: r.name, email: r.email, deadline: r.deadline,
        createdAt: r.created_at, resolvedAt: r.resolved_at,
      })),
    })
  } catch (err) {
    console.error('ARCOP list error:', err)
    return c.json({ error: 'Error al listar solicitudes ARCOP' }, 500)
  }
})

// ── Devoluciones (returns) ──────────────────────────────────────────────────

const RETURN_TYPES = ['defective', 'wrong_item', 'changed_mind', 'other']

app.post('/api/returns', async (c) => {
  let body: any = {}
  try {
    body = JSON.parse(await c.req.text())
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const orderId = String(body.orderId || '').trim()
  const type    = String(body.type || '').trim()
  const reason  = String(body.reason || '').trim()

  if (!orderId || !RETURN_TYPES.includes(type) || reason.length < 10) {
    return c.json({ error: 'Completa todos los campos obligatorios.' }, 400)
  }

  const rl = await checkAndRecordRateLimit(c, 'returns:create', { limit: 20, windowMinutes: 5 })
  if (!rl.allowed) {
    return c.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  try {
    const [order] = await sql`SELECT id, customer_id, number FROM orders WHERE id = ${orderId} LIMIT 1`
    if (!order) {
      return c.json({ error: 'No encontramos ese pedido. Revisa el ID e intenta de nuevo.' }, 404)
    }

    const [created] = await sql`
      INSERT INTO returns (order_id, customer_id, type, reason, status)
      VALUES (${order.id}, ${order.customer_id}, ${type}, ${reason}, 'pending')
      RETURNING id
    `

    enqueueEmail(
      ADMIN_EMAIL,
      `↩️ Nueva devolución — Pedido #${order.number ?? String(order.id).slice(0, 8)}`,
      `<p>Tipo: <strong>${type}</strong></p><p>${reason}</p>`,
      'contact-form-reply'
    ).catch(err => console.error('Return admin email error:', err))

    return c.json({ ok: true, returnId: created.id })
  } catch (err: any) {
    console.error('Return create error:', err)
    if (err?.code === '22P02') {
      return c.json({ error: 'ID de pedido inválido.' }, 400)
    }
    return c.json({ error: 'No se pudo registrar la devolución. Escríbenos a contacto@seoulshop.cl.' }, 500)
  }
})

app.get('/api/returns', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin'])
  if (authUser instanceof Response) return authUser

  const status = c.req.query('status')
  const statusCond = status && ['pending', 'approved', 'rejected', 'processed'].includes(status)
    ? sql`WHERE r.status = ${status}`
    : sql``

  try {
    const rows = await sql`
      SELECT r.id, r.order_id, r.customer_id, r.type, r.reason, r.refund_amount_clp,
             r.resolution, r.status, r.notes, r.created_at, r.resolved_at
      FROM returns r
      ${statusCond}
      ORDER BY r.created_at DESC
      LIMIT 200
    `
    return c.json({
      returns: rows.map((r: any) => ({
        id: r.id, orderId: r.order_id, customerId: r.customer_id, type: r.type,
        reason: r.reason, refundAmountClp: r.refund_amount_clp, resolution: r.resolution,
        status: r.status, notes: r.notes, createdAt: r.created_at, resolvedAt: r.resolved_at,
      })),
    })
  } catch (err) {
    console.error('Returns list error:', err)
    return c.json({ error: 'Error al listar devoluciones' }, 500)
  }
})

// ============================================================================
// AUDIT LOG (S16, Fase 5 — Hardening)
// GET /api/audit-log — owner-only, paginado. Consumido por
// apps/cerebro/.../auditoria/page.tsx. Filtros opcionales: ?action=,
// ?actorEmail= (match parcial), ?entityTable=, ?from=/?to= (ISO date),
// ?page=/?pageSize= (default 1/50, máx 200 por página).
// ============================================================================

app.get('/api/audit-log', async (c) => {
  const authUser = await requireSession(c, ['owner'])
  if (authUser instanceof Response) return authUser

  const page = Math.max(parseInt(c.req.query('page') || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(c.req.query('pageSize') || '50', 10) || 50, 1), 200)
  const offset = (page - 1) * pageSize

  const action = c.req.query('action')?.trim() || null
  const actorEmail = c.req.query('actorEmail')?.trim() || null
  const entityTable = c.req.query('entityTable')?.trim() || null
  const from = c.req.query('from')?.trim() || null
  const to = c.req.query('to')?.trim() || null

  const conditions = []
  if (action) conditions.push(sql`action = ${action}`)
  if (actorEmail) conditions.push(sql`actor_email ILIKE ${'%' + actorEmail + '%'}`)
  if (entityTable) conditions.push(sql`entity_table = ${entityTable}`)
  if (from) conditions.push(sql`created_at >= ${from}`)
  if (to) conditions.push(sql`created_at <= ${to}`)

  let whereClause = sql``
  for (let i = 0; i < conditions.length; i++) {
    whereClause = i === 0 ? sql`WHERE ${conditions[i]}` : sql`${whereClause} AND ${conditions[i]}`
  }

  try {
    const rows = await sql`
      SELECT id, actor_user_id, actor_email, actor_role, action, entity_table, entity_id,
             details, ip_address, user_agent, created_at
      FROM audit_log
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
    const [countRow] = await sql`SELECT count(*)::int AS n FROM audit_log ${whereClause}`

    return c.json({
      entries: rows.map((r: any) => ({
        id: r.id,
        actorUserId: r.actor_user_id,
        actorEmail: r.actor_email,
        actorRole: r.actor_role,
        action: r.action,
        entityTable: r.entity_table,
        entityId: r.entity_id,
        details: r.details,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        createdAt: r.created_at,
      })),
      page,
      pageSize,
      total: countRow?.n ?? 0,
    })
  } catch (err) {
    console.error('Audit log list error:', err)
    return c.json({ error: 'Error al listar el registro de auditoría' }, 500)
  }
})

// ============================================================================
// ANALYTICS + FAQ (S14, Fase 4)
// GET /api/analytics/sales + POST /api/analytics/pin-check — el único consumidor
// real (confirmado por grep en las 4 apps) es apps/pos/.../sales-history-panel.tsx:
// un drawer "Ventas de caja" en el POS gateado por un PIN de 4 dígitos propio
// (`analytics_pin` en tienda_config — clave DISTINTA de `void_pin`, el PIN
// maestro que autoriza anular una venta ya construido en el flujo de Ajustes/
// Seguridad). No existe pantalla "Reportes" en cerebro hoy (grep confirmó cero
// resultados) pese a que la matriz de roles de la sección 6.1 la menciona para
// `viewer` — construir esa pantalla no está en el alcance de S14 (ningún
// frontend la espera todavía), así que este endpoint solo cubre el contrato
// exacto que sales-history-panel.tsx ya tiene escrito, filtrado siempre por
// tillSessionId (nunca "todas las ventas de la tienda" sin acotar).
// ============================================================================

app.post('/api/analytics/pin-check', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  // Rate limit — 4 dígitos son solo 10.000 combinaciones, así que esto es lo
  // único que protege el PIN de un ataque de fuerza bruta desde una sesión
  // válida de cajero. Mismo patrón (bucket por usuario) que auth:register.
  const rl = await checkAndRecordRateLimit(c, 'analytics:pin-check', { limit: 10, windowMinutes: 5 }, authUser.id)
  if (!rl.allowed) {
    return c.json({ ok: false, error: `Demasiados intentos. Intenta de nuevo en ${rl.retryAfterMinutes} minutos.` }, 429)
  }

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'JSON inválido' }, 400) }
  const pin = String(body.pin ?? '')
  if (!pin) return c.json({ ok: false, error: 'PIN requerido' }, 400)

  try {
    const [row] = await sql`SELECT value FROM tienda_config WHERE key = 'analytics_pin'`
    // Sin PIN configurado todavía → deniega por defecto (nunca un fallback
    // hardcodeado tipo 'abcd' como el bug ya documentado de getVoidPin en
    // seguridad/page.tsx — ver fix en el mismo commit de esta sesión).
    const ok = row?.value != null && row.value === pin
    return c.json({ ok })
  } catch (err) {
    console.error('Analytics pin-check error:', err)
    return c.json({ ok: false, error: 'Error' }, 500)
  }
})

app.get('/api/analytics/sales', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  const tillSessionId = c.req.query('tillSessionId')
  if (!tillSessionId) return c.json({ error: 'Falta tillSessionId' }, 400)

  try {
    const orderRows = await sql`
      SELECT id, number, total, status, dte_type, created_at, voided_at, void_reason
      FROM orders
      WHERE till_session_id = ${tillSessionId}
      ORDER BY created_at DESC
      LIMIT 500
    `
    const paymentRows = await sql`
      SELECT op.id, op.order_id, op.method, op.amount
      FROM order_payments op
      JOIN orders o ON o.id = op.order_id
      WHERE o.till_session_id = ${tillSessionId}
    `
    const paymentsByOrder = new Map<string, Array<{ id: string; method: string; amount: string }>>()
    for (const p of paymentRows) {
      const arr = paymentsByOrder.get(p.order_id) ?? []
      arr.push({ id: p.id, method: p.method, amount: p.amount })
      paymentsByOrder.set(p.order_id, arr)
    }

    // Mismos agregados que computeTillZReport (Turnos/Z-report) — status
    // 'cancelada' se excluye del revenue/ticket promedio/desglose por método,
    // pero SÍ aparece en el listado de `orders` (con opacidad reducida en la
    // UI) para que el cajero vea qué se anuló durante su turno.
    const [agg] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status != 'cancelada') AS order_count,
        COALESCE(SUM(total) FILTER (WHERE status != 'cancelada'), 0) AS total_revenue
      FROM orders WHERE till_session_id = ${tillSessionId}
    `
    const methodRows = await sql`
      SELECT op.method, COALESCE(SUM(op.amount), 0) AS amount
      FROM order_payments op
      JOIN orders o ON o.id = op.order_id
      WHERE o.till_session_id = ${tillSessionId} AND o.status != 'cancelada'
      GROUP BY op.method
    `
    const byMethod: Record<string, number> = {}
    for (const r of methodRows) byMethod[r.method] = Number(r.amount)

    const orderCount = Number(agg.order_count)
    const totalRevenue = Number(agg.total_revenue)

    return c.json({
      kpis: {
        totalRevenue,
        orderCount,
        avgTicket: orderCount > 0 ? totalRevenue / orderCount : 0,
        byMethod,
      },
      orders: orderRows.map((o: any) => ({
        id: o.id, number: o.number, total: o.total, status: o.status,
        dteType: o.dte_type, createdAt: o.created_at,
        voidedAt: o.voided_at, voidReason: o.void_reason,
        payments: paymentsByOrder.get(o.id) ?? [],
      })),
    })
  } catch (err) {
    console.error('Analytics sales error:', err)
    return c.json({ error: 'Error al calcular ventas' }, 500)
  }
})

// GET /api/faq — público, sin sesión (apps/web/.../faq/page.tsx, Server
// Component sin credentials). Ya tiene fallback a STATIC_FAQ si `ok:false` o
// `entries` viene vacío, así que un error acá degrada con gracia, nunca
// crashea la página pública. Tabla poblada por la migración 0018 arriba.
app.get('/api/faq', async (c) => {
  try {
    const rows = await sql`
      SELECT id, question_es, answer_es, category
      FROM faq_entries
      WHERE active = true
      ORDER BY category ASC, sort_order ASC, created_at ASC
    `
    return c.json({
      ok: true,
      entries: rows.map((r: any) => ({
        id: r.id, question: r.question_es, answer: r.answer_es, category: r.category,
      })),
    })
  } catch (err) {
    console.error('FAQ list error:', err)
    return c.json({ ok: false, entries: [] }, 500)
  }
})

// ============================================================================
// SSE — TIEMPO REAL (S08, Fase 2)
// GET /api/events/pos — apps/pos/src/lib/order-events.ts (EventSource client
// already existed, waiting on this route — was the confirmed
// ERR_CONNECTION_REFUSED). GET /api/events/delivery — apps/repartidor/src/
// lib/delivery-events.ts (same situation).
//
// Both use the single in-process EventEmitter fan-out in ./sse-broadcaster —
// NOT a per-client Postgres LISTEN/NOTIFY and NOT a per-client polling
// `setInterval` (see the header comment there for why: Neon/Railway pool is
// `max: 10`, and that exact mistake already took down the VÉRTICE CRM once).
// The only per-connection timer here is an in-memory heartbeat `setInterval`
// that writes a no-op SSE comment-like `ping` message — it never touches the
// database, so opening 50 of these costs zero extra DB connections.
// ============================================================================

const SSE_HEARTBEAT_MS = 15_000

// GET /api/events/pos — same access group as the rest of POS/Despacho
// (matriz 6.1: owner/admin/staff — not delivery, not viewer).
app.get('/api/events/pos', async (c) => {
  const authUser = await requireSession(c, ['owner', 'admin', 'staff'])
  if (authUser instanceof Response) return authUser

  return streamSSE(c, async (stream) => {
    const unsubscribe = onPosEvent((payload) => {
      stream.writeSSE({ data: JSON.stringify(payload) }).catch(() => {})
    })

    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {})
    }, SSE_HEARTBEAT_MS)

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        unsubscribe()
        resolve()
      })
    })
  })
})

// GET /api/events/delivery — role `delivery` only. `driverId` for targeting
// is always `authUser.id` from the session, never a client-supplied value —
// same invariant already established for /api/delivery/assignments/mine and
// /api/delivery/location (S07).
app.get('/api/events/delivery', async (c) => {
  // 'owner' agregado (aviso del dueño) — ver nota en /assignments/mine arriba.
  const authUser = await requireSession(c, ['delivery', 'owner'])
  if (authUser instanceof Response) return authUser

  return streamSSE(c, async (stream) => {
    const unsubscribe = onDeliveryEvent(authUser.id, (payload) => {
      stream.writeSSE({ data: JSON.stringify(payload) }).catch(() => {})
    })

    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {})
    }, SSE_HEARTBEAT_MS)

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        unsubscribe()
        resolve()
      })
    })
  })
})

// ============================================================================
// STARTUP
// ============================================================================

console.log(`🚀 SEUL API v1.0 (Node.js + Railway) — Redeploy after Neon Scale upgrade`)
console.log(`✅ Admin: ${ADMIN_EMAIL}`)

// Validate DB connection on startup (non-blocking)
sql`SELECT 1`
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('⚠️ Database connection warning:', err.message))

// Run migrations. (seedRealUsersIfNeeded() removida en S17 — ver nota arriba: recreaba
// cuentas de staff hardcodeadas en cada redeploy, deshaciendo la limpieza de usuarios.)
Promise.all([
  runMigrationsIfNeeded(),
]).catch(e => console.error('⚠️ Startup initialization error:', e))

// Listen for incoming HTTP requests (Railway/Node)
const port = Number(process.env.PORT) || 8080
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`✅ Listening on http://0.0.0.0:${info.port}`)
})

export default app
