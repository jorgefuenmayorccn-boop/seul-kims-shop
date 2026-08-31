# 🔒 SECURITY POLICY — SEUL KING OS v1.0

**Last Updated:** 2026-08-31  
**Responsible:** Lead Architect + Senior Developer  
**Policy Version:** 1.0 (Production)

---

## 🎯 SECURITY PRINCIPLES

### Fundamental Rules (Non-negotiable)

1. **No Hardcoded Credentials**: All secrets must be in env vars or secure secret manager
2. **No Plaintext Passwords**: Always hash with PBKDF2-SHA256 (100k iterations minimum)
3. **No Authentication Bypass**: Fallback auth only in development mode (gated)
4. **Rate Limiting**: All login endpoints protected (5 attempts / 15 min max)
5. **Audit Trail**: All login attempts recorded (success, failure, IP, user-agent)

---

## 🔐 CREDENTIAL MANAGEMENT

### Current Status

| Credential | Status | Location | Action |
|------------|--------|----------|--------|
| RESEND_API_KEY | 🔴 EXPOSED | Git history + .env.local | **ROTATE IMMEDIATELY** |
| DATABASE_URL | 🔴 EXPOSED | Git history + .env.local | **ROTATE IMMEDIATELY** |
| JWT_SECRET | 🔴 EXPOSED | Git history + .dev.vars | **ROTATE IMMEDIATELY** |
| VERCEL_OIDC_TOKEN | 🔴 EXPOSED | Git history + .env.local | **ROTATE IMMEDIATELY** |

### Rotation Procedure (DO THIS NOW)

**Step 1: Resend API Key**
1. Login to dashboard.resend.com
2. Click Settings → API Keys
3. Click "Delete" next to current key
4. Generate new API key
5. Copy → Update Railway env var `RESEND_API_KEY`
6. Test: Send test email from dashboard

**Step 2: Database Password**
1. Login to neon.tech dashboard
2. Select project → Settings
3. Click "Change password" for default role
4. Generate strong password (20+ chars, mixed)
5. Update DATABASE_URL in Railway with new password
6. Test: `psql <new-DATABASE_URL>` (verify connection)

**Step 3: JWT Secret**
1. Generate new secret: `openssl rand -hex 32`
2. Copy to Railway env var `JWT_SECRET`
3. Deploy (all existing sessions will be invalidated - OK for dev)
4. Verify: Users can login with new token

**Step 4: Remove from Git History**
1. Use BFG to clean history: `bfg --delete-files .env.local`
2. Force push: `git push --force origin main`
3. Warn all team members to pull --rebase
4. Verify git log no longer contains credentials: `git log -S "RESEND" | head -5`

---

## 🛡️ AUTHENTICATION HARDENING

### Implemented Protections

#### 1. Password Hashing
- Algorithm: PBKDF2-SHA256
- Iterations: 100,000 (NIST recommended)
- Salt: Crypto-random, included in hash
- Timing-safe: Uses `crypto.timingSafeEqual()` (prevents timing attacks)

**File**: `packages/api/src/services/password.service.ts`

#### 2. Session Management
- Cookie name: `__Host-seul_session` (HTTPS-only prefix)
- HttpOnly: TRUE (prevents JS access)
- Secure: TRUE (HTTPS only)
- SameSite: Lax (CSRF protection)
- Max-Age: 7 days
- Domain: Not set (current domain only)

**File**: `packages/api/src/server.ts:269-275`

#### 3. Rate Limiting
- Failed attempts tracked: login_attempts table
- Block rule: 5+ failures in 15 minutes = 429 Blocked
- Reset: On successful login
- IP logged: For incident investigation

**Files**: 
- Tracking: `packages/api/src/server.ts:188-226`
- Migration: `packages/api/src/server.ts:0015`

#### 4. First-Login Password Change
- New users created with `must_change_password = true`
- Redirect to `/cambiar-password` (cannot bypass)
- Password requirements:
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 number
- Confirmation email sent after change

**File**: `apps/cerebro/src/app/cambiar-password/page.tsx`

#### 5. JWT Token Management
- Signature: HS256 (HMAC-SHA256)
- Secret: Stored in Railway env var (not in code)
- Expiration: 7 days (short for admin apps)
- Payload: Minimal (id, email, role)

**File**: `packages/api/src/services/auth.service.ts`

