// ---------------------------------------------------------------------------
// POST /api/keys/register
//
// Register a new API key alias. Requires admin authentication.
// The raw API key is encrypted before storage.
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken } from "../../lib/auth";
import { KeyStore, MemoryStorage, VercelKVStorage } from "../../lib/storage";
import { loadConfig, isKVAvailable } from "../../lib/config";
import type { KeyRegistration } from "../../lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const config = loadConfig();

  // Admin auth check
  const authError = verifyAdminToken(req.headers.authorization, config.admin_token);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  // Validate request body
  const { alias, api_key, base_url, quota_limit, owner } = req.body || {};

  if (!alias || typeof alias !== "string") {
    return res.status(400).json({ error: "Missing required field: alias" });
  }
  if (!api_key || typeof api_key !== "string") {
    return res.status(400).json({ error: "Missing required field: api_key" });
  }
  if (!base_url || typeof base_url !== "string") {
    return res.status(400).json({ error: "Missing required field: base_url" });
  }

  // Validate base_url is a valid URL
  try {
    new URL(base_url);
  } catch {
    return res.status(400).json({ error: "Invalid base_url: must be a valid URL" });
  }

  const storage = isKVAvailable() ? new VercelKVStorage() : new MemoryStorage();
  const keyStore = new KeyStore(storage, config.master_key);

  try {
    const registration: KeyRegistration = {
      alias,
      api_key,
      base_url,
      quota_limit: quota_limit ? Number(quota_limit) : 1000,
      owner: owner || "admin",
    };

    const record = await keyStore.register(registration);

    // Return metadata only - never echo back the raw key
    return res.status(201).json({
      alias: record.alias,
      base_url: record.base_url,
      quota_limit: record.quota_limit,
      created_at: record.created_at,
      owner: record.owner,
      message: `Key alias "${alias}" registered successfully`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    const status = message.includes("already exists") ? 409 : 400;
    return res.status(status).json({ error: message });
  }
}
