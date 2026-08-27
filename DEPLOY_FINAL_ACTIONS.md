# 🚀 SEUL KING OS v1.0 — ACCIONES FINALES DE DEPLOY

**Estado:** En progreso  
**Fecha:** 2026-08-27  
**Fase:** Vercel deploy (apps web/pos/cerebro/repartidor) + Cloudflare Workers (API)

---

## 📊 ESTADO ACTUAL

### Vercel Apps (En construcción)
- [ ] **SEUL SHOP** (web) → Desplegando en Vercel
- [ ] **SEUL POS** (pos) → Pendiente
- [ ] **SEUL KING OS** (cerebro) → Pendiente
- [ ] **SEUL DRIVE** (repartidor) → Pendiente

### Cloudflare (Pendiente)
- [ ] **API Gateway** → Pendiente deploy de Workers
- [ ] **DNS Records** → Pendiente crear registro `api.seoulshop.cl`

### Database (Pendiente)
- [ ] Seed de usuarios en Neon

---

## 🔧 ACCIONES PENDIENTES

### 1. Esperar Vercel deploy completar (EN PROGRESO)

**Comando en ejecución:**
```bash
vercel deploy --prod --skip-domain
```

**Señales de éxito:**
- ✅ `Production: https://web-xxxxxx.vercel.app`
- ✅ Build completado sin errores

**Acción cuando complete:**
```bash
# Una vez exitoso, ejecutar:
vercel alias set <VERCEL_URL> seoulshop.cl

# O manualmente en Vercel dashboard:
# web project → Settings → Domains → Add seoulshop.cl
```

---

### 2. Desplegar Apps Restantes en Vercel

Una vez que el deploy de `web` sea exitoso, desplegar:

```bash
cd /Users/vertice/vertice_productions/seul-kims-os

# Desplegar POS
cd apps/pos
vercel deploy --prod
# Cuando complete: vercel alias set <URL> pos.seoulshop.cl

# Desplegar CEREBRO
cd ../cerebro
vercel deploy --prod
# Cuando complete: vercel alias set <URL> cmr.seoulshop.cl

# Desplegar REPARTIDOR
cd ../repartidor
vercel deploy --prod
# Cuando complete: vercel alias set <URL> drive.seoulshop.cl
```

---

### 3. Configurar Cloudflare DNS para API

**Acción manual en Cloudflare Dashboard:**

1. Ir a https://dash.cloudflare.com → seoulshop.cl
2. DNS → Add Record:
   - Type: `CNAME`
   - Name: `api`
   - Target: `seul-kims-api.workers.dev`
   - Proxy: ✅ Orange cloud
   - TTL: Auto

**O via CLI (si tienes `wrangler` configurado):**
```bash
wrangler dns record create seoulshop.cl \
  --name api \
  --type CNAME \
  --content seul-kims-api.workers.dev
```

---

### 4. Desplegar API en Cloudflare Workers

```bash
cd /Users/vertice/vertice_productions/seul-kims-os/packages/api

# Primero, establecer secrets (SOLO en producción)
wrangler secret put DATABASE_URL          # Neon PostgreSQL
wrangler secret put DTE_API_KEY           # Proveedor DTE
wrangler secret put DTE_RUT_EMPRESA       # RUT Seoul Kims
wrangler secret put UPSTASH_REDIS_URL     # Redis URL
wrangler secret put UPSTASH_REDIS_TOKEN   # Redis token
wrangler secret put SENTRY_DSN            # Sentry DSN (opcional)
wrangler secret put ANTHROPIC_API_KEY     # Claude API (opcional)

# Deploy
wrangler deploy

# Verificar que está online
curl https://api.seoulshop.cl/health
# Respuesta esperada: {"status":"ok"}
```

---

### 5. Seed de Base de Datos

Una vez que la API esté online:

```bash
cd /Users/vertice/vertice_productions/seul-kims-os

# Ejecutar seed (crea usuarios iniciales)
npx tsx packages/db/src/seed-production.ts

# Verificar usuarios creados
psql $DATABASE_URL -c "SELECT email, role FROM users;"
```

---

### 6. Validar Login y Apps

Una vez que todo esté online:

1. **Acceder a SEUL KING OS:**
   - URL: https://cmr.seoulshop.cl/login
   - Email: founder@seoulkims.cl
   - Contraseña: (ver CREDENCIALES_PRODUCCION.md)
   - Acción: Debería pedir cambiar contraseña

2. **Acceder a SEUL SHOP:**
   - URL: https://seoulshop.cl
   - Debería mostrar catálogo de productos

3. **Acceder a SEUL POS:**
   - URL: https://pos.seoulshop.cl/login
   - Debería mostrar página de login

4. **Acceder a SEUL DRIVE:**
   - URL: https://drive.seoulshop.cl/login
   - Debería mostrar página de login con PWA prompt

---

## 📋 CHECKLIST FINAL

### Vercel Apps
- [ ] web deployment completado
- [ ] pos deployment completado
- [ ] cerebro deployment completado
- [ ] repartidor deployment completado
- [ ] Todos los dominios asignados correctamente

### Cloudflare
- [ ] DNS record para `api.seoulshop.cl` creado
- [ ] API Worker desplegado
- [ ] `/health` endpoint responde 200

### Database
- [ ] Seed ejecutado
- [ ] Usuarios (founder, gerente) verificados en BD

### Validaciones
- [ ] Login en cmr.seoulshop.cl funciona
- [ ] Tienda carga en seoulshop.cl
- [ ] POS login carga en pos.seoulshop.cl
- [ ] Drive login carga en drive.seoulshop.cl

### Post-Deploy
- [ ] Notificar a Seoul Kims
- [ ] Habilitar Sentry monitoring
- [ ] Configurar backups de BD
- [ ] Documentar URLs en gestor de contraseñas

---

## 🚨 TROUBLESHOOTING

| Problema | Solución |
|----------|----------|
| Vercel build falla con pnpm | Verificar que corepack está habilitado, pnpm-lock.yaml existe |
| DNS no resuelve | Esperar 5-30 min propagación. Verificar en Cloudflare |
| API 502 / timeout | Verificar que DATABASE_URL secret está correcto en Cloudflare |
| Login 401 | Verificar que seed se ejecutó, usuarios existen en BD |

---

**Próximo paso:** Esperar que Vercel deploy complete → Asignar dominio seoulshop.cl → Deploy POS/CEREBRO/DRIVE → Deploy API → Seed BD → Validar login

