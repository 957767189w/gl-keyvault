import { Command } from "commander";
import { getEndpoint } from "./helpers";

interface HealthData {
  status: string;
  version: string;
  uptime_ms: number;
  storage: string;
  keys_registered: number;
}

export const healthCommand = new Command("health")
  .description("Check gl-keyvault service health")
  .action(async (_opts: unknown, cmd: Command) => {
    const endpoint = getEndpoint(cmd);

    try {
      const res = await fetch(`${endpoint}/api/health`);
      const data = (await res.json()) as HealthData;

      const uptime = formatUptime(data.uptime_ms);
      const statusIcon = data.status === "ok" ? "OK" : data.status === "degraded" ? "DEGRADED" : "DOWN";

      console.log(`\n  gl-keyvault Health Check`);
      console.log(`  Endpoint: ${endpoint}`);
      console.log(`  Status:   ${statusIcon}`);
      console.log(`  Version:  ${data.version}`);
      console.log(`  Uptime:   ${uptime}`);
      console.log(`  Storage:  ${data.storage}`);
      console.log(`  Keys:     ${data.keys_registered} registered`);
      console.log();
    } catch (err) {
      console.error(`\n  Failed to reach ${endpoint}/api/health`);
      console.error(`  ${err instanceof Error ? err.message : "Connection failed"}\n`);
      process.exit(1);
    }
  });

function formatUptime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}
