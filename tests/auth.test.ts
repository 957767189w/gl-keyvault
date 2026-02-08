import {
  computeSignature,
  verifyRequest,
  verifyAdminToken,
  generateNonce,
} from "../lib/auth";
import type { ProxyRequest } from "../lib/types";

describe("auth", () => {
  const secret = "test-hmac-secret-for-unit-tests";

  function makeRequest(overrides?: Partial<ProxyRequest>): ProxyRequest {
    return {
      alias: "openweather",
      path: "/data/2.5/weather?q=Tokyo",
      method: "GET",
      timestamp: Date.now(),
      nonce: generateNonce(),
      ...overrides,
    };
  }

  describe("computeSignature", () => {
    it("should produce deterministic signatures", () => {
      const req = makeRequest({ timestamp: 1700000000000, nonce: "fixed" });
      const a = computeSignature(req, secret);
      const b = computeSignature(req, secret);
      expect(a).toBe(b);
    });

    it("should produce different signatures for different requests", () => {
      const reqA = makeRequest({ alias: "openweather", nonce: "aaa" });
      const reqB = makeRequest({ alias: "newsapi", nonce: "bbb" });
      expect(computeSignature(reqA, secret)).not.toBe(computeSignature(reqB, secret));
    });

    it("should produce 64-char hex strings (SHA-256)", () => {
      const sig = computeSignature(makeRequest(), secret);
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("verifyRequest", () => {
    it("should accept valid signatures", () => {
      const req = makeRequest();
      const sig = computeSignature(req, secret);
      const err = verifyRequest(req, sig, secret, 30_000);
      expect(err).toBeNull();
    });

    it("should reject expired requests", () => {
      const req = makeRequest({ timestamp: Date.now() - 60_000 });
      const sig = computeSignature(req, secret);
      const err = verifyRequest(req, sig, secret, 30_000);
      expect(err).toMatch(/expired/);
    });

    it("should reject invalid signatures", () => {
      const req = makeRequest();
      const err = verifyRequest(req, "0".repeat(64), secret, 30_000);
      expect(err).toMatch(/Invalid signature/);
    });

    it("should reject wrong-length signatures", () => {
      const req = makeRequest();
      const err = verifyRequest(req, "short", secret, 30_000);
      expect(err).toMatch(/Invalid signature/);
    });

    it("should reject missing fields", () => {
      const req = makeRequest({ alias: "" });
      const sig = computeSignature(req, secret);
      const err = verifyRequest(req, sig, secret, 30_000);
      expect(err).toMatch(/Missing required/);
    });

    it("should reject invalid methods", () => {
      const req = makeRequest({ method: "PATCH" as any });
      const sig = computeSignature(req, secret);
      const err = verifyRequest(req, sig, secret, 30_000);
      expect(err).toMatch(/Invalid method/);
    });
  });

  describe("verifyAdminToken", () => {
    const token = "admin-secret-token-123";

    it("should accept valid tokens", () => {
      const err = verifyAdminToken(`Bearer ${token}`, token);
      expect(err).toBeNull();
    });

    it("should reject missing header", () => {
      expect(verifyAdminToken(null, token)).toMatch(/Missing/);
      expect(verifyAdminToken(undefined, token)).toMatch(/Missing/);
    });

    it("should reject wrong format", () => {
      expect(verifyAdminToken(token, token)).toMatch(/Invalid Authorization/);
      expect(verifyAdminToken("Basic xxx", token)).toMatch(/Invalid Authorization/);
    });

    it("should reject wrong tokens", () => {
      expect(verifyAdminToken("Bearer wrong-token", token)).toMatch(/Invalid admin/);
    });
  });

  describe("generateNonce", () => {
    it("should produce 32-char hex strings", () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    it("should produce unique nonces", () => {
      const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
      expect(nonces.size).toBe(100);
    });
  });
});
