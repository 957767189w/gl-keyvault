// ---------------------------------------------------------------------------
// POST /api/proxy
//
// Main proxy endpoint. Receives a signed request from an Intelligent Contract,
// resolves the API key alias, injects the real key, forwards to the target API,
// strips sensitive data from the response, and returns clean data.
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyRequest } from "../lib/auth";
import { KeyStore, MemoryStorage, VercelKVStorage } from "../lib/storage";
import { AuditLog } from "../lib/audit";
import { loadConfig, isKVAvailable } from "../lib/config";
import type { ProxyRequest } from "../lib/types";

// Module-level singletons (reused across warm invocations)
let keyStore: KeyStore | null = null;
let auditLog: AuditLog | null = null;

function getInstances() {
  if (!keyStore) {
    const config = loadConfig();
    const storage = isKVAvailable() ? new VercelKVStorage() : new MemoryStorage();
    keyStore = new KeyStore(storage, config.master_key);
    auditLog = new AuditLog(storage);
  }
  return { keyStore: keyStore!, auditLog: auditLog! };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const start = Date.now();
  const config = loadConfig();
  const { keyStore, auditLog } = getInstances();

  let proxyReq: ProxyRequest;

  try {
    proxyReq = req.body as ProxyRequest;
  } catch {
    return res.status(400).json({ error: "Invalid request body" });
  }

  // --- 1. Verify HMAC signature ---
  const signature = extractSignature(req);
  if (!signature) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const authError = verifyRequest(proxyReq, signature, config.hmac_secret, config.max_request_age_ms);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  // --- 2. Check rate limit ---
  let usageResult;
  try {
    usageResult = await keyStore.incrementUsage(proxyReq.alias);
  } catch (err) {
    return res.status(404).json({ error: `Unknown alias: ${proxyReq.alias}` });
  }

  if (!usageResult.allowed) {
    await auditLog.record({
      alias: proxyReq.alias,
      caller: extractCaller(req),
      path: proxyReq.path,
      method: proxyReq.method,
      status: 429,
      latency_ms: Date.now() - start,
      timestamp: Date.now(),
      error: "Rate limit exceeded",
    });

    return res.status(429).json({
      error: "Rate limit exceeded",
      remaining: 0,
      retry_after_ms: config.rate_limit_window_ms,
    });
  }

  // --- 3. Decrypt API key ---
  const apiKey = await keyStore.getKey(proxyReq.alias);
  if (!apiKey) {
    return res.status(404).json({ error: `Alias "${proxyReq.alias}" not found` });
  }

  // --- 4. Resolve target URL and inject key ---
  const record = await keyStore.getRecord(proxyReq.alias);
  if (!record) {
    return res.status(404).json({ error: `Record for "${proxyReq.alias}" not found` });
  }

  const targetUrl = buildTargetUrl(record.base_url, proxyReq.path, apiKey);

  // --- 5. Forward request to external API ---
  let externalResponse;
  let externalStatus = 500;
  let responseData: unknown;

  try {
    const fetchOpts: RequestInit = {
      method: proxyReq.method,
      headers: {
        "User-Agent": "gl-keyvault/0.1.0",
        "Accept": "application/json",
        ...(proxyReq.headers || {}),
      },
    };

    if (proxyReq.body && proxyReq.method !== "GET") {
      fetchOpts.body = JSON.stringify(proxyReq.body);
      (fetchOpts.headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    externalResponse = await fetch(targetUrl, fetchOpts);
    externalStatus = externalResponse.status;

    const contentType = externalResponse.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      responseData = await externalResponse.json();
    } else {
      responseData = await externalResponse.text();
    }
  } catch (err) {
    const latency = Date.now() - start;

    await auditLog.record({
      alias: proxyReq.alias,
      caller: extractCaller(req),
      path: proxyReq.path,
      method: proxyReq.method,
      status: 502,
      latency_ms: latency,
      timestamp: Date.now(),
      error: err instanceof Error ? err.message : "External API unreachable",
    });

    return res.status(502).json({
      error: "External API unreachable",
      latency_ms: latency,
    });
  }

  const latency = Date.now() - start;

  // --- 6. Audit log ---
  await auditLog.record({
    alias: proxyReq.alias,
    caller: extractCaller(req),
    path: proxyReq.path,
    method: proxyReq.method,
    status: externalStatus,
    latency_ms: latency,
    timestamp: Date.now(),
  });

  // --- 7. Return clean response (no keys, no internal headers) ---
  return res.status(externalStatus).json({
    status: externalStatus,
    data: responseData,
    cached: false,
    latency_ms: latency,
    remaining_quota: usageResult.remaining,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the target URL by appending the API key as a query parameter.
 * Supports common API key patterns: ?appid=, ?apiKey=, ?key=, ?api_key=
 */
function buildTargetUrl(baseUrl: string, path: string, apiKey: string): string {
  const url = new URL(path, baseUrl);

  // Detect key parameter name from common patterns
  // The base_url can encode the param name, e.g. "https://api.openweathermap.org" -> appid
  const keyParamMap: Record<string, string> = {
    "openweathermap.org": "appid",
    "newsapi.org": "apiKey",
    "alphavantage.co": "apikey",
    "googleapis.com": "key",
  };

  let keyParam = "api_key"; // default
  for (const [domain, param] of Object.entries(keyParamMap)) {
    if (baseUrl.includes(domain)) {
      keyParam = param;
      break;
    }
  }

  url.searchParams.set(keyParam, apiKey);
  return url.toString();
}

function extractSignature(req: VercelRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;

  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0] === "Signature") {
    return parts[1];
  }
  return null;
}

function extractCaller(req: VercelRequest): string {
  return (
    (req.headers["x-genlayer-contract"] as string) ||
    (req.headers["x-forwarded-for"] as string) ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}
