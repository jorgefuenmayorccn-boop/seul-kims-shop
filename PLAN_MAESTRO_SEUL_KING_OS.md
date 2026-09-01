# SEUL KING OS v1.0 — Plan Maestro de Ejecución (v1.0, 31-ago-2026)

**Este es el plan único de ejecución para dejar SEUL KING OS listo para entrega. No improvisar fuera de él.**

Repo: `/Users/vertice/vertice_productions/seul-kims-shop` (monorepo pnpm — `apps/web`, `apps/cerebro`, `apps/pos`, `apps/repartidor`, `packages/api`, `packages/db`)

---

## 0. Por qué existe este plan

El 31-ago-2026 se reportó y arregló un bug de login (cookie de sesión `__Host-` que no cruzaba subdominios — commits `30d193a`, `1efb693`, `618429f`). Al verificar el sistema completo en navegador real después del fix, aparecieron **capturas de pantalla mostrando que casi ninguna pantalla del panel carga datos** (Comandas, Despacho, Turnos, Ajustes, Usuarios, abrir turno en POS). Al auditar `packages/api/src/server.ts` contra cada `fetch()` de las 4 apps, se confirmó que **el problema no es un bug — es que la mayoría del backend nunca se construyó**.

**El dato más importante de esta auditoría:** el schema de base de datos (`packages/db/src/schema/*.ts`) **ya modela casi todo el negocio** — `products`, `inventory`, `orders`, `customers`, `delivery`, `shifts`, `till-sessions`, `b2b-quotes`, `payments`, `dte-events`, `returns`, `promotions`, `loyalty`, `faq`, `hero-banners`, `customer-auth`, `pos-void-events`. Esto **no es un proyecto que hay que diseñar desde cero** — es un proyecto donde el modelo de datos está listo y **faltan las rutas de API que lo exponen** más el cableado del frontend. Eso cambia radicalmente el esfuerzo real frente a construir todo desde cero.

---

## 1. Dónde está todo

| Archivo | Para qué |
|---|---|
| `PLAN_MAESTRO_SEUL_KING_OS.md` (este archivo) | Roadmap completo, bloqueadores P0 con archivo:línea, gap de endpoints completo |
| `packages/api/src/server.ts` | Backend único (Hono + Node, corre en Railway, NO en Cloudflare Workers pese a lo que decía `wrangler.toml`) |
| `packages/db/src/schema/*.ts` | Modelo de datos completo — 21 tablas, ya construido |
| `SEUL_KING_OS_v1.0_MANUAL_CLIENTE.md` / `SEUL_KING_OS_v1_Manual.html` (Desktop) | Manuales ya actualizados con el estado real post-fix de login — **hay que volver a actualizarlos cuando cierre cada fase** |
| `~/.claude/projects/-Users-vertice-vertice-productions/sessions/SEUL_SESSION_NN.md` | Memoria por sesión (crear una por cada sesión ejecutada, mismo formato que las `SESSION_NN.md` del CRM) |

## 2. Protocolo de sesión (obligatorio — mismo que VÉRTICE CRM)

1. **Al empezar:** `git status` + `git log -5` primero — este repo ha tenido **trabajo concurrente sin commitear** (se encontró `packages/api/src/server.ts` modificado en vivo el 31-ago, agregando `/api/auth/users` CRUD, sin relación con esta sesión). Nunca asumir que el árbol de trabajo está limpio.
2. Leer la fila de la fase/sesión en la sección 5 de este documento antes de tocar código.
3. **Al cerrar:** commitear todo lo trabajado (nunca dejar diffs sueltos — el hallazgo del punto 1 es exactamente el riesgo que se evita commiteando), actualizar la tabla de estado de módulos (sección 6), y escribir `SEUL_SESSION_NN.md` con `## ✅ Completado`, `## ❌ Bloqueadores`, `## Memory para próxima sesión`.
4. Sin commit + sin memoria escrita, la sesión **no está cerrada**.