---

## ⚠️ KNOWN RISKS & MITIGATIONS

### Risk 1: Session Fixation (Low)
**Scenario**: Attacker knows JWT secret, forges tokens  
**Mitigation**: 
- JWT_SECRET in secure env var only
- Rotate on each deployment
- Short 7-day expiration
**Responsibility**: Rotate credentials immediately

### Risk 2: Brute Force Password (Low → MITIGATED)
**Scenario**: Attacker tries 1000 passwords  
**Mitigation**: Rate limiting (5 attempts / 15 min = blocked)  
**Status**: ✅ IMPLEMENTED

### Risk 3: CORS Bypass (Low)
**Scenario**: Attacker from evil.com makes login request  
**Mitigation**: 
- Whitelist exact origins (no wildcards)
- CORS only on login endpoint
- Credentials required (no simple requests)
**Status**: ✅ IMPLEMENTED  
**Review**: Check `corsOptions` and `allowedOrigins` quarterly

### Risk 4: SQL Injection (Very Low)
**Scenario**: Attacker tries SQL injection in email field  
**Mitigation**: Parameterized queries (postgres library handles)
**Status**: ✅ IMPLEMENTED

### Risk 5: Email Interception (Medium → ACKNOWLEDGED)
**Scenario**: Attacker intercepts plaintext password in email  
**Mitigation**: 
- Force password change on first login (temporary password has short window)
- Use HTTPS for all login
- Store only hashes in DB
**Status**: ✅ IMPLEMENTED  
**Note**: Email is inherently insecure; temporary passwords are acceptable for setup

---

## 🚨 INCIDENT RESPONSE

### What to do if:

**Q: Compromise suspected (credentials leaked)**
1. Rotate all secrets (RESEND_KEY, DB_PASSWORD, JWT_SECRET)
2. Invalidate all existing sessions (change JWT_SECRET)
3. Force password reset for all users
4. Review login_attempts table for suspicious patterns
5. Notify users

**Q: Brute force attack detected**
1. Check login_attempts for high failure count from single IP
2. Consider firewall rule to block IP temporarily
3. Review rate_limiting effectiveness
4. Monitor `login_attempts` table

**Q: Email delivery fails**
1. Check Resend dashboard for quota/bounce errors
2. Verify RESEND_API_KEY is correct
3. Check email_queue table for failed entries
4. Manually retry failed emails

**Q: Database compromised**
1. Rotate DATABASE_URL immediately
2. All passwords are already hashed (attacker gets hashes, not passwords)
3. Notify users of incident
4. Force password resets

---

## 📋 COMPLIANCE CHECKLIST

### Code Review (Before Every Deploy)

- [ ] No new hardcoded credentials in code
- [ ] All new secrets use env vars
- [ ] No plaintext passwords in logs
- [ ] No SQL injection vulnerabilities (use parameterized queries)
- [ ] All auth endpoints have rate limiting
- [ ] Sessions are httpOnly + Secure
- [ ] CORS whitelist is minimal (no wildcards)

### Deployment

- [ ] RESEND_API_KEY rotated (monthly)
- [ ] JWT_SECRET rotated (quarterly or per incident)
- [ ] DATABASE_URL password rotated (quarterly or per incident)
- [ ] All .env.local files are in .gitignore
- [ ] Git history cleaned of credentials (if exposed)

### Monitoring

- [ ] login_attempts table reviewed weekly (> 5 failures/hour alerts)
- [ ] email_queue checked for failed deliveries
- [ ] Vercel build logs reviewed for exposed secrets
- [ ] Railway logs reviewed for errors

---

## 📞 SECURITY CONTACTS

**Lead Architect**: Claude (AI Assistant)  
**System Owner**: Jorge Fuenmayor (@jorgefuenmayorccn-boop)  
**Incident Report**: jorgefuenmayorccn@gmail.com  

---

## 📅 REVIEW SCHEDULE

| Review | Frequency | Owner | Next Due |
|--------|-----------|-------|----------|
| Credential Rotation | Quarterly | Lead Architect | 2026-11-30 |
| Dependency Audit | Monthly | Senior Dev | 2026-09-30 |
| Access Log Review | Weekly | QA | 2026-09-06 |
| Security Policy Update | Annually | Lead Architect | 2027-08-31 |

---

**This is a living document. Update whenever security decisions change.**

