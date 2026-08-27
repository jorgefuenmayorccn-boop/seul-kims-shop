# 🚀 Vercel Deployment for pnpm Monorepos — Lecciones Aprendidas

**Proyecto:** SEUL KING OS v1.0  
**Fecha:** 2026-08-27  
**Estado:** En construcción (attempt 5)

---

## 🔥 Problemas Encontrados & Soluciones

### Problema 1: "No Next.js version detected"
**Síntoma:** Vercel detecta que es un monorepo pero no encuentra Next.js  
**Causa:** Vercel espera encontrar `next` en el package.json del contexto de build  
**Intentos fallidos:**
- ❌ `buildCommand: "cd apps/web && pnpm build"` — Vercel no respeta cd
- ❌ `buildCommand: "pnpm build --filter @seul/web"` — No detecta Next.js
- ❌ Framework: "nextjs" + outputDirectory — Conflicto de schema

**Solución Potencial (Attempt 5):**
```json
{
  "buildCommand": "npm install -g pnpm@9.15.0 && pnpm install --frozen-lockfile && pnpm build --filter @seul/web",
  "installCommand": "npm install -g pnpm@9.15.0 && pnpm install --frozen-lockfile",
  "outputDirectory": "apps/web/.next"
}
```

**Explicación:**
1. Instalar pnpm globalmente ANTES de usar
2. pnpm install asegura todas las deps disponibles localmente
3. pnpm build --filter hace que turbo + pnpm encuentren el paquete
4. outputDirectory apunta a .next correcto

---

### Problema 2: vercel.json Schema Validation

**Campos NO permitidos en vercel.json:**
- ❌ `framework` (Vercel lo detecta automáticamente)
- ❌ `nodeVersion` (usa .nvmrc en la raíz)
- ❌ `envs` (usa environment variables en Vercel dashboard)

**Campos permitidos:**
- ✅ `buildCommand`
- ✅ `installCommand`
- ✅ `outputDirectory`
- ✅ `ignoreCommand` (para skips builds)
- ✅ `regions` (para edge deployment)

---

## 📋 Configuración Correcta para Monorepo

### vercel.json (Minimal)
```json
{
  "buildCommand": "npm install -g pnpm@9.15.0 && pnpm install --frozen-lockfile && pnpm build --filter @seul/web",
  "installCommand": "npm install -g pnpm@9.15.0 && pnpm install --frozen-lockfile",
  "outputDirectory": "apps/web/.next"
}
```

### .nvmrc (en raíz)
```
20
```

### .npmrc (en raíz)
```
engine-strict=true
pnpm-version=9.15.0
```

### pnpm-workspace.yaml (en raíz)
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## 🎯 Estrategias Alternativas Consideradas

### Opción A: Separar proyectos Vercel (RECOMENDADO después)
```
Proyecto 1: web → seoulshop.cl
Proyecto 2: pos → pos.seoulshop.cl
Proyecto 3: cerebro → cmr.seoulshop.cl
Proyecto 4: repartidor → drive.seoulshop.cl
```
**Ventaja:** Cada app tiene su propio build context, sin conflicts  
**Desventaja:** 4 proyectos Vercel diferentes

### Opción B: Usar Vercel Build Output API
Crear un `vercel/functions/index.js` que expone un built website  
**Ventaja:** Full control sobre el build process  
**Desventaja:** Más complejo, requiere custom logic

### Opción C: Usar Turborepo con Vercel
Confiar en `turbo build` en lugar de `pnpm build --filter`  
**Ventaja:** Turbo optimiza caches  
**Desventaja:** Agrega otra layer de complexity

---

## 🔧 Si Falla Nuevamente

### Debug Steps:
1. Revisar Vercel build logs completos (no solo tail -100)
2. Verificar que pnpm está instalado: `npm install -g pnpm@9.15.0`
3. Verificar que dependencies están correctas: `pnpm list next`
4. Ejecutar locally: `pnpm install && pnpm build --filter @seul/web`

### Fallback: Deploy Individual Apps

Si el monorepo sigue fallando, desplegar cada app como proyecto separado:

```bash
# Crear proyecto web en Vercel
mkdir -p /tmp/seul-web-vercel
cp -r apps/web /tmp/seul-web-vercel/app
cp package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml /tmp/seul-web-vercel/
cd /tmp/seul-web-vercel
vercel deploy --prod
```

---

## 📊 Timeline de Intentos

| # | Fecha | Comando | Resultado | Causa del Error |
|---|-------|---------|-----------|-----------------|
| 1 | 08:00 | vercel deploy | 404 | DNS resolvía pero app no deployed |
| 2 | 08:15 | vercel deploy | npm install fail | pnpm no detectado |
| 3 | 08:30 | vercel deploy --prod | No Next.js detected | vercel.json schema error (envs) |
| 4 | 08:45 | vercel deploy --prod | Schema error | nodeVersion not valid |
| 5 | 09:00 | vercel deploy --prod | **EN PROGRESO** | Minimal config approach |

---

## 🎓 Lecciones Clave

1. **pnpm en Vercel es complejo** — Vercel asume npm/yarn por defecto
   - Instalar pnpm globalmente ANTES de usar
   - No confiar en corepack en buildCommand

2. **vercel.json schema es estricto**
   - Solo campos documentados funcionan
   - Errores de schema previenen el build

3. **Monorepos requieren buildCommand explícito**
   - `pnpm build --filter` funciona mejor que `cd apps/web`
   - pnpm install --frozen-lockfile es esencial

4. **Alternativa: Proyectos Vercel Separados**
   - Podría ser más simple que un monorepo
   - Cada app tiene su contexto de build aislado

---

## ✅ Si Esta Configuración Funciona

Guardar este setup como referencia para futuros deploys de SEUL.

```bash
# Quick reference
vercel deploy --prod --skip-domain  # Deploy current branch
vercel alias set <URL> seoulshop.cl # Assign domain
```

---

**Próxima acción:** Esperar a que build complete con minimal vercel.json