## 3. Roadmap en una línea

Fase 0 Seguridad y Estabilización (S01-02, 16h, 🔴 BLOQUEADORA) → Fase 1 Núcleo Operación Interna — Panel Admin + POS (S03-06, 64h) → Fase 2 Repartidor + Tiempo Real (S07-08, 28h) → Fase 3 Portal B2B + Tienda Web Cliente (S09-11, 48h) → Fase 4 Cumplimiento Legal + Analítica (S12-14, 44h) → Fase 5 Diseño Premium + Hardening + Entrega (S15-17, 40h). **Total ≈ 240h / 17 sesiones / 6 fases.**

## 4. Los bloqueadores P0 (verificados en código, 31-ago-2026)

1. **`JWT_SECRET` tiene un fallback inseguro hardcodeado** (`packages/api/src/db.ts:10` — `process.env.JWT_SECRET || 'seul-king-os-secret-dev'`). Si la variable de entorno faltara en Railway en cualquier momento (redeploy, cambio de servicio), el sistema firmaría sesiones válidas con un secreto público que está en el repo de GitHub. `DATABASE_URL` ya hace `throw` si falta en producción (`db.ts:22-24`) — `JWT_SECRET` debe hacer exactamente lo mismo. Fix: 15 min, cero excusa para no hacerlo en S01.
2. **`requireAuthMiddleware` no valida JWT, solo API Keys** (`packages/api/src/middleware/auth.middleware.ts:36` — `// TODO: Implement JWT validation`). Cada endpoint nuevo (incluido el `/api/auth/users` que se está agregando sin commitear ahora mismo) reimplementa su propio parseo de cookie/Bearer copiando el patrón de `handleGetMe` en vez de usar un middleware central. Es deuda técnica que ya se está replicando — congelarla en S01 con un `requireSession()` único antes de que crezca más.
3. **Rate limiter incompleto** (`packages/api/src/middleware/auth.middleware.ts:75` — `// TODO: Implement rate limiter (use KV store)`). Hoy solo `/api/auth/login` tiene rate limiting (tabla `login_attempts`, 5 intentos/15 min). Ningún otro endpoint de escritura lo tiene — `/api/orders`, `/api/b2b/quotes`, `/api/auth/register` están abiertos a abuso.
4. **Sin RBAC real en el frontend ni en el backend.** El `Sidebar` de cerebro (`apps/cerebro/src/components/layout/sidebar.tsx`) muestra el mismo menú completo a `owner`, `admin`, `staff` y `viewer` — no hay diferenciación. En el backend, casi ningún endpoint valida `role` más allá de "¿hay sesión?". El manual de cliente ya se corrigió para no prometer esto — pero es la brecha de seguridad/UX más visible para el dueño y hay que cerrarla antes de dar acceso a más personal.
5. **Gap de endpoints — ver tabla completa en sección 7.** No es un blocker puntual, es sistémico: de ~45 rutas que las 4 apps llaman, **~20 existen** (incluyendo lo que se está agregando sin commitear ahora) y **~25 no existen**, con algunas rutas existentes bajo un path distinto al que el frontend llama (`/api/deliveries/assign` en el backend vs `/api/delivery/assignments/:id/assign` en Despacho — mismatch de nombre, no solo ausencia).
6. **Cero endpoint de facturación electrónica (SII/DTE)** pese a que `packages/db/src/schema/dte-events.ts` ya existe y el manual del cliente promete cumplimiento legal chileno. Operar sin boleta electrónica es el riesgo #1 marcado como 🔴 crítico en el plan de negocio original (`SEOUL_KIMS_OS_v1.0_Plan_de_Accion.md`, sección 13, riesgo #1: "multas y clausura").
7. **Trabajo sin commitear en este momento** — `packages/api/src/server.ts` tiene un diff de 132 líneas sin commit (CRUD de `/api/auth/users`) al momento de escribir este plan. **Antes de tocar nada de la sección 5, alguien tiene que revisar y commitear (o descartar deliberadamente) ese diff.** No es tarea de este plan resolverlo por adivinanza — es lo primero que se hace en S01.

