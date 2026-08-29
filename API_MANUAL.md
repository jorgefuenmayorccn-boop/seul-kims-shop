# 📚 SEUL KING OS v1.0 — API MANUAL

**Versión:** 1.0.0  
**Fecha:** 2026-08-29  
**Estado:** ✅ Production Ready

---

## 🚀 **Quick Start**

### **Endpoints**

```
GET    /health                          — API health check + DB status
POST   /api/auth/register               — Registrar nuevo usuario
GET    /api/email-queue/:id             — Verificar estado de email
```

---

## 📋 **Endpoints Detallados**

### **1. Health Check**

**Endpoint:** `GET /health`

**Respuesta:**
```json
{
  "ok": true,
  "status": "healthy",
  "db": "connected"
}
```

**Status Codes:**
- `200` — API OK, DB conectada
- `503` — API degradado (DB no disponible)

---

### **2. Registro de Usuario**

**Endpoint:** `POST /api/auth/register`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "usuario@example.com",
  "password": "SeulKims2025!",
  "firstName": "Jorge",
  "lastName": "Fuenmayor"
}
```

**Respuesta (200 OK):**
```json
{
  "ok": true,
  "message": "Registration successful. Check your email.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "name": "Jorge Fuenmayor"
  },
  "emailQueueId": "38bb7e0f-9512-44dc-a3b7-861f7c8584f7"
}
```

**Errores:**
```json
{
  "error": "Missing required fields"
}
```

**Flow:**
1. Usuario envía datos de registro
2. API valida campos requeridos
3. ✅ Email se enqueúa (P1 Queue System)
4. ✅ Email se envía async con reintentos
5. JWT token se genera
6. Respuesta inmediata al cliente

---

### **3. Verificar Estado de Email**

**Endpoint:** `GET /api/email-queue/:id`

**Ejemplo:**
```
GET /api/email-queue/38bb7e0f-9512-44dc-a3b7-861f7c8584f7
```

**Respuesta:**
```json
{
  "id": "38bb7e0f-9512-44dc-a3b7-861f7c8584f7",
  "email": "usuario@example.com",
  "status": "sent",
  "attempts": 1,
  "lastError": null,
  "createdAt": "2026-08-29T04:15:30.123Z"
}
```

**Status Posibles:**
- `pending` — Esperando envío
- `sent` — ✅ Enviado exitosamente
- `failed` — ❌ Falló después de 3 intentos

---

## 🔄 **P1 Email Queue System**

### **¿Cómo funciona?**

```
1. POST /api/auth/register
   ↓
2. Email se enqueúa (Map en memoria)
   ↓
3. Async send a Resend (no bloquea request)
   ↓
4. Si falla: retry con backoff exponencial
   - Intento 1: 2 segundos
   - Intento 2: 4 segundos
   - Intento 3: 8 segundos
   ↓
