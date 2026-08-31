# 🏗️ FASE 1: PLAN MAESTRO — CONSOLIDACIÓN EN VERCEL

**Rol:** Arquitecto de Software + Lead QA Engineer  
**Objetivo:** Sistema 100% conectado, emails funcionando, login viable desde cualquier dispositivo  
**Status:** FASE 1 (DIAGNÓSTICO + ARQUITECTURA) — Pendiente aprobación para FASE 2  

---

## 📋 DIAGNÓSTICO ACTUAL

### Infraestructura Fragmentada
```
PROBLEMA 1: Backend en Railway, pero DNS apunta a Cloudflare Workers
  - API corriendo en: Railway (localhost:8080 conceptualmente, pero production en seul-api-production.railway.app)
  - DNS: api.seoulshop.cl → seul-api-production.seul-api.workers.dev (INCORRECTO)
  - Resultado: Desconexión entre dónde corre el código y dónde apunta el DNS

PROBLEMA 2: Frontends en Vercel, Backend en Railway
  - pos.seoulshop.cl → Vercel ✅
  - cmr.seoulshop.cl → Vercel ✅
  - drive.seoulshop.cl → Vercel ✅
  - api.seoulshop.cl → Railway (pero DNS dice Workers) ❌
  - Complejidad: 3 plataformas diferentes (Vercel, Railway, Cloudflare)

PROBLEMA 3: Emails NO llegan
  - Causa raíz: Email type enum no tiene 'initial-credentials' (arreglado a 'welcome')
  - Causa secundaria: Database connection intermitente (Neon Scale upgrade reciente)
  - Bloqueante CRÍTICO: Sin emails, usuario no puede ingresar
```

### Arquitectura de Referencia (sistema-vertice)
```
CORRECTO: TODO en Vercel (Next.js full-stack)
  - /api/* routes dentro de la misma app
  - Un solo deploy, una sola plataforma
  - DNS limpio: staff.verticeproductions.com → Vercel ✅
  - BD: Neon PostgreSQL ✅
  - Emails: Resend integrado ✅
  - RESULTADO: Funciona perfectamente hace meses
```

---

## 🎯 SOLUCIÓN PROPUESTA

### Arquitectura Final (Vercel Consolidado)
```
OBJETIVO: Replicar éxito de sistema-vertice

Estructura:
├─ apps/
│  ├─ cerebro/        → Frontend (panel admin)
│  ├─ pos/            → Frontend (caja táctil)
│  ├─ drive/          → Frontend (logística)
│  └─ web/            → Frontend (tienda B2C/B2B)
│
├─ packages/
│  ├─ api/            → MOVER AQUÍ (como /api routes en Vercel)
│  ├─ db/             → Schema + migrations
│  ├─ ui/             → Componentes compartidos
│  └─ icons/          → Iconos
│
├─ Deployment:
│  └─ Vercel (ÚNICO)  ← Monorepo pnpm, build único, deploy único
│
├─ DNS:
│  ├─ seoulshop.cl       → Vercel
│  ├─ api.seoulshop.cl   → Vercel (mismo destino)
│  ├─ cmr.seoulshop.cl   → Vercel
│  ├─ pos.seoulshop.cl   → Vercel
│  └─ drive.seoulshop.cl → Vercel
│
├─ Database:
│  └─ Neon PostgreSQL (sin cambios)
│
└─ Emails:
   └─ Resend (sin cambios)
```

---

## 📊 FASES DE EJECUCIÓN

### ✅ FASE 1: DIAGNÓSTICO (AHORA) ← AQUÍ ESTAMOS

**Objetivo:** Plan detallado, identificación de bloqueantes  
**Entregables:**
- [x] Diagnóstico arquitectónico completo
- [x] Identificación de problemas raíz
- [x] Plan por sprints
- [x] Timeline realista
- [x] Criterios de éxito

**Bloqueante Actual:** Emails no llegan → **SOLVER PRIMERO en FASE 2, Sprint 0**

---

### 🔴 FASE 2: EJECUCIÓN ITERATIVA (Pendiente aprobación)

#### **SPRINT 0: Email Gateway Fix (30 min)**
**Objetivo:** Emails llegando a usuarios reales