## 5. Reglas duras

- Los gates go/no-go **no se negocian**. Si un endpoint nuevo no pasa su prueba end-to-end en navegador real (no solo curl), la sesión no cierra.
- **Toda ruta nueva usa el modelo de `packages/db/src/schema/*.ts` que ya existe** — antes de escribir un endpoint, leer el schema de la tabla correspondiente. No inventar columnas nuevas sin revisar primero si ya están modeladas.
- **Cero regresión en lo que ya funciona:** login (las 4 apps), `/api/orders` (crear), `/api/b2b/quotes` (crear/aceptar/rechazar), `/api/deliveries/:id/status` y `/:id/photo`, `/api/admin/api-keys`. Cada sesión corre un smoke test de estos antes de cerrar.
- Railway auto-deploya el API en cada push a `main`; Vercel auto-deploya las 4 apps. No existe "commit sin deploy" — probar en producción real después de cada push, no asumir.
- Cada endpoint nuevo que toca datos de otro usuario (no el propio) valida `role` server-side, no solo "hay sesión". Ver bloqueador P0 #4.
- Cada fase que agrega una pantalla nueva o cambia una existente actualiza `SEUL_KING_OS_v1.0_MANUAL_CLIENTE.md` en el mismo commit — el manual no puede volver a quedar desincronizado del sistema real.

## 6. Estado de los módulos (31-ago-2026)

| Módulo | App(s) | Backend | Estado |
|---|---|---|---|
| Auth staff (login/logout/me/change-password) | cerebro, pos, repartidor | ✅ completo | Verificado en navegador real las 3 apps |
| Usuarios (listar/crear/editar/desactivar) | cerebro | ✅ completo + RBAC | Commiteado (S01), RBAC server-side owner-only en editar/desactivar/crear (S02), verificado end-to-end contra producción |
| Dashboard (stats, alertas) | cerebro | ❌ falta | Banner "API no disponible" confirmado en captura |
| Productos + categorías | cerebro, web | ❌ falta | Schema listo (`products.ts`), sin rutas |
| Inventario | cerebro | ❌ falta | Schema listo (`inventory.ts`), sin rutas |
| Comandas (pedidos, listar/gestionar) | cerebro | ❌ falta | Error "Cannot read properties of undefined" confirmado en captura |
| Despacho (asignar entregas) | cerebro | 🟡 parcial, path roto | Backend existe bajo `/api/deliveries/*`, frontend llama `/api/delivery/assignments/*` |
| Turnos (historial cajero) | cerebro | ❌ falta | "No se pudo cargar el historial" confirmado en captura |
| B2B Crédito (solicitudes) | cerebro | ❌ falta | Cotizaciones (`b2b/quotes`) sí existen; solicitudes de crédito no |
| Seguridad (ARCOP, void PIN, devoluciones) | cerebro | ❌ falta | Requisito legal Ley 21.719 |
| Ajustes (PIN analytics, config tienda) | cerebro | ❌ falta | "Error 404" confirmado en captura |
| POS: abrir/cerrar turno (till-sessions) | pos | ❌ falta | "Error de conexión" confirmado en captura |
| POS: eventos en vivo (SSE) | pos | ❌ falta | `ERR_CONNECTION_REFUSED` confirmado en test |
| Repartidor: mis entregas, ubicación, POD | repartidor | 🟡 parcial | POD/status existen bajo `/api/deliveries/*`; `mine` y `location` no |
| Repartidor: eventos en vivo (SSE) | repartidor | ❌ falta | Error de consola confirmado en test |
| Tienda web: login/registro cliente | web | ❌ falta | **Los clientes finales no pueden crear cuenta hoy** |
| Tienda web: catálogo público | web | ❌ falta | `/api/products` no existe |
| Tienda web: mis pedidos | web | ❌ falta | — |
| Portal B2B (empresa): catálogo, wallet, pedidos | web | ❌ falta | — |
| Boleta electrónica (SII/DTE) | — | ❌ falta | Schema listo (`dte-events.ts`), riesgo legal #1 del plan de negocio |
| Devoluciones, FAQ, promociones, fidelización | varios | ❌ falta | Schemas listos, sin rutas |

