import { Command } from "commander";

interface ApiResponse {
  error?: string;
  [key: string]: unknown;
}

export function getEndpoint(cmd: Command): string {
  const parent = cmd.parent as Command | undefined;
  return (parent?.opts() as Record<string, string>)?.endpoint || "http://localhost:3000";
}

export function getToken(cmd: Command): string {
  const parent = cmd.parent as Command | undefined;
  const token = (parent?.opts() as Record<string, string>)?.token;
  if (!token) {
    console.error("Error: --token is required (or set GLVAULT_ADMIN_TOKEN env var)");
    process.exit(1);
  }
  return token;
}

export async function apiCall(
  endpoint: string,
  path: string,
  method: string,
  token: string,
  body?: Record<string, unknown>
): Promise<ApiResponse> {
  const url = `${endpoint}${path}`;

  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  };

  if (body && method !== "GET") {
    opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, opts);
    const data = (await res.json()) as ApiResponse;

    if (!res.ok) {
      console.error(`Error (${res.status}): ${data.error || "Unknown error"}`);
      process.exit(1);
    }

    return data;
  } catch (err) {
    console.error(`Failed to connect to ${url}`);
    console.error(err instanceof Error ? err.message : "Connection failed");
    process.exit(1);
  }
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}
