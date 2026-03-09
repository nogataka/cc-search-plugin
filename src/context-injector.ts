/**
 * Context injector — reads JSONL directly (no intermediate JSON).
 * Called by SessionStart hook after compaction.
 *
 * stdin: hook input JSON { session_id, cwd, ... }
 * stdout: formatted context summary → injected into Claude's context
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { homedir } from "node:os";
import { extractTextFromLine, CLAUDE_PROJECTS_DIR } from "./search.js";

const UUID_JSONL_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

interface HookInput {
  session_id?: string;
  cwd?: string;
}

interface RecentMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

/**
 * Find the JSONL file for the given session ID.
 * Searches all project directories under ~/.claude/projects/
 */
async function findSessionJsonl(sessionId: string): Promise<string | null> {
  try {
    const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);
    for (const dirName of projectDirs) {
      const candidate = resolve(
        CLAUDE_PROJECTS_DIR,
        dirName,
        `${sessionId}.jsonl`,
      );
      const s = await stat(candidate).catch(() => null);
      if (s?.isFile()) return candidate;
    }
  } catch {
    // directory doesn't exist
  }
  return null;
}

/**
 * Extract recent messages from a JSONL file.
 */
async function extractRecentMessages(
  jsonlPath: string,
  count: number,
): Promise<RecentMessage[]> {
  const content = await readFile(jsonlPath, "utf-8");
  const lines = content.trim().split("\n");
  const messages: RecentMessage[] = [];

  for (const line of lines) {
    const entry = extractTextFromLine(line);
    if (entry && entry.role) {
      messages.push({
        role: entry.role,
        text: entry.text,
        timestamp: entry.timestamp,
      });
    }
  }

  // Return the last N messages
  return messages.slice(-count);
}

/**
 * Format messages as context summary text.
 */
function formatContextSummary(
  messages: RecentMessage[],
  totalCount: number,
  sessionId: string,
  projectDir: string,
): string {
  const lines: string[] = [
    "Previous session summary:",
    `# Session: ${new Date().toISOString().slice(0, 10)}`,
    `**Session ID:** ${sessionId}`,
    `**Project:** ${basename(projectDir) || projectDir}`,
    `**Total messages:** ${totalCount}`,
    "",
  ];

  if (messages.length < totalCount) {
    lines.push(
      `Showing last ${messages.length} of ${totalCount} messages:`,
    );
    lines.push("");
  }

  for (const msg of messages) {
    const roleLabel = msg.role === "user" ? "User" : "Assistant";
    const content =
      msg.text.length > 500 ? msg.text.slice(0, 500) + "..." : msg.text;
    lines.push(`**${roleLabel}:**`);
    lines.push(content);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Read hook input from stdin.
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Main entry point for context injection.
 */
export async function injectContext(count: number = 10): Promise<void> {
  let input: HookInput = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) {
      input = JSON.parse(raw);
    }
  } catch {
    // If stdin is empty or invalid, proceed with empty input
  }

  const sessionId = input.session_id;
  if (!sessionId) {
    // No session ID — nothing to inject
    return;
  }

  const jsonlPath = await findSessionJsonl(sessionId);
  if (!jsonlPath) {
    return;
  }

  // Count total messages first
  const content = await readFile(jsonlPath, "utf-8");
  const allLines = content.trim().split("\n");
  let totalCount = 0;
  for (const line of allLines) {
    const entry = extractTextFromLine(line);
    if (entry && entry.role) totalCount++;
  }

  const messages = await extractRecentMessages(jsonlPath, count);
  if (messages.length === 0) {
    return;
  }

  const summary = formatContextSummary(
    messages,
    totalCount,
    sessionId,
    input.cwd || "",
  );

  // Output to stdout → injected into Claude's context
  process.stdout.write(summary);
}
