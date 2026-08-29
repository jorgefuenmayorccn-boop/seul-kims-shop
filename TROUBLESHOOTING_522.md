# Error 522 — Railway Timeout Diagnosis

## 🔴 ¿Qué significa Error 522?

**Cloudflare → Timeout → Railway**

```
Cloudflare ✅ conecta a Railway
         ↓
      Railway ❌ no responde en 30-90 segundos
         ↓
      Cloudflare ❌ retorna Error 522
```

---

## 🔍 CAUSAS PROBABLES

### 1️⃣ **DATABASE_URL no está correcta** (MÁS PROBABLE)
- Connection string mal copiada
- Credenciales incorrectas
- Pool exhausted

### 2️⃣ **Railway todavía compilando**
- Deployment en progreso
- Build timeout

### 3️⃣ **Neon PostgreSQL no responde**
- Base de datos inactiva
- Timeout de conexión

### 4️⃣ **Servidor Node.js crashea**
- Error en startup
- Memoria insuficiente
- Bug en el código

---

## ✅ VERIFICAR EN RAILWAY (AHORA MISMO)

### Paso 1: Acceder a Railway
```
https://railway.app
→ Click "SEUL" project
→ Click "sparkling-fulfillment" service
```

### Paso 2: Revisar Deployments
**Look for status:**
- 🟢 `Running` — servidor está arriba
- 🟡 `Building` — aún compilando
- 🔴 `Error` — compilación falló

### Paso 3: Leer LOGS
Click "Logs" tab y busca:

```bash
# ✅ Esto es BUENO:
✅ Server listening on port 8080
✅ Database pool created
✅ Database connected

# ❌ Esto es MALO:
❌ ECONNREFUSED (BD no conecta)
❌ Error: DATABASE_URL required
❌ timeout connecting to server
❌ Error loading modules
```

---

## 🔧 SOLUCIONES POR ESCENARIO

### ESCENARIO 1: Status = "Error"
```
1. Click "Redeploy"
2. Espera 3-5 minutos
3. Verifica logs
4. Si persiste, contactar soporte
```

### ESCENARIO 2: Status = "Building"
```
1. Espera a que termine (5-10 min)
2. Revisa logs cuando termine
3. Si no inicia, click "Redeploy"
```

### ESCENARIO 3: Status = "Running" pero Logs muestran error BD
```
1. Ir a: Settings → Environment Variables
2. Verificar DATABASE_URL:
   - ¿Comienza con "postgresql://"?
   - ¿Contiene neondb_owner?
   - ¿Está completa (sin truncarse)?
3. Si está mal:
   - Ir a Data tab
   - Ver la URL correcta de PostgreSQL
   - Copiar COMPLETA
   - Actualizar en Environment Variables
   - Click "Save"
   - Ir a Deployments y click "Redeploy"
```

### ESCENARIO 4: Logs muestran "Server listening" pero API sigue 522
```
1. Test directo a Railway (ver comando abajo)
2. Si responde 200 → Problema en Cloudflare DNS
   - Ver sección DNS abajo
3. Si responde 502/timeout → Problema en código
   - Contactar arquitecto técnico
```

---

## 🧪 COMANDO PARA TESTEAR DIRECTO (SIN CLOUDFLARE)

```bash
# Test al endpoint directo de Railway
curl -i https://sparkling-fulfillment-production-8172.up.railway.app/health

# Esperado:
# HTTP/1.1 200 OK
# {"ok":true,"status":"healthy","db":"connected"}

# Si ves:
# - HTTP 502 → Railway server error
# - timeout → Railway slow/not responding
# - 200 OK → Problema es Cloudflare, no Railway
```

---

## 🌐 VERIFICAR DNS (Si Railway responde pero api.seoulshop.cl no)

**Cloudflare → DNS Configuration**

Verifica que el CNAME esté correcto:

```
api.seoulshop.cl  →  CNAME  →  sparkling-fulfillment-production-8172.up.railway.app
```

Si está mal:
1. En Cloudflare, ir a DNS
2. Editar el CNAME
3. Debe ser: `sparkling-fulfillment-production-8172.up.railway.app`
4. Guardar
5. Esperar 5-15 minutos para que se propague

---

## 📞 RESUMEN DE ACCIONES

| Problema | Acción |
|----------|--------|
| Status = Error | Redeploy |
| Status = Building | Esperar |
| Logs: BD error | Actualizar DATABASE_URL |
| Railway 200, api.seoulshop.cl 522 | Verificar DNS CNAME |
| Todo parece OK pero 522 persiste | Contactar soporte |

---

## 🆘 SI NADA FUNCIONA

1. Copiar los LOGS completos de Railway
2. Copiar la salida de:
   ```bash
   curl -i https://sparkling-fulfillment-production-8172.up.railway.app/health
   ```
3. Contactar equipo técnico con esa información

---

**Last Updated:** Aug 29, 2026  
**SEUL v1.0 Troubleshooting Guide**
