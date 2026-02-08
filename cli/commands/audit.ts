import { Command } from "commander";
import { getEndpoint, getToken, apiCall } from "./helpers";

export const auditCommand = new Command("audit")
  .description("View usage audit log for a key alias")
  .argument("<alias>", "Key alias to audit")
  .option("--last <duration>", "Time window (e.g., 1h, 7d, 30d)", "24h")
  .option("--limit <number>", "Max entries to show", "20")
  .action(async (alias: string, opts: any, cmd: any) => {
    const endpoint = getEndpoint(cmd);
    const token = getToken(cmd);

    const since = parseDuration(opts.last);
    const params = new URLSearchParams({
      alias,
      since: since.toString(),
      limit: opts.limit,
    });

    const data = await apiCall(
      endpoint,
      `/api/keys/audit?${params.toString()}`,
      "GET",
      token
    );

    // Print stats
    console.log(`\n  Audit Log: ${alias}`);
    console.log(`  Period: last ${opts.last}\n`);
    console.log(`  Total requests:  ${data.stats.total_requests}`);
    console.log(`  Errors:          ${data.stats.error_count}`);
    console.log(`  Avg latency:     ${data.stats.avg_latency_ms}ms`);
    console.log();

    if (data.entries.length === 0) {
      console.log("  No entries found in this period.\n");
      return;
    }

    // Print entries
    console.log(
      "  " +
      "TIME".padEnd(14) +
      "METHOD".padEnd(8) +
      "PATH".padEnd(36) +
      "STATUS".padEnd(8) +
      "LATENCY"
    );
    console.log("  " + "-".repeat(78));

    for (const e of data.entries) {
      const time = new Date(e.timestamp).toLocaleTimeString();
      const path = e.path.length > 34 ? e.path.slice(0, 31) + "..." : e.path;
      const statusStr = e.error ? `${e.status}!` : `${e.status}`;

      console.log(
        "  " +
        time.padEnd(14) +
        e.method.padEnd(8) +
        path.padEnd(36) +
        statusStr.padEnd(8) +
        `${e.latency_ms}ms`
      );
    }
    console.log();
  });

function parseDuration(s: string): number {
  const match = s.match(/^(\d+)(h|d|m)$/);
  if (!match) return Date.now() - 24 * 60 * 60 * 1000;

  const val = Number(match[1]);
  const unit = match[2];
  const ms = unit === "h" ? val * 3_600_000 : unit === "d" ? val * 86_400_000 : val * 60_000;

  return Date.now() - ms;
}