**Pasos:**
1. Verificar que Railway tenga env var `RESEND_API_KEY` seteada
2. Verificar que la BD esté respondiendo (health check 100% OK)
3. Forzar redeploy de Railway
4. Esperar emails en buzón (ceojorge@gmail.com, etc.)
5. ✅ Criterio de éxito: Usuario recibe email con credenciales en <2 min

**Outcome esperado:**
- 3 emails enviados con credenciales temporales
- Usuario puede hacer login desde celular
- Sistema está "minimamente viable"

---

#### **SPRINT 1: DNS Fix (15 min)**
**Objetivo:** Apuntar `api.seoulshop.cl` a Vercel (no a Workers)

**Pasos:**
1. En DonWeb, editar CNAME para `api.seoulshop.cl`
2. Cambiar de: `seul-api-production.seul-api.workers.dev`
3. A: `cname.vercel-dns.com` (igual que los otros subdominios)
4. Esperar propagación DNS (~5-15 min)
5. ✅ Criterio de éxito: `nslookup api.seoulshop.cl` apunta a Vercel

**Outcome esperado:**
- Todo el DNS consolidado en Vercel
- No hay inconsistencias

---

#### **SPRINT 2: Migrar API a Vercel Routes (2-3 horas)**
**Objetivo:** Mover `packages/api` a `/app/cerebro/src/app/api/` (o ruta root `/api`)

**Pasos:**
1. Crear estructura: `apps/cerebro/src/app/api/auth/*` para rutas
2. Mover handlers de `packages/api/src/server.ts` → `/app/api/*`
3. Mover servicios: `AuthService`, `PasswordService`, `EmailQueue`
4. Mover middleware de auth
5. Actualizar imports en todos los apps
6. Eliminar dependencia a Railway
7. ✅ Criterio de éxito: Endpoints `/api/auth/login`, `/api/auth/change-password` funcionando vía Vercel

**Riesgo:** Alto (refactor arquitectónico) → Requiere testing exhaustivo

---

#### **SPRINT 3: Eliminar Railway (5 min)**
**Objetivo:** Apagar contenedor de Railway

**Pasos:**
1. Dejar de pagar Railway
2. Eliminar CNAME de workers.dev si aún existe
3. ✅ Criterio de éxito: railway.app no existe más

---

#### **SPRINT 4: QA End-to-End (1-2 horas)**
**Objetivo:** Testing completo: email → login → cambio de contraseña → dashboard

**Pasos:**
1. Limpiar usuarios viejos de BD
2. Re-seed usuarios reales (ceojorge@gmail.com, etc.)
3. Esperar emails
4. Test desde 3 dispositivos diferentes
5. Verificar sesión persiste
6. ✅ Criterio de éxito: login funciona en web, mobile, tablet

**Checklist:**
- [ ] Email llega con credenciales
- [ ] Login con credenciales temporales exitoso
- [ ] Redirige a /cambiar-password
- [ ] Cambio de contraseña exitoso
- [ ] Email de confirmación llega
- [ ] Acceso a /dashboard 100%
- [ ] Logout limpia session
- [ ] Sesión persiste tras refresh

---

## 🎬 TIMELINE ESTIMADO

| Sprint | Descripción | Tiempo | Total Acumulado |
|--------|------------|--------|-----------------|
| 0 | Email Gateway Fix | 30 min | 30 min |
| 1 | DNS Consolidation | 15 min | 45 min |
| 2 | API Migration to Vercel | 2-3 h | 3-3.5 h |
| 3 | Apagar Railway | 5 min | 3-3.5 h |
| 4 | QA End-to-End | 1-2 h | 4-5.5 h |
| **TOTAL** | | | **~5 horas** |

---

## ✅ CRITERIOS DE ÉXITO FINAL

```
✅ INFRAESTRUCTURA:
  - Todo en Vercel (un deploy, una plataforma)
  - DNS consolidado (solo Vercel + Cloudflare NS)
  - Railway apagado
  
✅ FUNCIONALIDAD:
  - Emails llegan con credenciales
  - Login funciona desde cualquier dispositivo
  - Cambio de contraseña obligatorio en primer acceso
  - Email de confirmación llega al cambiar clave
  - Sesión persiste tras refresh
  - Logout limpia session real
  
✅ CALIDAD:
  - 100% de tests de login pasan
  - No hay console errors en browser
  - No hay DB connection timeout
  - Performance: login <1s, cambio de clave <1s
  
✅ OBSERVABILIDAD:
  - Logs claros en Vercel
  - Resend mostrando emails enviados
  - No hay errores de CORS
  - Health check 100% OK
```

