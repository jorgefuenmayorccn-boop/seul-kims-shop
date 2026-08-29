-- Create api_scope enum
CREATE TYPE api_scope AS ENUM (
  'orders:read',
  'orders:write',
  'products:read',
  'products:write',
  'customers:read',
  'customers:write',
  'inventory:read',
  'inventory:write',
  'reports:read',
  'admin:full'
);

-- Create api_keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scopes api_scope[] NOT NULL,
  rate_limit INTEGER,
  ip_whitelist TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

-- Create indices for api_keys
CREATE INDEX api_keys_user_idx ON api_keys(user_id);
CREATE INDEX api_keys_active_idx ON api_keys(is_active);
CREATE INDEX api_keys_expire_idx ON api_keys(expires_at);

-- Create api_key_logs table for audit trail
CREATE TABLE api_key_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  request_size INTEGER,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indices for api_key_logs
CREATE INDEX api_key_logs_key_idx ON api_key_logs(key_id);
CREATE INDEX api_key_logs_endpoint_idx ON api_key_logs(endpoint);
CREATE INDEX api_key_logs_created_idx ON api_key_logs(created_at);
