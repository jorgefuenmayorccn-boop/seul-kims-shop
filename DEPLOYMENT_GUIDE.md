# SEUL API v1.0 - Deployment Guide

## ✅ Status: PRODUCTION READY

Code is fully optimized and ready for deployment.

## 🚀 Quick Start (5 minutes)

### Step 1: Configure Railway Environment

Go to: **railway.app → SEUL project → Settings → Environment Variables**

Add these variables:

```bash
DATABASE_URL=postgresql://user:password@postgres.railway.internal:5432/railway
RESEND_API_KEY=re_your_resend_key_here
NODE_ENV=production
ADMIN_EMAIL=admin@seoulshop.cl
```

### Step 2: Deploy

Click "Deploy" or wait for auto-redeploy. Takes 2-3 minutes.

### Step 3: Verify

```bash
curl https://api.seoulshop.cl/health

# Expected response:
# {"ok":true,"status":"healthy","db":"connected"}
```

## 📋 Configuration Details

### Database
- **Source:** Railway PostgreSQL or Neon
- **Get DATABASE_URL from:** Railway Data tab
- **Copy internal URL:** `postgres.railway.internal:5432`

### Email
- **Service:** Resend
- **Get RESEND_API_KEY from:** https://resend.com/api-keys

### Security
- ✅ No secrets in code
- ✅ All secrets in Railway env vars
- ✅ SSL required for DB connection
- ✅ HTTPS enforced

## 🔍 Troubleshooting

### If you see 502 error:

1. **Check logs:**
   ```
   railway.app → Deployments → Latest → Logs
   ```

2. **Common issues:**
   - ❌ `DATABASE_URL` not set
   - ❌ PostgreSQL not running
   - ❌ Connection timeout

3. **Solutions:**
   - Verify DATABASE_URL in env vars
   - Check Railway Data tab status
   - Restart deployment

## 📚 Architecture

- **Frontend:** Vercel (Next.js apps)
- **API:** Railway (Node.js + Hono)
- **Database:** PostgreSQL (Railway or Neon)
- **Email:** Resend
- **Payments:** Stripe
- **DNS:** Cloudflare

## 👥 CREDENCIALES DE ACCESO

### USUARIO 1 — DUEÑO (Root Admin)
```
Email:      founder@seoulshop.cl
Contraseña: SeoulKims2026!
Rol:        Owner (Acceso total)
URL:        https://cmr.seoulshop.cl/login
```

### USUARIO 2 — ADMINISTRADOR (Staff)
```
Email:      gerente@seoulshop.cl
Contraseña: Gerente2026!
Rol:        Admin (Inventario, Órdenes, Reportes)
URL:        https://cmr.seoulshop.cl/login
```

⚠️ **SEGURIDAD IMPORTANTE:**
- ✅ Cambiar contraseña en primer login
- ✅ Guardar en gestor de contraseñas seguro (1Password, Dashlane)
- ✅ No compartir por email
- ✅ Usar 2FA si está disponible
- ✅ Logout después de usar

## ✨ Endpoints

Once deployed, these endpoints are available:

### Public Endpoints
```
GET  /health              - Health check
GET  /                    - Service info
```

### B2C/B2B Endpoints
```
POST /api/orders          - Create order
POST /api/orders/:id/status - Update order status
POST /api/b2b/quotes      - Create B2B quote
POST /api/b2b/quotes/:id/accept - Accept quote
POST /api/b2b/quotes/:id/reject - Reject quote
```

### Admin Endpoints (require API key)
```
POST /api/admin/api-keys         - Create new API key
GET  /api/admin/api-keys         - List user's API keys
POST /api/admin/api-keys/:id/revoke - Revoke API key
```

### API Key Authorization
All admin endpoints require Bearer token in Authorization header:
```bash
curl -H "Authorization: Bearer seul_live_xxxxxx" \
  https://api.seoulshop.cl/api/admin/api-keys
```

## 🎯 Next Steps

1. ✅ Configure Railway env vars
2. ✅ Deploy
3. ✅ Test health check
4. ✅ Monitor logs
5. ✅ Go live

---

**Last Updated:** Aug 29, 2026  
**Version:** SEUL v1.0 Production Ready
