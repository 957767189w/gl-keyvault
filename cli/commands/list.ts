import { Command } from "commander";
import { getEndpoint, getToken, apiCall, formatTimestamp } from "./helpers";

export const listCommand = new Command("list")
  .description("List all registered key aliases")
  .action(async (_opts: any, cmd: any) => {
    const endpoint = getEndpoint(cmd);
    const token = getToken(cmd);

    const data = await apiCall(endpoint, "/api/keys/list", "GET", token);

    if (data.count === 0) {
      console.log("\n  No keys registered. Use `glvault add` to register one.\n");
      return;
    }

    console.log(`\n  Registered Keys (${data.count}):\n`);
    console.log(
      "  " +
      "ALIAS".padEnd(20) +
      "QUOTA".padEnd(16) +
      "BASE URL".padEnd(36) +
      "ROTATED"
    );
    console.log("  " + "-".repeat(88));

    for (const k of data.keys) {
      const quota = `${k.quota_used}/${k.quota_limit}`;
      const baseUrl = k.base_url.length > 34 ? k.base_url.slice(0, 31) + "..." : k.base_url;
      const rotated = formatTimestamp(k.rotated_at);

      console.log(
        "  " +
        k.alias.padEnd(20) +
        quota.padEnd(16) +
        baseUrl.padEnd(36) +
        rotated
      );
    }
    console.log();
  });
