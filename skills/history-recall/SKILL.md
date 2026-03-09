---
name: history-recall
description: >-
  Search and recall past Claude Code conversation history.
  Use when user asks about previous sessions, past discussions, or wants to find something discussed before.
  Triggers: "前回の会話", "前のセッション", "過去の会話", "以前話した", "履歴", "recall", "previous session", "history", "past conversation", "what did we discuss"
user_invocable: true
---

# History Recall

Search and recall past Claude Code conversations using the cc-search CLI.

## IMPORTANT: Current session exclusion

When the user asks for "前回の会話" or "previous session", they mean the session BEFORE the current one. The current session is always the most recent, so you MUST use `--offset 1` to skip it. Without `--offset 1`, you will return the current session itself, which is not what the user wants.

## Common patterns

### "前回の会話を呼び出して" / "Recall previous session"

Get the previous session (skip current session with --offset 1):

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" recent --offset 1
```

Get previous sessions from a specific project:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" recent --offset 1 --project PROJECT_ID
```

Get multiple previous sessions with more messages:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" recent --offset 1 --sessions 3 --messages 50
```

### "〜について前に話したよね" / "Search for a topic"

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" search "QUERY" --limit 20
```

Filter by project:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" search "QUERY" --project PROJECT_ID --limit 20
```

### "どのプロジェクトがある？" / "List projects"

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" list-projects
```

### "セッションの全内容を見せて" / "Full session detail"

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" session-detail PROJECT_ID SESSION_ID
```

## Output format

- `recent`: Array of `{ projectId, projectName, projectPath, sessionId, lastTimestamp, messageCount, messages: [{ role, text, timestamp }] }`
- `search`: `{ results: [{ projectId, projectName, sessionId, matchedText, contextBefore, contextAfter, timestamp, role }], total: N }`
- `list-projects`: Array of `{ id, name, path }`
- `session-detail`: Array of `{ role, text, timestamp }`

## Tips

- ALWAYS use `--offset 1` when the user asks about "前回の会話" or "previous session" to skip the current session
- Use `search` when the user mentions a specific topic or keyword
- Use `list-projects` to find project IDs, then filter with `--project`
- Results are sorted by most recent first
