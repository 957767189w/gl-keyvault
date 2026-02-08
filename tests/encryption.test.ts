import { encrypt, decrypt, generateKey, deriveSubKey } from "../lib/encryption";

describe("encryption", () => {
  const masterKey = generateKey();

  describe("encrypt / decrypt round-trip", () => {
    it("should encrypt and decrypt a string correctly", () => {
      const plaintext = "sk-test-api-key-12345";
      const encrypted = encrypt(plaintext, masterKey);
      const decrypted = decrypt(encrypted, masterKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertexts for the same plaintext (random IV)", () => {
      const plaintext = "same-key";
      const a = encrypt(plaintext, masterKey);
      const b = encrypt(plaintext, masterKey);

      expect(a.ciphertext).not.toBe(b.ciphertext);
      expect(a.iv).not.toBe(b.iv);

      // Both should decrypt to the same value
      expect(decrypt(a, masterKey)).toBe(plaintext);
      expect(decrypt(b, masterKey)).toBe(plaintext);
    });

    it("should handle empty string", () => {
      const encrypted = encrypt("", masterKey);
      expect(decrypt(encrypted, masterKey)).toBe("");
    });

    it("should handle long API keys", () => {
      const longKey = "x".repeat(1024);
      const encrypted = encrypt(longKey, masterKey);
      expect(decrypt(encrypted, masterKey)).toBe(longKey);
    });

    it("should handle unicode content", () => {
      const key = "api-key-with-special-chars-!@#$%";
      const encrypted = encrypt(key, masterKey);
      expect(decrypt(encrypted, masterKey)).toBe(key);
    });
  });

  describe("tamper detection", () => {
    it("should reject tampered ciphertext", () => {
      const encrypted = encrypt("secret", masterKey);
      encrypted.ciphertext = "ff" + encrypted.ciphertext.slice(2);

      expect(() => decrypt(encrypted, masterKey)).toThrow();
    });

    it("should reject tampered auth tag", () => {
      const encrypted = encrypt("secret", masterKey);
      encrypted.auth_tag = "00".repeat(16);

      expect(() => decrypt(encrypted, masterKey)).toThrow();
    });

    it("should reject wrong master key", () => {
      const encrypted = encrypt("secret", masterKey);
      const wrongKey = generateKey();

      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });
  });

  describe("key validation", () => {
    it("should reject short master keys", () => {
      expect(() => encrypt("test", "abcd")).toThrow(/must be 32 bytes/);
    });

    it("should reject empty master keys", () => {
      expect(() => encrypt("test", "")).toThrow(/must be 32 bytes/);
    });
  });

  describe("generateKey", () => {
    it("should produce 64-char hex strings", () => {
      const key = generateKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should produce unique keys", () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateKey()));
      expect(keys.size).toBe(100);
    });
  });

  describe("deriveSubKey", () => {
    it("should produce deterministic output for same inputs", () => {
      const a = deriveSubKey(masterKey, "openweather");
      const b = deriveSubKey(masterKey, "openweather");
      expect(a).toBe(b);
    });

    it("should produce different output for different contexts", () => {
      const a = deriveSubKey(masterKey, "openweather");
      const b = deriveSubKey(masterKey, "newsapi");
      expect(a).not.toBe(b);
    });
  });
});
