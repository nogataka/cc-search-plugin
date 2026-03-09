/**
 * Context injector — reads JSONL directly (no intermediate JSON).
 * Called by SessionStart hook after compaction.
 *
 * stdin: hook input JSON { session_id, cwd, ... }
 * stdout: formatted context summary → injected into Claude's context
 */
/**
 * Main entry point for context injection.
 */
export declare function injectContext(count?: number): Promise<void>;