**Leyenda:** ✅ funciona y verificado · 🟡 parcial/roto · ❌ sin construir

### 6.1 Matriz de roles → secciones visibles (definida en S01, implementada en S02)

Los 5 roles ya existen en `VALID_ROLES` (`packages/api/src/server.ts`, handler de `/api/auth/register`): `owner`, `admin`, `staff`, `delivery`, `viewer`.

| Rol | Acceso |
|---|---|
| `owner` | Todo — todas las secciones de `cerebro`, sin restricción. |
| `admin` | Todo excepto **Usuarios** y **Seguridad**. |
| `staff` | Solo **Comandas**, **Despacho**, **Turnos**, **Clientes**. |
| `delivery` | Solo el módulo de repartidor (app `apps/repartidor`) — sin acceso a `cerebro`. |
| `viewer` | Solo lectura de **Dashboard** y **Reportes** — ninguna acción de escritura. |

**Estado S02 (implementado y verificado en producción, 31-ago/1-sep-2026):**

- **Frontend** (`apps/cerebro/src/components/layout/sidebar.tsx`): cada item del `nav[]` ahora lleva un array `roles` y la lista se filtra con `nav.filter(item => item.roles.includes(user.role))` antes de renderizar. Verificado con Playwright contra `cmr.seoulshop.cl` real: una cuenta `staff` desechable solo ve Comandas/Clientes/Despacho/Turnos (+ POS Caja/Tienda Web externos); una cuenta `owner` desechable ve las 11 secciones incluyendo Usuarios y Seguridad. Screenshots verificados visualmente.
  - Nota: `delivery` nunca llega a este componente porque `apps/cerebro/src/app/(admin)/layout.tsx` ya gatea todo el route group a `['owner','admin','staff']` — pero eso también bloquea a `viewer`, que según la matriz debería poder entrar solo a Dashboard/Reportes. Es un gap preexistente (no introducido en S02) que queda documentado como deuda, no bloqueante — no hay hoy ninguna cuenta `viewer` real en producción.
  - También sigue pendiente: la página `/usuarios` (y las demás rutas ocultas del Sidebar) no tiene guard de ruta a nivel de página — un `staff` que navegue directo a la URL no ve el link pero tampoco es redirigido. El backend sí bloquea las acciones reales (ver abajo), así que no hay fuga de datos, solo una pantalla que renderizaría vacía/con 403 en sus fetch. Deuda documentada, no bloqueante para S02.

- **Backend** — migrados a `requireSession(c, roles)` con validación de rol real en S02:
  - `GET /api/auth/users` → `['owner','admin','staff']` (no owner-only: también alimenta el selector de repartidor de Despacho, al que staff/admin tienen acceso legítimo — restringirlo a owner habría regresionado esa pantalla).
  - `PUT /api/auth/users/:id` → `['owner']`
  - `DELETE /api/auth/users/:id` → `['owner']`
  - `POST /api/auth/register` → `['owner']`
  - `PUT /api/delivery/assignments/:id/assign` → `['owner','admin','staff']`
  - Los 5 endpoints anteriores verificados con curl contra producción usando cuentas `qa-test-*@example.test` desechables (creadas y borradas en la misma sesión): `staff` recibe 403 en PUT/DELETE users y en register, 200/404 (no 403) en GET users y en delivery/assign; `owner` recibe 200/404 en todo.
  - **Deuda pendiente (no bloqueante, sesiones futuras):** el resto de endpoints de hoy siguen solo con `getAuthUser()` → "¿hay sesión?" sin validar rol: `POST /api/shifts/open`, `POST /api/shifts/:id/close`, `POST/GET /api/till-sessions/*`, `PUT /api/tienda-config/:key`, `POST /api/deliveries/assign` (legacy), `POST /api/deliveries/:id/status`, `POST /api/deliveries/:id/photo`, `POST /api/orders/:id/status`. Ninguno de estos está marcado como restringido-por-rol en la matriz de arriba salvo por pertenecer a secciones ya ocultas en el Sidebar (Turnos, Ajustes, Despacho) — el riesgo real es bajo (todos exigen sesión válida) pero no hay defensa en profundidad por rol todavía.

