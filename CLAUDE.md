# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**SEUL KING OS v1.0** — Sistema operativo completo para Seoul Kims (@@seulshopcl), tienda de productos coreanos en Viña del Mar, Chile.

El sistema es un monorepo con 6 canales que comparten un único backend ("El Cerebro"): POS (caja), Tienda B2C, Portal B2B, Dashboard operacional, Logística (Rappi + Metro Merval), y Asistente IA (v1.4+).

## Commands

```bash
# Desarrollo (todas las apps en paralelo)
pnpm dev

# App individual
pnpm --filter @seul/web dev        # localhost:3000 — Tienda B2C + B2B
pnpm --filter @seul/pos dev        # localhost:3001 — POS táctil
pnpm --filter @seul/repartidor dev # localhost:3002 — PWA repartidor
pnpm --filter @seul/cerebro dev    # localhost:3003 — Panel admin (El Cerebro)

# API (Node.js + Hono, corre en Railway en producción)
pnpm --filter @seul/api dev     # tsx watch — servidor Node local en localhost:8787

# Build completo
pnpm build

# Lint + type-check
pnpm lint
pnpm type-check

# Base de datos (Drizzle ORM → Neon PostgreSQL)
pnpm db:generate    # genera migraciones desde el esquema
pnpm db:push        # aplica cambios directamente (solo dev)
pnpm db:studio      # Drizzle Studio en localhost:4983

# Formatear
pnpm format
```

## Architecture

### Monorepo structure

```
seul-kims-os/
├── apps/
│   ├── web/          # @seul/web — Next.js 14 · puerto 3000
│   │   └── src/app/
│   │       ├── (shop)/   # Tienda B2C seoulshop.cl
│   │       └── (b2b)/    # Portal mayorista
│   ├── cerebro/      # @seul/cerebro — Next.js 14 · puerto 3003 — Panel admin (PRIVADO)
│   │   └── src/app/
│   │       ├── login/       # /login
│   │       └── (admin)/     # Dashboard, Productos, Inventario, Comandas, Seguridad, Ajustes
│   ├── pos/          # @seul/pos — POS táctil (tablet 10"/12") · puerto 3001
│   └── repartidor/   # @seul/repartidor — PWA offline-capable · puerto 3002
├── packages/
│   ├── api/          # @seul/api — Hono en Node.js, desplegado en Railway (ver nota abajo)
│   ├── db/           # @seul/db — Drizzle ORM + schema PostgreSQL
│   ├── ui/           # @seul/ui — componentes React compartidos
│   ├── tokens/       # @seul/tokens — CSS custom properties (3 capas)
│   ├── tailwind-config/  # @seul/tailwind-config — config Tailwind compartido
│   └── pdf-templates/    # @seul/pdf-templates — PDFKit boleta 80mm
└── infra/            # Cloudflare config, scripts de deploy
```

### "El Cerebro" — API única

Todos los canales consumen `@seul/api` — **Hono corriendo sobre Node.js (`tsx`/Node runtime, no Cloudflare Workers), desplegado en Railway** (proyecto `seul-kims-db`, servicio `sparkling-fulfillment`, auto-deploy desde GitHub `main`, dominio `api.seoulshop.cl`). El diseño original (Fase 0 del plan) contemplaba Cloudflare Workers — quedó descartado durante el desarrollo y el runtime real es Node.js estable en Railway desde hace varias sesiones (confirmado con `railway status` → `Online`). `packages/api/wrangler.toml` sigue presente en el repo pero es **legacy, no usado por el deploy real** — no borrar (puede tener valor histórico), pero no seguir sus instrucciones de `wrangler dev`/Workers al operar este proyecto.

