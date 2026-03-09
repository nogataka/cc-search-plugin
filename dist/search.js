/**
 * Search logic — ported from cc-search-mcp server.ts
 * Pure functions, no MCP SDK dependency.
 */
import { readdir, readFile, stat, open as fsOpen } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");
const UUID_JSONL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
function dirNameToProjectPath(dirName) {
    return dirName.replace(/-/g, "/");
}
async function readCwdFromJsonl(filePath) {
    const fh = await fsOpen(filePath, "r");
    try {
        const rl = createInterface({ input: fh.createReadStream() });
        for await (const line of rl) {
            try {
                const data = JSON.parse(line);
                if (data.cwd) {
                    rl.close();
                    return data.cwd;
                }
            }
            catch {
                // skip unparseable lines
            }
        }
    }
    finally {
        await fh.close();
    }
    return null;
}
async function resolveProjectPath(claudeProjectDir) {
    // 1. Try sessions-index.json
    try {
        const indexPath = join(claudeProjectDir, "sessions-index.json");
        const content = await readFile(indexPath, "utf-8");
        const index = JSON.parse(content);
        if (index.originalPath)
            return index.originalPath;
        if (index.entries?.[0]?.projectPath)
            return index.entries[0].projectPath;
    }
    catch {
        // not found or unparseable
    }
    // 2. Try reading cwd from the first JSONL session file
    try {
        const files = await readdir(claudeProjectDir);
        const jsonlFile = files.find((f) => UUID_JSONL_RE.test(f));
        if (jsonlFile) {
            const cwd = await readCwdFromJsonl(join(claudeProjectDir, jsonlFile));
            if (cwd)
                return cwd;
        }
    }
    catch {
        // failed to read
    }
    // 3. Fallback: lossy conversion
    const dirName = basename(claudeProjectDir);
    return dirNameToProjectPath(dirName);
}
function projectDisplayName(projectPath) {
    return basename(projectPath) || projectPath;
}
// ---------------------------------------------------------------------------
// JSONL parsing
// ---------------------------------------------------------------------------
export function extractTextFromLine(line) {
    try {
        const obj = JSON.parse(line);
        if (obj.type === "user") {
            const content = obj.message?.content;
            let text = "";
            if (typeof content === "string") {
                text = content;
            }
            else if (Array.isArray(content)) {
                text = content
                    .filter((c) => c.type === "text" && c.text)
                    .map((c) => c.text)
                    .join("\n");
            }
            if (text) {
                return {
                    type: "user",
                    role: "user",
                    text,
                    timestamp: obj.timestamp ?? "",
                };
            }
        }
        else if (obj.type === "assistant") {
            const content = obj.message?.content;
            if (Array.isArray(content)) {
                const text = content
                    .filter((c) => c.type === "text" && c.text)
                    .map((c) => c.text)
                    .join("\n");
                if (text) {
                    return {
                        type: "assistant",
                        role: "assistant",
                        text,
                        timestamp: obj.timestamp ?? "",
                    };
                }
            }
        }
    }
    catch {
        // skip malformed lines
    }
    return null;
}
// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export async function searchClaudeCode(query, limit, projectFilter) {
    const results = [];
    const queryLower = query.toLowerCase();
    try {
        const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);
        for (const dirName of projectDirs) {
            const projectDirPath = resolve(CLAUDE_PROJECTS_DIR, dirName);
            const dirStat = await stat(projectDirPath).catch(() => null);
            if (!dirStat?.isDirectory())
                continue;
            if (projectFilter && dirName !== projectFilter)
                continue;
            const projectPath = await resolveProjectPath(projectDirPath);
            const projectName = projectDisplayName(projectPath);
            const files = await readdir(projectDirPath).catch(() => []);
            const sessionFiles = files.filter((f) => UUID_JSONL_RE.test(f));
            for (const sessionFile of sessionFiles) {
                const sessionPath = resolve(projectDirPath, sessionFile);
                const sessionId = sessionFile.replace(".jsonl", "");
                const fileStat = await stat(sessionPath).catch(() => null);
                if (!fileStat || fileStat.size > MAX_FILE_SIZE)
                    continue;
                try {
                    const content = await readFile(sessionPath, "utf-8");
                    const lines = content.trim().split("\n");
                    for (const line of lines) {
                        const entry = extractTextFromLine(line);
                        if (!entry)
                            continue;
                        const textLower = entry.text.toLowerCase();
                        const matchIndex = textLower.indexOf(queryLower);
                        if (matchIndex === -1)
                            continue;
                        const contextStart = Math.max(0, matchIndex - 100);
                        const contextEnd = Math.min(entry.text.length, matchIndex + query.length + 100);
                        results.push({
                            projectId: dirName,
                            projectPath,
                            projectName,
                            sessionId,
                            matchedText: entry.text.slice(matchIndex, matchIndex + query.length),
                            contextBefore: entry.text.slice(contextStart, matchIndex),
                            contextAfter: entry.text.slice(matchIndex + query.length, contextEnd),
                            timestamp: entry.timestamp || null,
                            role: entry.role,
                        });
                    }
                }
                catch {
                    // Skip files that can't be read
                }
            }
        }
    }
    catch {
        // ~/.claude/projects doesn't exist
    }
    results.sort((a, b) => {
        if (!a.timestamp)
            return 1;
        if (!b.timestamp)
            return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    return { results: results.slice(0, limit), total: results.length };
}
// ---------------------------------------------------------------------------
// List projects
// ---------------------------------------------------------------------------
export async function getSearchProjects() {
    const projects = [];
    try {
        const dirs = await readdir(CLAUDE_PROJECTS_DIR);
        for (const dirName of dirs) {
            const dirPath = resolve(CLAUDE_PROJECTS_DIR, dirName);
            const dirStat = await stat(dirPath).catch(() => null);
            if (!dirStat?.isDirectory())
                continue;
            const files = await readdir(dirPath).catch(() => []);
            if (!files.some((f) => UUID_JSONL_RE.test(f)))
                continue;
            const projectPath = await resolveProjectPath(dirPath);
            projects.push({
                id: dirName,
                name: projectDisplayName(projectPath),
                path: projectPath,
            });
        }
    }
    catch {
        // directory doesn't exist
    }
    return projects.sort((a, b) => a.name.localeCompare(b.name));
}
// ---------------------------------------------------------------------------
// Session detail
// ---------------------------------------------------------------------------
export async function getSessionDetail(projectId, sessionId) {
    const sessionPath = resolve(CLAUDE_PROJECTS_DIR, projectId, `${sessionId}.jsonl`);
    const content = await readFile(sessionPath, "utf-8");
    const lines = content.trim().split("\n");
    const messages = [];
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
    return messages;
}
