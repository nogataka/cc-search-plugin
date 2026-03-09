/**
 * Search logic — ported from cc-search-mcp server.ts
 * Pure functions, no MCP SDK dependency.
 */
export declare const CLAUDE_PROJECTS_DIR: string;
export interface ParsedEntry {
    type: string;
    role: "user" | "assistant";
    text: string;
    timestamp: string;
}
export interface SearchResult {
    projectId: string;
    projectPath: string;
    projectName: string;
    sessionId: string;
    matchedText: string;
    contextBefore: string;
    contextAfter: string;
    timestamp: string | null;
    role: "user" | "assistant";
}
export interface SearchProject {
    id: string;
    name: string;
    path: string;
}
export interface SessionMessage {
    role: "user" | "assistant";
    text: string;
    timestamp: string;
}
export declare function extractTextFromLine(line: string): ParsedEntry | null;
export declare function searchClaudeCode(query: string, limit: number, projectFilter?: string): Promise<{
    results: SearchResult[];
    total: number;
}>;
export declare function getSearchProjects(): Promise<SearchProject[]>;
export declare function getSessionDetail(projectId: string, sessionId: string): Promise<SessionMessage[]>;
