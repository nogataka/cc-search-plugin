#!/usr/bin/env node

/**
 * cc-search CLI entry point
 *
 * Subcommands:
 *   search <query> [--limit N] [--project <filter>]
 *   list-projects
 *   session-detail <projectId> <sessionId>
 *   inject-context [--count N]
 */

import {
  searchClaudeCode,
  getSearchProjects,
  getSessionDetail,
} from "./search.js";
import { injectContext } from "./context-injector.js";

function printUsage(): void {
  console.error(`Usage:
  cc-search search <query> [--limit N] [--project <filter>]
  cc-search list-projects
  cc-search session-detail <projectId> <sessionId>
  cc-search inject-context [--count N]`);
  process.exit(1);
}

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    return;
  }

  switch (command) {
    case "search": {
      const query = args[1];
      if (!query) {
        console.error("Error: query is required");
        printUsage();
        return;
      }
      const limit = parseInt(parseFlag(args, "--limit") ?? "20", 10);
      const project = parseFlag(args, "--project");
      const result = await searchClaudeCode(query, limit, project);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case "list-projects": {
      const projects = await getSearchProjects();
      console.log(JSON.stringify(projects, null, 2));
      break;
    }

    case "session-detail": {
      const projectId = args[1];
      const sessionId = args[2];
      if (!projectId || !sessionId) {
        console.error("Error: projectId and sessionId are required");
        printUsage();
        return;
      }
      const messages = await getSessionDetail(projectId, sessionId);
      console.log(JSON.stringify(messages, null, 2));
      break;
    }

    case "inject-context": {
      const count = parseInt(parseFlag(args, "--count") ?? "10", 10);
      await injectContext(count);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
  }
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