---

## 🔍 INVESTIGACIONES REALIZADAS

**Hallazgo 1:** JWT_SECRET NO está seteado en Railway
- Problema: Código está usando fallback `'seul-king-os-secret-dev'` (inseguro)
- Solución: Sprint 2 debe setear en Vercel env vars
- Impacto: Crítico para seguridad

**Hallazgo 2:** RESEND_API_KEY SÍ está en .env.local
- ✅ Configurado correctamente
- No es el problema del email

**Hallazgo 3:** sistema-vertice TIENE estructura de /api routes en Vercel
- Patrón a replicar: `apps/web/app/api/*`
- Para seul-kims: `apps/cerebro/app/api/*` (o centralizado)

---

## 🚨 RIESGOS IDENTIFICADOS

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|------------|--------|-----------|
| JWT_SECRET no seteado en Railway | Alta | Crítico | Sprint 2: setear en Vercel secrets |
| Email sigue no llegando | Media | Crítico | Sprint 0 debe validar health check |
| DNS tarda >30 min en propagar | Baja | Medio | Tener paciencia, verificar con nslookup |
| API migration rompe imports | Alta | Crítico | Tests exhaustivos antes de deploy |
| Vercel build falla por lockfile | Media | Medio | Actualizar pnpm-lock.yaml antes |
| Neon tiene downtime | Baja | Crítico | Monitorear health checks en paralelo |

---

## 📌 BLOQUEANTES ACTUALES

1. **CRÍTICO:** Emails no llegan
   - Síntoma: Ningún usuario recibe credenciales
   - Causa: Database enum + Neon stability
   - Fix: Sprint 0 (30 min)
   - Bloqueante para: Login testing, user onboarding

2. **IMPORTANTE:** DNS inconsistente
   - Síntoma: API apunta a Workers pero código está en Railway
   - Causa: Config vieja no actualizada
   - Fix: Sprint 1 (15 min)
   - Bloqueante para: Production reliability

3. **ARQUITECTÓNICO:** Backend separado de frontends
   - Síntoma: 3 plataformas diferentes
   - Causa: Evolución del proyecto sin consolidación
   - Fix: Sprint 2 (2-3 horas)
   - Bloqueante para: Mantenibilidad a largo plazo

---

## 🎯 DECISIONES REQUERIDAS (USUARIO)

Antes de pasar a FASE 2, necesito tu aprobación en:

1. ✅ **¿Proceder con Consolidación en Vercel?**
   - Sí → Ejecutamos Sprints 0-4
   - No → Solo arreglamos DNS + emails (Sprint 0-1)

2. ✅ **¿Timeline de 5 horas es aceptable?**
   - El sistema estará en maintenance durante migración API

3. ✅ **¿Eliminar Railway completamente?**
   - Railway seguiría costando $5/mes si no se elimina

---

## 📑 ENTREGABLES DE FASE 2

Una vez aprobado, FASE 2 entregará:

```
✅ Código:
  - API migrado a Vercel routes
  - Todos los imports actualizados
  - Tests pasando
  - Commits limpios por sprint

✅ Infraestructura:
  - DNS actualizado en DonWeb
  - Railway apagado
  - Vercel con nuevo estructura

✅ Documentación:
  - README actualizado
  - CLAUDE.md actualizado
  - Sessión de trabajo documentada

✅ QA:
  - Testing checklist completado
  - Email delivery verificado
  - Login flow probado en 3+ dispositivos
```

---

## 📞 PRÓXIMO PASO

**¿Apruebas este plan para FASE 2?**

Responde:
- ✅ SÍ → Vamos con TODO (Sprints 0-4, consolidación completa)
- ⚠️ PARCIAL → Solo Sprint 0-1 (arreglar emails + DNS, mantener Railway)
- ❌ NO → Otra propuesta

Una vez aprobado, paso a **FASE 2: EJECUCIÓN** inmediatamente con Sonnet (desarrollador senior).

---

*Plan redactado como Arquitecto de Software + Lead QA Engineer*  
*SEUL KING OS v1.0 — Consolidación & Production Readiness*  
*2026-08-31*
