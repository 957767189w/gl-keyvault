import { KeyStore, MemoryStorage } from "../lib/storage";
import { generateKey } from "../lib/encryption";

describe("KeyStore", () => {
  let store: KeyStore;
  let storage: MemoryStorage;
  const masterKey = generateKey();

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new KeyStore(storage, masterKey);
  });

  describe("register", () => {
    it("should register a new key alias", async () => {
      const record = await store.register({
        alias: "openweather",
        api_key: "sk-test-123",
        base_url: "https://api.openweathermap.org",
        quota_limit: 500,
      });

      expect(record.alias).toBe("openweather");
      expect(record.base_url).toBe("https://api.openweathermap.org");
      expect(record.quota_limit).toBe(500);
      expect(record.quota_used).toBe(0);
      expect(record.created_at).toBeGreaterThan(0);
      expect(record.rotated_at).toBeNull();
    });

    it("should encrypt the API key (not stored in plaintext)", async () => {
      await store.register({
        alias: "test",
        api_key: "my-secret-key",
        base_url: "https://example.com",
      });

      // Read raw storage - key should NOT appear in plaintext
      const raw = await storage.get("glvault:key:test");
      expect(raw).not.toContain("my-secret-key");
      expect(raw).toContain("encrypted_key");
    });

    it("should reject duplicate aliases", async () => {
      await store.register({
        alias: "dup",
        api_key: "key1",
        base_url: "https://example.com",
      });

      await expect(
        store.register({
          alias: "dup",
          api_key: "key2",
          base_url: "https://example.com",
        })
      ).rejects.toThrow(/already exists/);
    });

    it("should validate alias format", async () => {
      await expect(
        store.register({
          alias: "invalid alias!",
          api_key: "key",
          base_url: "https://example.com",
        })
      ).rejects.toThrow(/1-64 chars/);
    });
  });

  describe("getKey", () => {
    it("should decrypt and return the raw API key", async () => {
      await store.register({
        alias: "mykey",
        api_key: "sk-super-secret-99",
        base_url: "https://example.com",
      });

      const key = await store.getKey("mykey");
      expect(key).toBe("sk-super-secret-99");
    });

    it("should return null for non-existent aliases", async () => {
      const key = await store.getKey("nonexistent");
      expect(key).toBeNull();
    });
  });

  describe("rotate", () => {
    it("should replace the API key while preserving metadata", async () => {
      await store.register({
        alias: "rotatable",
        api_key: "old-key",
        base_url: "https://example.com",
        quota_limit: 999,
      });

      const record = await store.rotate("rotatable", "new-key");
      expect(record.rotated_at).toBeGreaterThan(0);
      expect(record.quota_limit).toBe(999); // preserved

      const key = await store.getKey("rotatable");
      expect(key).toBe("new-key");
    });

    it("should reject rotation of non-existent aliases", async () => {
      await expect(store.rotate("ghost", "key")).rejects.toThrow(/not found/);
    });
  });

  describe("remove", () => {
    it("should delete a key alias", async () => {
      await store.register({
        alias: "deleteme",
        api_key: "key",
        base_url: "https://example.com",
      });

      const removed = await store.remove("deleteme");
      expect(removed).toBe(true);

      const key = await store.getKey("deleteme");
      expect(key).toBeNull();
    });

    it("should return false for non-existent aliases", async () => {
      const removed = await store.remove("ghost");
      expect(removed).toBe(false);
    });
  });

  describe("list", () => {
    it("should list all aliases without exposing keys", async () => {
      await store.register({ alias: "a", api_key: "key-a", base_url: "https://a.com" });
      await store.register({ alias: "b", api_key: "key-b", base_url: "https://b.com" });
      await store.register({ alias: "c", api_key: "key-c", base_url: "https://c.com" });

      const list = await store.list();
      expect(list).toHaveLength(3);
      expect(list.map((k) => k.alias).sort()).toEqual(["a", "b", "c"]);

      // Ensure no encrypted fields leak
      for (const item of list) {
        expect(item).not.toHaveProperty("encrypted_key");
        expect(item).not.toHaveProperty("iv");
        expect(item).not.toHaveProperty("auth_tag");
      }
    });

    it("should return empty array when no keys registered", async () => {
      const list = await store.list();
      expect(list).toEqual([]);
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage counter", async () => {
      await store.register({
        alias: "limited",
        api_key: "key",
        base_url: "https://example.com",
        quota_limit: 5,
      });

      const r1 = await store.incrementUsage("limited");
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(4);

      const r2 = await store.incrementUsage("limited");
      expect(r2.remaining).toBe(3);
    });

    it("should reject requests over quota", async () => {
      await store.register({
        alias: "tiny",
        api_key: "key",
        base_url: "https://example.com",
        quota_limit: 2,
      });

      await store.incrementUsage("tiny"); // 1/2
      await store.incrementUsage("tiny"); // 2/2

      const r = await store.incrementUsage("tiny"); // over
      expect(r.allowed).toBe(false);
      expect(r.remaining).toBe(0);
    });

    it("should throw for non-existent aliases", async () => {
      await expect(store.incrementUsage("ghost")).rejects.toThrow(/not found/);
    });
  });
});
