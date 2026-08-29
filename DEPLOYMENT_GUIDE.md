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

## ✨ Endpoints

Once deployed, these endpoints are available:

```
GET  /health              - Health check
GET  /                    - Service info
POST /api/auth/login      - Staff login
POST /api/customer/login  - Customer login
POST /api/orders          - Create order
POST /api/orders/:id/status - Update order
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
