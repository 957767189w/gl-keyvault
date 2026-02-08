// ---------------------------------------------------------------------------
// gl-keyvault library exports
// ---------------------------------------------------------------------------

export { encrypt, decrypt, generateKey, deriveSubKey } from "./encryption";
export { computeSignature, verifyRequest, verifyAdminToken, generateNonce } from "./auth";
export { KeyStore, MemoryStorage, VercelKVStorage } from "./storage";
export type { StorageBackend } from "./storage";
export { AuditLog } from "./audit";
export { loadConfig, isKVAvailable } from "./config";
export type {
  KeyRecord,
  ProxyRequest,
  ProxyResponse,
  AuditEntry,
  KeyRegistration,
  KeyRotation,
  RateLimitResult,
  HealthStatus,
  VaultConfig,
} from "./types";