5. Status disponible en GET /api/email-queue/:id
```

### **Características**

✅ **Async** — Email no bloquea request  
✅ **Reintentos** — Hasta 3 intentos c/backoff exponencial  
✅ **Logging** — Auditoría completa en console  
✅ **Monitoring** — Estado queryable vía endpoint  
✅ **Resend Integration** — Proveedor SMTP confiable  

---

## 🔐 **Autenticación**

Todas las requests a `/api/*` deben incluir:

```
Authorization: Bearer {TOKEN}
```

**Donde `{TOKEN}` es el JWT retornado en `/api/auth/register`**

---

## 🌍 **CORS**

API permite requests desde:

```
http://localhost:3000
http://localhost:3001
http://localhost:3002
http://localhost:3003
https://seoulshop.cl
https://shop.seoulshop.cl
https://pos.seoulshop.cl
https://cmr.seoulshop.cl
https://drive.seoulshop.cl
```

---

## 🔧 **Variables de Entorno**

### **Requeridas**

```bash
DATABASE_URL              # PostgreSQL/Neon
RESEND_API_KEY           # Resend email service
APP_URL                  # Base URL para links (ej: https://seoulshop.cl)
PORT                     # Puerto (default: 3000)
JWT_SECRET              # Secret para tokens (default: seul-king-os-secret-dev)
```

### **Ejemplo .env**

```bash
# Production (Railway)
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require&channel_binding=require
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Get from Resend dashboard
APP_URL=https://api.seoulshop.cl
PORT=3000
JWT_SECRET=your-secret-key-here-min-32-chars

# Development (Local)
DATABASE_URL=postgresql://localhost/seul_dev
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Get from Resend dashboard
APP_URL=http://localhost:3000
PORT=3000
JWT_SECRET=dev-secret
```

---

## 📊 **Test & Debugging**

### **Test completo (via cURL)**

```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Registrar usuario
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "Test123!456",
    "firstName": "Jorge",
    "lastName": "Fuenmayor"
  }'

# 3. Verificar status del email (usa emailQueueId de respuesta anterior)
curl http://localhost:3000/api/email-queue/38bb7e0f-9512-44dc-a3b7-861f7c8584f7
```

### **Logs en tiempo real**

```bash
# Terminal 1: Levantarl API
cd packages/api
RESEND_API_KEY=... DATABASE_URL=... pnpm dev

# Terminal 2: Ver logs
tail -f /tmp/api.log
```

---

## 🚀 **Deploy**

### **Railway (Producción)**

```bash
# 1. Push a main
git push origin main

# 2. Railway auto-deploya desde GitHub
# Ver: https://railway.app/project/your-project

# 3. Verificar
curl https://api.seoulshop.cl/health
```

### **Local Development**

```bash
cd packages/api

# Instalar deps
pnpm install

# Levantarl servidor
RESEND_API_KEY=... DATABASE_URL=... PORT=3000 pnpm dev

# Servidor escucha en http://localhost:3000
```

---

## ⚠️ **Restricciones & Límites**

- **Emails/usuario/minuto:** Sin límite (usar rate limiter en prod)
- **Reintentos:** Máximo 3 intentos c/email
- **Queue en memoria:** Se pierde al reiniciar servidor
- **Timeout DB:** 30 segundos (idle_timeout)

---

## 🔍 **Troubleshooting**

### **Error: "Missing required fields"**

Verificar que el body incluye:
```json
{
  "email": "required",
  "password": "required",
  "firstName": "required",
  "lastName": "optional"
}
```

### **Error: "Registration failed"**

Ver console logs:
```bash
tail -20 /tmp/api.log | grep "❌"
```

### **Email no llega**

Verificar status:
```bash
curl http://localhost:3000/api/email-queue/{emailQueueId}
```

Si status es `failed`:
- Revisar `lastError` en respuesta
- Verificar RESEND_API_KEY
- Revisar spam/promotions en email

---

## 📈 **Monitoreo**

### **Métricas a monitoriear**

```
✅ /health — DB availability
✅ Email queue status — Email delivery success rate
✅ Response times — API latency
✅ Error rates — Failed registrations
```

### **Sentry (Optional)**

```bash
export SENTRY_DSN=https://...
# Errores se envían automáticamente a Sentry
```

---

## 🎯 **Roadmap P2**

- [ ] Persistencia de queue en DB (en lugar de Map)
- [ ] Rate limiting (máx 5 emails/usuario/min)
- [ ] Webhook de Resend (bounce handling)
- [ ] Dashboard de estadísticas
- [ ] Confirmación de email con link verificado
- [ ] Recuperación de contraseña
- [ ] 2FA SMS via Twilio

---

## 📞 **Soporte**

**Estado:** Production Ready ✅  
**Última actualización:** 2026-08-29  
**Última prueba:** Prueba de fuego completada ✅

Para issues o preguntas, revisar logs en `/tmp/api.log`
