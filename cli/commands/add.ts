import { Command } from "commander";
import { getEndpoint, getToken, apiCall } from "./helpers";

export const addCommand = new Command("add")
  .description("Register a new API key")
  .argument("<alias>", "Key alias (e.g., openweather, newsapi)")
  .argument("<api_key>", "The raw API key to encrypt and store")
  .requiredOption("--base-url <url>", "API base URL (e.g., https://api.openweathermap.org)")
  .option("--quota <number>", "Max requests per rate limit window", "1000")
  .option("--owner <id>", "Owner identifier", "admin")
  .action(async (alias: string, apiKey: string, opts: any, cmd: any) => {
    const endpoint = getEndpoint(cmd);
    const token = getToken(cmd);

    const data = await apiCall(endpoint, "/api/keys/register", "POST", token, {
      alias,
      api_key: apiKey,
      base_url: opts.baseUrl,
      quota_limit: Number(opts.quota),
      owner: opts.owner,
    });

    console.log(`\n  Key registered successfully`);
    console.log(`  Alias:    ${data.alias}`);
    console.log(`  Base URL: ${data.base_url}`);
    console.log(`  Quota:    ${data.quota_limit}/window`);
    console.log(`  Owner:    ${data.owner}`);
    console.log();
  });