La API maneja:
- Inventario y lotes (con semáforo de vencimiento)
- Pedidos y comandas (multicanal: POS, web, B2B, WhatsApp)
- Boleta electrónica SII (DTE) — **pospuesta post-entrega por decisión del cliente**; v1.0 emite Nota de Venta (documento no tributario) vía el seam `@seul/dte` (`MockDTEProvider`), listo para conectar un proveedor real (Haulmer/OpenFactura/SimpleAPI) sin rediseño cuando el cliente decida
- PDF/impresión 80mm (HTML renderizado server-side vía `packages/pdf-templates`, servido al Print Agent local del POS o como popup de fallback)
- Sesiones vía cookie firmada (JWT) — dominio `.seoulshop.cl`, sin KV de Cloudflare
- Base de datos: Neon Postgres (`packages/db`, Drizzle ORM) — el pool de conexión (`postgres.js`, `max: 10`) vive en el proceso Node de Railway, no en un Worker

### Design tokens — 3 capas

`packages/tokens/src/` define tokens en cascada. **Nunca usar colores hex directamente en componentes** — siempre usar tokens:

1. `primitives.css` — valores brutos (`--red-500: #d7263d`)
2. `semantic.css` — roles (`--color-brand: var(--red-500)`)
3. `business.css` — dominio Seoul Kims (`--color-baes-eligible`, `--color-cold-frozen`, `--color-dte-failed`, etc.)

El Tailwind config en `packages/tailwind-config/index.ts` mapea los tokens CSS a clases utilitarias (`text-brand`, `bg-cold-frozen`, `text-expiry-urgent`, etc.).

### Componentes compartidos

`@seul/ui` exporta componentes de negocio que se usan en los 3 canales:

- `BadgeBAES` — estados BAES (eligible/not-eligible/applied/partial)
- `BadgeChain` — cadena de frío (frozen/refrigerated)
- `BadgeExpiry` — semáforo vencimiento calculado desde fecha
- `BadgeNutrition` — sellos "Alto En" (Ley 20.606)
- `StatusPill` — estado comanda + estado DTE
- `EmptyState` — estados vacíos con copy Seoul Kims
- `WhatsAppCTA` — 3 variantes: floating, inline, button

Componentes channel-specific se importan por subpath:
```ts
import { POSNumpad } from '@seul/ui/pos/numpad'
import { ProductCard } from '@seul/ui/shop/product-card'
```

### Database schema (packages/db/src/schema/)

- `products` + `categories` + `productSellos` — catálogo con BAES, cadena de frío, Ley 20.606
- `inventory` + `inventoryMovements` — lotes con fecha vencimiento, semáforo
- `orders` + `orderItems` — pedidos multicanal con `deliveryMode` (rappi/metro/pickup/shipping)
- `customers` + `b2bCompanies` + `arcopRequests` — B2C, B2B (tiers Hoobae/Sunbae/Hyung), ARCOP
- `tiendaConfig` — configuración singleton (estación Merval, número WhatsApp, proveedor DTE)

## Critical business rules

### Boleta electrónica SII (DTE)
**Estado real (2-sep-2026): la integración SII/DTE está pospuesta post-entrega por decisión explícita del cliente.** v1.0 emite **Nota de Venta** (documento no tributario, legal de emitir sin timbre SII) en cada venta de POS — no boleta electrónica real. El diseño original de este párrafo (cola Cloudflare Queue → Workers consumer, Sentry) describía una arquitectura de Workers que nunca se construyó así: el seam real es `@seul/dte` (`packages/dte`), con un `MockDTEProvider` forzado en el servidor (nunca lee env vars de proveedor real) y cada intento registrado en la tabla `dte_events`. Cuando el cliente confirme proveedor (Haulmer/OpenFactura/SimpleAPI) en una sesión futura, ese seam se conecta sin rediseñar el resto del flujo — no hay cola ni consumer que migrar, es un cambio de implementación de una función (`emitDte`) dentro del proceso Node de la API en Railway.

### BAES (Subsidio JUNAEB)
El POS valida la TNE (Tarjeta Nacional Estudiantil) y marca productos como `is_baes_eligible`. Al cobrar, la boleta debe mostrar 2 subtotales: monto BAES y monto otro medio. Productos no elegibles NO pueden cobrarse con BAES aunque el cliente insista — el sistema lo bloquea.

