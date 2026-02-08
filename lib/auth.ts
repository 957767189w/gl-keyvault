// ---------------------------------------------------------------------------
// gl-keyvault request authentication
// HMAC-SHA256 signatures with timestamp + nonce replay protection
// ---------------------------------------------------------------------------

import crypto from "crypto";
import type { ProxyRequest } from "./types";

/**
 * Compute HMAC-SHA256 signature for a proxy request.
 *
 * The signed payload is constructed deterministically:
 *   `${alias}:${method}:${path}:${timestamp}:${nonce}`
 *
 * This ensures that:
 * - Only the holder of the HMAC secret can generate valid signatures
 * - Each request is bound to a specific alias, path, method, and time
 * - The nonce prevents replay of the exact same request
 */
export function computeSignature(req: ProxyRequest, secret: string): string {
  const payload = [
    req.alias,
    req.method,
    req.path,
    req.timestamp.toString(),
    req.nonce,
  ].join(":");

  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Verify a request signature and check for staleness.
 *
 * Returns an error string if verification fails, null if valid.
 */
export function verifyRequest(
  req: ProxyRequest,
  signature: string,
  secret: string,
  maxAgeMs: number
): string | null {
  // Check timestamp freshness
  const now = Date.now();
  const age = Math.abs(now - req.timestamp);

  if (age > maxAgeMs) {
    return `Request expired: age ${age}ms exceeds max ${maxAgeMs}ms`;
  }

  // Validate required fields
  if (!req.alias || !req.path || !req.method || !req.nonce) {
    return "Missing required fields: alias, path, method, nonce";
  }

  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method)) {
    return `Invalid method: ${req.method}`;
  }

  // Compute expected signature
  const expected = computeSignature(req, secret);

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");

  if (sigBuf.length !== expectedBuf.length) {
    return "Invalid signature";
  }

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return "Invalid signature";
  }

  return null;
}

/**
 * Verify admin bearer token for key management endpoints.
 */
export function verifyAdminToken(
  authHeader: string | null | undefined,
  adminToken: string
): string | null {
  if (!authHeader) {
    return "Missing Authorization header";
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return "Invalid Authorization format. Expected: Bearer <token>";
  }

  const token = parts[1];
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(adminToken);

  if (tokenBuf.length !== expectedBuf.length) {
    return "Invalid admin token";
  }

  if (!crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return "Invalid admin token";
  }

  return null;
}

/**
 * Generate a random nonce for request signing.
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}
