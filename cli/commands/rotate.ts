import { Command } from "commander";
import { getEndpoint, getToken, apiCall } from "./helpers";

export const rotateCommand = new Command("rotate")
  .description("Rotate an existing API key (zero-downtime)")
  .argument("<alias>", "Key alias to rotate")
  .argument("<new_api_key>", "New API key value")
  .action(async (alias: string, newApiKey: string, _opts: any, cmd: any) => {
    const endpoint = getEndpoint(cmd);
    const token = getToken(cmd);

    const data = await apiCall(endpoint, "/api/keys/rotate", "POST", token, {
      alias,
      new_api_key: newApiKey,
    });

    console.log(`\n  Key rotated successfully`);
    console.log(`  Alias:      ${data.alias}`);
    console.log(`  Rotated at: ${data.rotated_at}`);
    console.log();
  });