### Cadena de frío
Productos con `cold_chain = 'frozen' | 'refrigerated'` NO pueden despacharse a regiones. El checkout los bloquea automáticamente si la dirección está fuera de cobertura Rappi o fuera del Gran Valparaíso. En el POS aparece una alerta al agregar estos productos a un pedido delivery.

### Sellos "Alto En" (Ley 20.606)
Cada producto con sellos debe mostrarlos en el detalle B2C y en la boleta 80mm. Es obligación legal — no feature opcional. Los sellos se almacenan en `productSellos` y se renderizan con `BadgeNutrition`.

### PDF 80mm
Especificación: 226.77pt ancho, 204.09pt imprimible, 42 chars/línea, JetBrains Mono 8pt, 203 DPI. El PDF se genera en `@seul/pdf-templates`, se sube a Cloudflare R2 con token `crypto.getRandomValues()` 16 chars, y el link se envía por WhatsApp (wa.me). El token expira en 48h. **Imprimir siempre al 100% / tamaño real, nunca "ajustar a página".**

### Metro Merval (retiro gratis)
La estación específica se configura en `tiendaConfig.metro_station_name` — no está hardcodeada. Merval es el tren regional de Valparaíso/Viña del Mar, **no** el Metro de Santiago. Las estaciones de la línea son: Valparaíso Puerto, Bellavista, Francia, Barón, Recreo, El Salto, Miramar, Viña del Mar (otras en extensión).

### Privacidad ARCOP (Ley 21.719)
Las solicitudes ARCOP (acceso/rectificación/cancelación/oposición) tienen plazo máximo 15 días hábiles. Se guardan en `arcopRequests` con `deadline` calculado. El dashboard de seguridad muestra alerta si alguna está por vencer.

## Development conventions

### Package naming
Todos los paquetes internos usan el scope `@seul/`. Importar siempre por nombre de paquete, nunca por path relativo entre apps.

### CLP (pesos chilenos)
Todos los montos se almacenan como `integer` (sin centavos). Usar `formatCLP()` de `@seul/ui` para display. El campo SQL es `decimal(10, 0)`.

### RUT chileno
Usar `formatRUT()` de `@seul/ui` para display. Validar dígito verificador en el frontend antes de enviar al API. El dígito puede ser 'K'.

### Flujo WhatsApp
v1.0 usa wa.me links (sin WhatsApp Business API). El mensaje incluye la URL del PDF en R2. El template del mensaje está en `packages/api/src/lib/whatsapp.ts` (Fase 2).

## Environment variables

```bash
# packages/api (.dev.vars para local — Node.js/tsx, no Cloudflare Workers; variables de entorno en el servicio Railway para producción, no `wrangler secret`)
DATABASE_URL=          # Neon PostgreSQL connection string
DTE_API_KEY=           # Clave proveedor DTE (Bsale/Toku/Haulmer)
DTE_RUT_EMPRESA=       # RUT empresa para emisión de boletas
UPSTASH_REDIS_URL=     # Cola BullMQ para DTE
UPSTASH_REDIS_TOKEN=
SENTRY_DSN=

# apps/web (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8787   # URL de @seul/api
DATABASE_URL=          # mismo Neon (para SSR directo si aplica)
```

## Pending decisions (confirm with Seoul Kims owner)

- `tiendaConfig.metro_station_name` — estación Merval principal para retiros
- `tiendaConfig.dte_provider` — Bsale / Toku / Haulmer (bloqueante para Fase 1)
- `tiendaConfig.whatsapp_number` — número real del negocio
- `STORE_INFO` en `packages/pdf-templates/src/constants.ts` — dirección real, RUT real
- `WhatsAppCTA` en `packages/ui/src/whatsapp-cta.tsx` — `SEUL_WA_NUMBER` constante