## 7. Gap completo de endpoints (auditado 31-ago-2026)

Metodología: `grep` de todos los `fetch()` a `${API_URL}/api/...` en las 4 apps, cruzado contra las rutas registradas en `server.ts`.

**Ya existen (18):** `/api/auth/{login,logout,me,register,change-password,users,users/:id}`, `/api/orders` (solo POST — crear), `/api/orders/:id/status`, `/api/b2b/quotes` (+ `:id/accept`, `:id/reject`), `/api/deliveries/{assign,:id/status,:id/photo}`, `/api/admin/api-keys` (+ `:id/revoke`), `/api/admin/seed/users`, `/api/email-queue/:id`.

**Faltan (≈27), agrupadas por dominio:**

- **Dashboard/Analítica:** `GET /api/dashboard/stats`, `GET /api/dashboard/alerts`, `GET /api/analytics/sales`, `GET /api/analytics/pin-check`
- **Productos:** `GET /api/products`, `GET /api/products/meta/categories`, `GET /api/products/barcode/:code`, `GET /api/products/id/:id`
- **Inventario:** `GET /api/inventory`
- **Clientes (CRM interno):** `GET /api/customers`, `GET /api/customers/search`, `GET /api/customers/:id`, `GET /api/customers/:id/timeline`
- **Comandas:** `GET /api/orders/comandas`, `GET /api/orders` (listar, no solo crear)
- **Despacho / Delivery (admin):** `GET /api/delivery/assignments`, `POST /api/delivery/assignments/:id/assign` — **renombrar o alinear con `/api/deliveries/*` existente**, `GET /api/delivery/drivers`, `POST /api/delivery/dispatch-rappi`, `GET /api/delivery/payouts`
- **Turnos / Till-sessions:** `GET /api/shifts/history`, `GET /api/shifts/active`, `POST /api/shifts/open`, `GET /api/till-sessions/active`, `POST /api/till-sessions/open`
- **B2B Portal:** `GET /api/b2b/catalogo`, `POST /api/b2b/registro`, `GET /api/b2b/empresa/me`, `POST /api/b2b/credit-request`, `GET /api/b2b/credit-requests/:id`, `GET /api/b2b/pedidos/:id`, `GET /api/b2b/wallet/:id`, `GET /api/b2b/solicitudes`
- **Cliente final (tienda web):** `POST /api/customer/{login,register}`, `GET /api/customer/me`, `GET /api/customer/orders`, `POST /api/customer/password-{change,forgot,reset}`
- **Ajustes / Config:** `GET/PUT /api/tienda-config`, `GET/PUT /api/tienda-config/analytics_pin`, `GET /api/tienda-config/public`, `POST /api/tienda-config/void_pin`
- **Seguridad / Legal:** `GET /api/arcop`, `GET /api/returns`
- **Repartidor:** `GET /api/delivery/assignments/mine`, `POST /api/delivery/location`
- **Tiempo real (SSE):** `GET /api/events/pos`, `GET /api/events/delivery`
- **Otros:** `GET /api/faq`

