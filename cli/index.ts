#!/usr/bin/env node
// ---------------------------------------------------------------------------
// glvault CLI
//
// Command-line tool for managing API keys in gl-keyvault.
// Communicates with the deployed proxy service via HTTP.
// ---------------------------------------------------------------------------

import { Command } from "commander";
import { addCommand } from "./commands/add";
import { listCommand } from "./commands/list";
import { rotateCommand } from "./commands/rotate";
import { auditCommand } from "./commands/audit";
import { healthCommand } from "./commands/health";

const program = new Command();

program
  .name("glvault")
  .description("Secure API key management for GenLayer Intelligent Contracts")
  .version("0.1.0")
  .option(
    "--endpoint <url>",
    "gl-keyvault service URL",
    process.env.GLVAULT_ENDPOINT || "http://localhost:3000"
  )
  .option(
    "--token <token>",
    "Admin authentication token",
    process.env.GLVAULT_ADMIN_TOKEN
  );

program.addCommand(addCommand);
program.addCommand(listCommand);
program.addCommand(rotateCommand);
program.addCommand(auditCommand);
program.addCommand(healthCommand);

program.parse();
