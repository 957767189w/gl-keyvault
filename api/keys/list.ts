// ---------------------------------------------------------------------------
// GET /api/keys/list
//
// List all registered key aliases with metadata (never returns raw keys).
// Requires admin authentication.
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken } from "../../lib/auth";
import { KeyStore, MemoryStorage, VercelKVStorage } from "../../lib/storage";
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

  const storage = isKVAvailable() ? new VercelKVStorage() : new MemoryStorage();
  const keyStore = new KeyStore(storage, config.master_key);

  try {
    const keys = await keyStore.list();

    return res.status(200).json({
      count: keys.length,
      keys: keys.map((k) => ({
        alias: k.alias,
        base_url: k.base_url,
        quota_limit: k.quota_limit,
        quota_used: k.quota_used,
        quota_remaining: k.quota_limit - k.quota_used,
        created_at: new Date(k.created_at).toISOString(),
        rotated_at: k.rotated_at ? new Date(k.rotated_at).toISOString() : null,
        owner: k.owner,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to list keys",
    });
  }
}
