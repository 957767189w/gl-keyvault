// ---------------------------------------------------------------------------
// gl-keyvault key storage
// Abstraction layer with in-memory (dev) and Vercel KV (prod) backends
// ---------------------------------------------------------------------------

import { encrypt, decrypt, type EncryptedPayload } from "./encryption";
import type { KeyRecord, KeyRegistration } from "./types";

const KEY_PREFIX = "glvault:key:";
const INDEX_KEY = "glvault:index";

// ---------------------------------------------------------------------------
// Storage interface
// ---------------------------------------------------------------------------

export interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// In-memory backend (development / testing)
// ---------------------------------------------------------------------------

export class MemoryStorage implements StorageBackend {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace("*", "");
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }

  /** Testing helper: reset all stored data */
  clear(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Vercel KV backend (production)
// ---------------------------------------------------------------------------

export class VercelKVStorage implements StorageBackend {
  private kv: typeof import("@vercel/kv").kv | null = null;

  private async getKV() {
    if (!this.kv) {
      const mod = await import("@vercel/kv");
      this.kv = mod.kv;
    }
    return this.kv;
  }

  async get(key: string): Promise<string | null> {
    const kv = await this.getKV();
    return kv.get<string>(key);
  }

  async set(key: string, value: string): Promise<void> {
    const kv = await this.getKV();
    await kv.set(key, value);
  }

  async del(key: string): Promise<void> {
    const kv = await this.getKV();
    await kv.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const kv = await this.getKV();
    return kv.keys(pattern);
  }
}

// ---------------------------------------------------------------------------
// Key store: high-level operations on encrypted key records
// ---------------------------------------------------------------------------

export class KeyStore {
  constructor(
    private storage: StorageBackend,
    private masterKey: string
  ) {}

  /**
   * Register a new API key. The raw key is encrypted before storage.
   * Throws if the alias already exists.
   */
  async register(reg: KeyRegistration): Promise<KeyRecord> {
    const existing = await this.storage.get(KEY_PREFIX + reg.alias);
    if (existing) {
      throw new Error(`Alias "${reg.alias}" already exists. Use rotate to update.`);
    }

    this.validateAlias(reg.alias);

    const encrypted = encrypt(reg.api_key, this.masterKey);
    const now = Date.now();

    const record: KeyRecord = {
      alias: reg.alias,
      encrypted_key: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.auth_tag,
      base_url: reg.base_url,
      quota_limit: reg.quota_limit ?? 1000,
      quota_used: 0,
      quota_window_start: now,
      created_at: now,
      rotated_at: null,
      owner: reg.owner ?? "admin",
    };

    await this.storage.set(KEY_PREFIX + reg.alias, JSON.stringify(record));
    await this.addToIndex(reg.alias);

    return record;
  }

  /**
   * Retrieve and decrypt the raw API key for a given alias.
   * Returns null if the alias does not exist.
   */
  async getKey(alias: string): Promise<string | null> {
    const raw = await this.storage.get(KEY_PREFIX + alias);
    if (!raw) return null;

    const record: KeyRecord = JSON.parse(raw);
    const payload: EncryptedPayload = {
      ciphertext: record.encrypted_key,
      iv: record.iv,
      auth_tag: record.auth_tag,
    };

    return decrypt(payload, this.masterKey);
  }

  /**
   * Get the key record metadata (without the decrypted key).
   */
  async getRecord(alias: string): Promise<KeyRecord | null> {
    const raw = await this.storage.get(KEY_PREFIX + alias);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  /**
   * Rotate an API key: re-encrypt with new value, preserve metadata.
   */
  async rotate(alias: string, newApiKey: string): Promise<KeyRecord> {
    const raw = await this.storage.get(KEY_PREFIX + alias);
    if (!raw) {
      throw new Error(`Alias "${alias}" not found`);
    }

    const record: KeyRecord = JSON.parse(raw);
    const encrypted = encrypt(newApiKey, this.masterKey);

    record.encrypted_key = encrypted.ciphertext;
    record.iv = encrypted.iv;
    record.auth_tag = encrypted.auth_tag;
    record.rotated_at = Date.now();

    await this.storage.set(KEY_PREFIX + alias, JSON.stringify(record));
    return record;
  }

  /**
   * Delete a key alias entirely.
   */
  async remove(alias: string): Promise<boolean> {
    const raw = await this.storage.get(KEY_PREFIX + alias);
    if (!raw) return false;

    await this.storage.del(KEY_PREFIX + alias);
    await this.removeFromIndex(alias);
    return true;
  }

  /**
   * List all registered key aliases with metadata (keys are NOT decrypted).
   */
  async list(): Promise<Omit<KeyRecord, "encrypted_key" | "iv" | "auth_tag">[]> {
    const indexRaw = await this.storage.get(INDEX_KEY);
    const aliases: string[] = indexRaw ? JSON.parse(indexRaw) : [];

    const records = [];
    for (const alias of aliases) {
      const record = await this.getRecord(alias);
      if (record) {
        const { encrypted_key, iv, auth_tag, ...safe } = record;
        records.push(safe);
      }
    }
    return records;
  }

  /**
   * Increment usage counter. Resets window if expired.
   */
  async incrementUsage(alias: string): Promise<{ allowed: boolean; remaining: number }> {
    const raw = await this.storage.get(KEY_PREFIX + alias);
    if (!raw) throw new Error(`Alias "${alias}" not found`);

    const record: KeyRecord = JSON.parse(raw);
    const now = Date.now();
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

    // Reset window if expired
    if (now - record.quota_window_start > windowMs) {
      record.quota_used = 0;
      record.quota_window_start = now;
    }

    if (record.quota_used >= record.quota_limit) {
      return { allowed: false, remaining: 0 };
    }

    record.quota_used += 1;
    await this.storage.set(KEY_PREFIX + alias, JSON.stringify(record));

    return {
      allowed: true,
      remaining: record.quota_limit - record.quota_used,
    };
  }

  // ---- internal helpers ----

  private validateAlias(alias: string): void {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(alias)) {
      throw new Error(
        "Alias must be 1-64 chars: letters, digits, hyphens, underscores"
      );
    }
  }

  private async addToIndex(alias: string): Promise<void> {
    const raw = await this.storage.get(INDEX_KEY);
    const index: string[] = raw ? JSON.parse(raw) : [];
    if (!index.includes(alias)) {
      index.push(alias);
      await this.storage.set(INDEX_KEY, JSON.stringify(index));
    }
  }

  private async removeFromIndex(alias: string): Promise<void> {
    const raw = await this.storage.get(INDEX_KEY);
    if (!raw) return;
    const index: string[] = JSON.parse(raw);
    const updated = index.filter((a) => a !== alias);
    await this.storage.set(INDEX_KEY, JSON.stringify(updated));
  }
}
