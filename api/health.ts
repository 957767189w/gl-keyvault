// ---------------------------------------------------------------------------
// GET /api/health
//
// Service health check. Returns storage connectivity status, version,
// and number of registered keys.
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { KeyStore, MemoryStorage, VercelKVStorage } from "../lib/storage";
import { isKVAvailable } from "../lib/config";
import type { HealthStatus } from "../lib/types";

const START_TIME = Date.now();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let storageStatus: "connected" | "disconnected" = "disconnected";
  let keysRegistered = 0;

  try {
    const storage = isKVAvailable() ? new VercelKVStorage() : new MemoryStorage();

    // Probe storage with a lightweight operation
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
    if (masterKey) {
      const keyStore = new KeyStore(storage, masterKey);
      const keys = await keyStore.list();
      keysRegistered = keys.length;
      storageStatus = "connected";
    }
  } catch {
    storageStatus = "disconnected";
  }

  const health: HealthStatus = {
    status: storageStatus === "connected" ? "ok" : "degraded",
    version: "0.1.0",
    uptime_ms: Date.now() - START_TIME,
    storage: storageStatus,
    keys_registered: keysRegistered,
  };

  const statusCode = health.status === "ok" ? 200 : 503;
  return res.status(statusCode).json(health);
}
