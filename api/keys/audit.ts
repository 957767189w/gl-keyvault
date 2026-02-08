// ---------------------------------------------------------------------------
// GET /api/keys/audit?alias=xxx&since=timestamp&limit=50
//
// Query audit log entries for a specific key alias.
// Returns usage history with request details and latency stats.
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken } from "../../lib/auth";
import { MemoryStorage, VercelKVStorage } from "../../lib/storage";
import { AuditLog } from "../../lib/audit";
import { loadConfig, isKVAvailable } from "../../lib/config";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const config = loadConfig();

  const authError = verifyAdminToken(req.headers.authorization, config.admin_token);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  const alias = req.query.alias as string;
  if (!alias) {
    return res.status(400).json({ error: "Missing required query parameter: alias" });
  }

  const since = req.query.since ? Number(req.query.since) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;

  const storage = isKVAvailable() ? new VercelKVStorage() : new MemoryStorage();
  const auditLog = new AuditLog(storage);

  try {
    const [entries, stats] = await Promise.all([
      auditLog.query(alias, { since, limit }),
      auditLog.stats(alias, since),
    ]);

    return res.status(200).json({
      alias,
      stats,
      entries: entries.map((e) => ({
        id: e.id,
        path: e.path,
        method: e.method,
        status: e.status,
        latency_ms: e.latency_ms,
        caller: e.caller,
        timestamp: new Date(e.timestamp).toISOString(),
        error: e.error || null,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to query audit log",
    });
  }
}