---

## FASE 0 — Seguridad y Estabilización (S01-02, 16h, 🔴 BLOQUEADORA)

No se avanza a Fase 1 sin cerrar esto: es la base sobre la que se construyen ~25 endpoints nuevos.

**S01 (8h):**
- Revisar y commitear (o descartar) el diff pendiente de `/api/auth/users` (bloqueador P0 #7).
- `JWT_SECRET`: throw en producción si falta, igual que `DATABASE_URL` (bloqueador P0 #1).
- Crear `requireSession(c, roles?)` único en `middleware/auth.middleware.ts` que reemplace el patrón copy-pasted de `getAuthUser` (bloqueador P0 #2). Migrar los endpoints existentes a usarlo.
- Definir la matriz de roles → secciones visibles (owner: todo · admin: todo menos Usuarios/Seguridad · staff: Comandas/Despacho/Turnos/Clientes · delivery: solo repartidor · viewer: solo lectura Dashboard/Reportes). Documentarla en este archivo (sección 6 se actualiza con esto).

**S02 (8h) — ✅ COMPLETA (1-sep-2026):**
- ✅ RBAC en `Sidebar` de cerebro (ocultar secciones según `role`) — ver detalle y deuda pendiente en sección 6.1.
- ✅ RBAC server-side con `requireSession(c, roles)` en los 5 endpoints más sensibles de hoy (Usuarios GET/PUT/DELETE, register, delivery/assign) — ver sección 6.1 para la lista completa migrada vs. deuda pendiente.
- ✅ Rate limiter genérico en Postgres (tabla `rate_limit_events`, migración 0016, función `checkAndRecordRateLimit` en `server.ts`) — reemplaza el TODO de KV en `auth.middleware.ts:160`. Aplicado a `POST /api/orders`, `POST /api/b2b/quotes`, `POST /api/auth/register` (20 req / 5 min por usuario o IP). Verificado en producción: 20 requests pasan, el 21° responde `429` con `{"error":"Demasiadas solicitudes. Intenta de nuevo en 5 minutos."}`.
- ✅ **Gate de fase:** smoke test con Playwright contra producción real (`cmr.seoulshop.cl`, `pos.seoulshop.cl`, `drive.seoulshop.cl`) usando cuentas `qa-test-*@example.test` desechables (creadas directo en Neon, nunca vía email real, borradas al cerrar la sesión junto con toda la data de prueba que generaron — órdenes, cotización, email_queue/email_log, rate_limit_events). Login OK en las 3 apps. RBAC del Sidebar confirmado: `staff` ve solo Comandas/Clientes/Despacho/Turnos, `owner` ve las 11 secciones. `/health` en 200 después de cada push.
- Commits: `9c0adfe` (Sidebar RBAC), `6084177` (RBAC server-side), `10da8d9` (rate limiter genérico) — pusheados a `main`, auto-deploy Railway confirmado.

## FASE 1 — Núcleo de Operación Interna: Panel Admin + POS (S03-06, 64h)

El corazón del negocio diario. Sin esto, el dueño no puede operar la tienda desde el sistema.

**S03 (16h) — Productos + Inventario:**
`GET /api/products`, `/api/products/meta/categories`, `/api/products/barcode/:code`, `/api/products/id/:id`, `GET /api/inventory`. Usar `packages/db/src/schema/products.ts` e `inventory.ts` tal cual están modelados.

**S04 (16h) — Comandas + Dashboard:**
`GET /api/orders` (listar con filtros), `GET /api/orders/comandas`, `GET /api/dashboard/stats`, `GET /api/dashboard/alerts`. Verificar que el banner "API no disponible" de la captura desaparezca.

**S05 (16h) — Despacho + Turnos:**
Resolver el mismatch de paths `/api/delivery/*` vs `/api/deliveries/*` (decidir un nombre único y actualizar frontend o backend, no dejar ambos). `GET /api/shifts/history`, `/api/shifts/active`, `POST /api/shifts/open`.

**S06 (16h) — POS: Till-sessions + Ajustes:**
`GET/POST /api/till-sessions/active`, `/open` (resuelve el "Error de conexión" al abrir turno, confirmado en captura). `GET/PUT /api/tienda-config`, `/analytics_pin`, `/public`, `POST /void_pin` (resuelve el "Error 404" de Ajustes). **Gate de fase:** las 6 pantallas que fallaron en las capturas originales (Comandas, Despacho, Turnos, Usuarios, Ajustes, Abrir turno POS) cargan sin error en navegador real.

## FASE 2 — Repartidor + Tiempo Real (S07-08, 28h)

**S07 (16h):** `GET /api/delivery/assignments/mine`, `POST /api/delivery/location`, `GET /api/delivery/drivers`, `POST /api/delivery/dispatch-rappi`, `GET /api/delivery/payouts`.

**S08 (12h):** `GET /api/events/pos` y `/api/events/delivery` (SSE) — resuelve el `ERR_CONNECTION_REFUSED` visto en POS y el error de consola en repartidor. Usar el patrón de fan-out de un solo listener, no una conexión Postgres directa por cliente (mismo error que ya se identificó y evitó en el CRM de VÉRTICE — no repetirlo acá).

## FASE 3 — Portal B2B + Tienda Web Cliente Final (S09-11, 48h)

Hoy un cliente real **no puede registrarse ni comprar** en seoulshop.cl. Esto es tan crítico como el panel admin para "entregar el proyecto como debe ser".

**S09 (16h) — Auth de cliente final:** `POST /api/customer/{login,register}`, `GET /api/customer/me`, `POST /api/customer/password-{change,forgot,reset}` (usar `customer-auth.ts`, ya modelado, y aplicar el mismo fix de cookie cross-subdominio de Fase 0 desde el día uno — no repetir el bug de `__Host-`).

**S10 (16h) — Catálogo + pedidos del cliente:** `GET /api/products` reutilizado del panel admin (mismo catálogo, distinta lista de precios activada por tipo de cuenta — patrón confirmado en el plan de negocio original, sección "un solo catálogo, un solo stock"), `GET /api/customer/orders`.

**S11 (16h) — Portal B2B (empresa mayorista):** `GET /api/b2b/catalogo`, `POST /api/b2b/registro`, `GET /api/b2b/empresa/me`, `POST /api/b2b/credit-request`, `GET /api/b2b/credit-requests/:id`, `/api/b2b/pedidos/:id`, `/api/b2b/wallet/:id`, `/api/b2b/solicitudes`.

## FASE 4 — Cumplimiento Legal + Analítica + Extras (S12-14, 44h)

**S12 (16h) — Boleta electrónica (SII/DTE):** el riesgo #1 del plan de negocio original ("operar sin boleta electrónica" = multas y clausura). Usar `dte-events.ts` ya modelado. Definir con el cliente qué proveedor de facturación usar (Haulmer/OpenFactura, SimpleAPI, etc.) antes de escribir código — **esto requiere una decisión de negocio, no solo técnica, agendarla explícitamente al abrir S12**.

**S13 (14h) — Seguridad/Legal + Devoluciones:** `GET /api/arcop` (Ley 21.719 — derechos ARCOP), `GET /api/returns`.

**S14 (14h) — Analítica + Extras:** `GET /api/analytics/sales`, `/api/analytics/pin-check`, `GET /api/faq`, y wiring de `promotions.ts` / `loyalty.ts` (ya modelados, sin UI ni rutas — evaluar si entran en v1.0 o quedan para v1.1 según lo que decida el dueño).

## FASE 5 — Diseño Premium + Hardening + Entrega (S15-17, 40h)

Investigación de referencia (arquitectura de CRM/POS grandes, 31-ago-2026— ver fuentes al final): API-first con eventos en tiempo real, RBAC que refleja roles reales (no solo autenticación), audit logging con retención por nivel de plan, principio de acceso mínimo en cada endpoint. Todo esto ya quedó incorporado como bloqueadores P0 #2-#4 y como requisito de cada fase — Fase 5 es donde se pule.

**S15 (14h) — Sistema de diseño:**
- Auditar `apps/cerebro`, `apps/pos`, `apps/repartidor`, `apps/web` contra un solo type ramp y una sola escala de espaciado (hoy cada app define sus propios estilos inline `style={{...}}` en vez de tokens compartidos — ver `sidebar.tsx` como ejemplo del patrón a limpiar).
- Dark mode: el peso tipográfico que se ve balanceado en modo claro se ve más pesado en fondo oscuro — revisar pesos de fuente en el tema oscuro actual de SEUL KING OS contra esto.
- Reemplazar los mensajes de error crudos vistos en las capturas ("Cannot read properties of undefined", "Algo salió mal") por estados de error consistentes y en español natural en toda la app — patrón `ErrorState` reutilizable, no cada página inventando el suyo.
- Estado vacío, estado de carga y estado de error como tres variantes del mismo componente en las 4 apps.

**S16 (14h) — Hardening:**
- Audit log real (tabla + UI) para acciones administrativas sensibles (crear/desactivar usuario, resetear contraseña, editar precio) — hoy no existe ninguno.
- Test de carga básico (repetir el patrón k6 que ya se usó en el CRM de VÉRTICE) sobre `/api/auth/login` y los endpoints de POS bajo uso concurrente (varias cajas abriendo turno a la vez).
- Revisar que ningún endpoint nuevo de Fase 1-4 quedó sin `requireSession()` / validación de rol.

**S17 (12h) — Entrega:**
- Actualizar `SEUL_KING_OS_v1.0_MANUAL_CLIENTE.md` y `SEUL_KING_OS_v1_Manual.html` con el estado final real (quitar todos los "próximamente"/"pendiente" que Fase 1-4 ya resolvieron).
- Checklist de entrega: las 4 apps + portal B2B + tienda cliente funcionando en navegador real, sesión de capacitación con Jorge y Mario (ya contemplada en el manual), SLA de 30 días activo.
- **Gate final:** cero pantalla con "Error al cargar", cero endpoint 404 en las rutas que el frontend llama — verificado con el mismo método de auditoría de la sección 7, corriéndolo de nuevo y confirmando 0 faltantes.

---

## Fuentes (investigación de arquitectura y diseño, 31-ago-2026)

- [Enterprise CRM Security Framework: Comprehensive Protection Strategies](https://www.stacksync.com/blog/enterprise-crm-security-framework-comprehensive-protection-strategies-for-2025)
- [Security Best Practices for Real-Time CRM Data Integration](https://www.stacksync.com/blog/security-best-practices-for-real-time-crm-data-integration)
- [Role-Based Access Control Best Practices for 2026](https://www.techprescient.com/blogs/role-based-access-control-best-practices/)
- [Syncally Goes Enterprise: SSO, Audit Logs, RBAC, and SOC 2](https://www.syncally.app/blog/syncally-enterprise-launch-sso-audit-logs-rbac)
- [Retail Analytics Dashboard Development and Integration Guide](https://rbmsoft.com/blogs/retail-analytics-dashboard-development-and-integration/)
- [Dark Mode Design: UX Best Practices, Accessibility Rules](https://medium.com/@focalin.web/dark-mode-design-ux-best-practices-accessibility-rules-how-to-implement-it-right-f1153df0f48e)
- [The 7 Biggest Typography Mistakes Designers Make When Switching from Light to Dark Mode](https://medium.com/@dollyborade07/the-7-biggest-typography-mistakes-designers-make-when-switching-from-light-to-dark-mode-0472f542763d)
