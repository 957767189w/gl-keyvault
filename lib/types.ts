// ---------------------------------------------------------------------------
// gl-keyvault type definitions
// ---------------------------------------------------------------------------

export interface KeyRecord {
  alias: string;
  encrypted_key: string;       // AES-256-GCM encrypted API key
  iv: string;                  // initialization vector (hex)
  auth_tag: string;            // GCM authentication tag (hex)
  base_url: string;            // API base URL
  quota_limit: number;         // max requests per window
  quota_used: number;          // current usage count
  quota_window_start: number;  // window start timestamp (ms)
  created_at: number;
  rotated_at: number | null;
  owner: string;               // contract address or admin identifier
}

export interface ProxyRequest {
  alias: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timestamp: number;
  nonce: string;
}

export interface ProxyResponse {
  status: number;
  data: unknown;
  cached: boolean;
  latency_ms: number;
}

export interface AuditEntry {
  id: string;
  alias: string;
  caller: string;              // contract address or IP
  path: string;
  method: string;
  status: number;
  latency_ms: number;
  timestamp: number;
  error?: string;
}

export interface KeyRegistration {
  alias: string;
  api_key: string;
  base_url: string;
  quota_limit?: number;
  owner?: string;
}

export interface KeyRotation {
  alias: string;
  new_api_key: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset_at: number;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime_ms: number;
  storage: "connected" | "disconnected";
  keys_registered: number;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface VaultConfig {
  master_key: string;
  hmac_secret: string;
  admin_token: string;
  rate_limit_window_ms: number;
  max_request_age_ms: number;
  log_level: LogLevel;
}
