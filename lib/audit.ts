// ---------------------------------------------------------------------------
// gl-keyvault audit logging
// Append-only usage log for API key access tracking
// ---------------------------------------------------------------------------

import crypto from "crypto";
import type { StorageBackend } from "./storage";
import type { AuditEntry } from "./types";

const AUDIT_PREFIX = "glvault:audit:";
const AUDIT_INDEX = "glvault:audit_index:";

export class AuditLog {
  constructor(private storage: StorageBackend) {}

  /**
   * Record an API proxy request in the audit log.
   */
  async record(entry: Omit<AuditEntry, "id">): Promise<AuditEntry> {
    const id = this.generateId();
    const full: AuditEntry = { id, ...entry };

    const key = `${AUDIT_PREFIX}${entry.alias}:${id}`;
    await this.storage.set(key, JSON.stringify(full));

    // Maintain per-alias index for efficient querying
    await this.appendToIndex(entry.alias, id, entry.timestamp);

    return full;
  }

  /**
   * Retrieve audit entries for a given alias within a time range.
   */
  async query(
    alias: string,
    opts: { since?: number; until?: number; limit?: number } = {}
  ): Promise<AuditEntry[]> {
    const { since = 0, until = Date.now(), limit = 100 } = opts;

    const indexRaw = await this.storage.get(AUDIT_INDEX + alias);
    if (!indexRaw) return [];

    const index: Array<{ id: string; ts: number }> = JSON.parse(indexRaw);

    // Filter by time range, most recent first
    const filtered = index
      .filter((e) => e.ts >= since && e.ts <= until)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);

    const entries: AuditEntry[] = [];
    for (const { id } of filtered) {
      const raw = await this.storage.get(`${AUDIT_PREFIX}${alias}:${id}`);
      if (raw) {
        entries.push(JSON.parse(raw));
      }
    }

    return entries;
  }

  /**
   * Get aggregate stats for an alias.
   */
  async stats(
    alias: string,
    since?: number
  ): Promise<{
    total_requests: number;
    error_count: number;
    avg_latency_ms: number;
    last_accessed: number | null;
  }> {
    const entries = await this.query(alias, {
      since: since ?? Date.now() - 24 * 60 * 60 * 1000,
      limit: 10000,
    });

    if (entries.length === 0) {
      return {
        total_requests: 0,
        error_count: 0,
        avg_latency_ms: 0,
        last_accessed: null,
      };
    }

    const errors = entries.filter((e) => e.status >= 400).length;
    const totalLatency = entries.reduce((sum, e) => sum + e.latency_ms, 0);

    return {
      total_requests: entries.length,
      error_count: errors,
      avg_latency_ms: Math.round(totalLatency / entries.length),
      last_accessed: entries[0].timestamp,
    };
  }

  // ---- internal ----

  private generateId(): string {
    return crypto.randomBytes(8).toString("hex");
  }

  private async appendToIndex(
    alias: string,
    id: string,
    ts: number
  ): Promise<void> {
    const key = AUDIT_INDEX + alias;
    const raw = await this.storage.get(key);
    const index: Array<{ id: string; ts: number }> = raw
      ? JSON.parse(raw)
      : [];

    index.push({ id, ts });

    // Keep only last 10k entries per alias to bound storage
    const trimmed = index.slice(-10000);
    await this.storage.set(key, JSON.stringify(trimmed));
  }
}
