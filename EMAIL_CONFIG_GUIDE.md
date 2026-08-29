# 📧 Email Configuration Guide — SEUL KING OS v1.0

## Current State (TESTING)

**All automation emails currently route to:** `jsfuenmayorproductions@gmail.com`

**5 Active Endpoints:**
1. `POST /api/shop/devoluciones` — Return/Refund Requests
2. `POST /api/b2b/solicitar-credito` — Credit Requests  
3. `POST /api/b2b/postventa` — Post-Sale Support
4. `POST /api/admin/crear-usuario` — Create Admin User (dual-send)
5. `POST /api/auth/register` — Customer Registration (dual-send)

---

## For Production Delivery (CLIENT)

### Step 1: Update Environment Variables

Change the email configuration in your deployment platform:

**Railway / Vercel Dashboard:**
```
ADMIN_EMAIL=admin@seoulshop.cl
CAJERO_EMAIL=cajero.admi@seoulshop.cl
```

**Or in `.dev.vars` for local development:**
```
# Production emails
ADMIN_EMAIL=admin@seoulshop.cl
CAJERO_EMAIL=cajero.admi@seoulshop.cl
```

### Step 2: Email Routing After Change

| Endpoint | Admin Receives | Customer Receives |
|----------|---|---|
| `/api/shop/devoluciones` | admin@seoulshop.cl | Own email (in content) |
| `/api/b2b/solicitar-credito` | admin@seoulshop.cl | Own email (in content) |
| `/api/b2b/postventa` | admin@seoulshop.cl | Own email (in content) |
| `/api/admin/crear-usuario` | admin@seoulshop.cl | Own email (credentials) |
| `/api/auth/register` | admin@seoulshop.cl | Own email (verification) |

### Step 3: Verify It's Working

Test an endpoint after changing env vars:

```bash
curl -X POST http://localhost:3000/api/shop/devoluciones \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@example.com",
    "nombre": "Test Cliente",
    "numeroOrden": "ORD-12345",
    "razon": "Test"
  }'
```

Check admin@seoulshop.cl inbox for the email.

---

## Code Reference

**File:** `packages/api/src/server.ts`

**Lines 1-10:** Configuration variables
```typescript
// Admin emails for notifications
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@seoulshop.cl'
const CAJERO_EMAIL = process.env.CAJERO_EMAIL || 'cajero.admi@seoulshop.cl'
```

**All endpoints use:** `const adminEmail = ADMIN_EMAIL`

---

## Testing Commands

### Test Single Endpoint
```bash
curl -X POST http://localhost:3000/api/shop/devoluciones \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","nombre":"Test","numeroOrden":"ORD-001","razon":"Test"}'
```

### Run Full Test Suite
```bash
./test-all-emails.sh
```

---

## Email Templates

All emails include:
- ✅ Seoul Kims branding (red #d7263d)
- ✅ Customer/Company details
- ✅ Professional HTML design
- ✅ Responsive layout
- ✅ Clear call-to-action buttons
- ✅ Footer with contact info

---

## Defaults

If env vars are NOT set, the system will use these defaults:
- `ADMIN_EMAIL` → `admin@seoulshop.cl`
- `CAJERO_EMAIL` → `cajero.admi@seoulshop.cl`

**So the code is already client-ready!** Just deploy without changing anything if you want the final emails immediately.

---

## Support

**Issues:**
- Email not arriving? Check spam folder
- Wrong recipient? Verify `ADMIN_EMAIL` env var in deployment platform
- Queue problem? Check `/api/email-queue/:id` endpoint

**Queue Status Endpoint:**
```bash
curl http://localhost:3000/api/email-queue/{emailId}
```

Returns:
```json
{
  "id": "...",
  "email": "admin@seoulshop.cl",
  "subject": "...",
  "status": "sent",
  "attempts": 1,
  "createdAt": "2026-08-29T..."
}
```

---

*Last Updated: 2026-08-29*
