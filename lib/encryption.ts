// ---------------------------------------------------------------------------
// gl-keyvault encryption module
// AES-256-GCM authenticated encryption for API key storage
// ---------------------------------------------------------------------------

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export interface EncryptedPayload {
  ciphertext: string;  // hex
  iv: string;          // hex
  auth_tag: string;    // hex
}

/**
 * Validate that the master key is exactly 32 bytes (64 hex chars).
 */
function validateMasterKey(key: string): Buffer {
  const buf = Buffer.from(key, "hex");
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `Master key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${buf.length}`
    );
  }
  return buf;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Returns the ciphertext, IV, and authentication tag as hex strings.
 * The IV is randomly generated per encryption call, ensuring unique
 * ciphertext even for identical plaintexts.
 */
export function encrypt(plaintext: string, masterKey: string): EncryptedPayload {
  const key = validateMasterKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString("hex"),
    auth_tag: authTag.toString("hex"),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 *
 * Verifies the authentication tag before returning plaintext.
 * Throws on tampered ciphertext or wrong key.
 */
export function decrypt(payload: EncryptedPayload, masterKey: string): string {
  const key = validateMasterKey(masterKey);
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.auth_tag, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a cryptographically secure random key (hex-encoded).
 */
export function generateKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

/**
 * Derive a deterministic sub-key from master key + context string.
 * Used for per-alias encryption isolation.
 */
export function deriveSubKey(masterKey: string, context: string): string {
  const key = validateMasterKey(masterKey);
  return crypto
    .createHmac("sha256", key)
    .update(context)
    .digest("hex");
}
