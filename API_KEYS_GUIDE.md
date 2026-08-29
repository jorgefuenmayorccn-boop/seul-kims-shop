# SEUL API Keys Guide

## Overview

API keys allow programmatic access to SEUL Admin API. Use them for:
- **Third-party integrations** (accounting software, POS systems, etc)
- **Mobile apps** that need API access
- **Webhooks** and automated workflows
- **Partner integrations**

## Key Features

✅ **Scope-based access** — Limit what each key can do
✅ **Rate limiting** — Control requests per minute
✅ **IP whitelisting** — Restrict by IP address
✅ **Expiration dates** — Keys can auto-expire
✅ **Audit logging** — Track every API call
✅ **Easy revocation** — Instantly disable a key

## Creating an API Key

### Via Dashboard (Coming Soon)
1. Go to **Admin Dashboard** → **Settings** → **API Keys**
2. Click **Create New Key**
3. Enter a name (e.g., "POS System", "Accounting Integration")
4. Select scopes (what the key can do)
5. Optionally set rate limit, IP whitelist, or expiration
6. **⚠️ IMPORTANT:** Copy the key immediately — it won't be shown again!

### Via API

```bash
# Create API key
curl -X POST https://api.seoulshop.cl/api/admin/api-keys \
  -H "Authorization: Bearer seul_live_existing_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "POS System",
    "scopes": ["orders:read", "orders:write", "inventory:read"],
    "rateLimit": 100,
    "ipWhitelist": ["203.0.113.45"],
    "expiresAt": "2026-12-31T23:59:59Z"
  }'

# Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "seul_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "name": "POS System",
  "scopes": ["orders:read", "orders:write", "inventory:read"],
  "createdAt": "2026-08-29T15:00:00Z"
}
```

## Using an API Key

Include the key in the **Authorization** header as a Bearer token:

```bash
curl -H "Authorization: Bearer seul_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  https://api.seoulshop.cl/api/admin/api-keys
```

## Key Format

- **Live keys:** `seul_live_` + 64 hex characters (56 chars total)
- **Test keys:** `seul_test_` + 64 hex characters (56 chars total)

Example: `seul_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## Available Scopes

### Order Management
- `orders:read` — Read orders
- `orders:write` — Create/update orders

### Product Catalog
- `products:read` — Read product data
- `products:write` — Create/update products

### Customer Data
- `customers:read` — Read customer profiles
- `customers:write` — Create/update customers

### Inventory
- `inventory:read` — Read stock levels
- `inventory:write` — Update inventory

### Reports
- `reports:read` — Access analytics/reports

### Full Access
- `admin:full` — Complete API access (⚠️ use sparingly)

## Security Best Practices

### ✅ DO
- Store keys in environment variables, never in code
- Use separate keys for each integration
- Set rate limits appropriate for your use case
- Whitelist IPs if calling from fixed location
- Set expiration dates (rotate keys periodically)
- Monitor key usage in the audit logs
- Revoke keys immediately if compromised

### ❌ DON'T
- Hardcode keys in source code or config files
- Share keys via email or chat
- Use one key for multiple integrations
- Store keys in plain text files
- Commit keys to version control
- Use `admin:full` unless absolutely necessary
- Keep very old keys active (rotate regularly)

## Revoking a Key

Once revoked, a key is **permanently disabled** and cannot be re-activated.

```bash
curl -X POST https://api.seoulshop.cl/api/admin/api-keys/:id/revoke \
  -H "Authorization: Bearer seul_live_existing_key"

# Response:
{
  "success": true,
  "message": "API key revoked"
}
```

## Rate Limiting

Each key can have a rate limit (requests per minute):

- `null` = unlimited
- `10` = 10 requests/minute
- `100` = 100 requests/minute
- `1000` = 1000 requests/minute

If you exceed the limit, you'll get a **429 Too Many Requests** response.

## IP Whitelisting

Restrict access to specific IP addresses:

```bash
curl -X POST https://api.seoulshop.cl/api/admin/api-keys \
  -H "Authorization: Bearer seul_live_existing_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Accounting System",
    "scopes": ["orders:read", "reports:read"],
    "ipWhitelist": ["203.0.113.45", "198.51.100.123"]
  }'
```

Leave `ipWhitelist` empty or omit it to allow all IPs.

## Expiration Dates

Set a key to automatically expire on a specific date:

```bash
curl -X POST https://api.seoulshop.cl/api/admin/api-keys \
  -H "Authorization: Bearer seul_live_existing_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Temporary Integration",
    "scopes": ["orders:read"],
    "expiresAt": "2026-09-30T23:59:59Z"
  }'
```

After the expiration date, the key will automatically stop working.

## Monitoring & Audit Logs

All API key usage is logged for security and debugging:

- Every request is tracked (method, endpoint, status, IP, user agent)
- Last used timestamp is updated on each request
- Failed requests log error messages
- Revoked keys are marked with a `revokedAt` timestamp

View usage logs in the Admin Dashboard → **API Keys** → **Activity Log** (Coming Soon)

## Troubleshooting

### "Invalid or expired API key"
- ✅ Check the key format (should start with `seul_live_` or `seul_test_`)
- ✅ Verify the key hasn't been revoked
- ✅ Check if the key has expired
- ✅ Ensure you're not using a partial key

### "Unauthorized" (401)
- ✅ Did you include the `Authorization: Bearer` header?
- ✅ Is the Bearer token correct?
- ✅ Does the key have permission for this endpoint (check scopes)?

### "Too Many Requests" (429)
- ✅ You've exceeded the rate limit for this key
- ✅ Either wait or request a higher rate limit
- ✅ Consider increasing `rateLimit` when creating the key

### "IP not whitelisted"
- ✅ If the key has `ipWhitelist` set, requests only work from those IPs
- ✅ Add your IP to the whitelist
- ✅ Remove `ipWhitelist` to allow all IPs

## Examples

### Create Order (B2C)
```bash
curl -X POST https://api.seoulshop.cl/api/orders \
  -H "Authorization: Bearer seul_live_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "client@example.com",
    "customer_name": "John Doe",
    "items": [
      { "product_id": "123", "quantity": 2 }
    ],
    "total": 29990,
    "delivery_mode": "delivery"
  }'
```

### List API Keys
```bash
curl https://api.seoulshop.cl/api/admin/api-keys \
  -H "Authorization: Bearer seul_live_xxxxx"

# Response:
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "POS System",
    "scopes": ["orders:read", "orders:write"],
    "isActive": true,
    "lastUsedAt": "2026-08-29T12:30:00Z",
    "expiresAt": "2026-12-31T23:59:59Z",
    "createdAt": "2026-08-25T10:00:00Z"
  }
]
```

---

**Last Updated:** Aug 29, 2026  
**SEUL v1.0 API Keys Guide**
