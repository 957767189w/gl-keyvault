// ---------------------------------------------------------------------------
// POST /api/keys/rotate
//
// Rotate an existing API key. The old key is replaced with the new one.
// Zero-downtime: the alias continues to work throughout.
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken } from "../../lib/auth";
import { KeyStore, MemoryStorage, VercelKVStorage } from "../../lib/storage";
import { loadConfig, isKVAvailable } from "../../lib/config";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const config = loadConfig();

  const authError = verifyAdminToken(req.headers.authorization, config.admin_token);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  const { alias, new_api_key } = req.body || {};

  if (!alias || typeof alias !== "string") {
    return res.status(400).json({ error: "Missing required field: alias" });
  }
  if (!new_api_key || typeof new_api_key !== "string") {
    return res.status(400).json({ error: "Missing required field: new_api_key" });
  }

  const storage = isKVAvailable() ? new VercelKVStorage() : new MemoryStorage();
  const keyStore = new KeyStore(storage, config.master_key);

  try {
    const record = await keyStore.rotate(alias, new_api_key);

    return res.status(200).json({
      alias: record.alias,
      rotated_at: new Date(record.rotated_at!).toISOString(),
      message: `Key "${alias}" rotated successfully`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rotation failed";
    const status = message.includes("not found") ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}
