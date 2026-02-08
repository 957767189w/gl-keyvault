// ---------------------------------------------------------------------------
// gl-keyvault configuration
// Loads and validates environment variables
// ---------------------------------------------------------------------------

import type { VaultConfig } from "./types";

/**
 * Load configuration from environment variables.
 * Throws descriptive errors for missing required values.
 */
export function loadConfig(): VaultConfig {
  const masterKey = requireEnv("MASTER_ENCRYPTION_KEY");
  const hmacSecret = requireEnv("HMAC_SECRET");
  const adminToken = requireEnv("ADMIN_TOKEN");

  if (masterKey.length !== 64) {
    throw new Error(
      `MASTER_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Got ${masterKey.length} chars. ` +
      `Generate one with: npm run generate-key`
    );
  }

  return {
    master_key: masterKey,
    hmac_secret: hmacSecret,
    admin_token: adminToken,
    rate_limit_window_ms: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max_request_age_ms: Number(process.env.MAX_REQUEST_AGE_MS) || 30_000,
    log_level: (process.env.LOG_LEVEL as VaultConfig["log_level"]) || "info",
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `See .env.example for configuration reference.`
    );
  }
  return value;
}

/**
 * Detect whether Vercel KV is available (production) or not (dev).
 */
export function isKVAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}
