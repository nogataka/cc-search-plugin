# cc-search-plugin

Claude Code plugin for searching past conversation history and auto-injecting context after compaction.

## Features

- **Auto context injection** — After `/compact`, the SessionStart hook automatically injects recent messages from the previous session into Claude's context
- **Manual search** — Use the `/history-recall` skill to search past conversations by keyword, browse projects, and view session details
- **CLI tool** — Standalone CLI for searching and retrieving conversation history

## Install

### From GitHub

```
/plugin marketplace add nogataka/cc-search-plugin
/plugin install cc-search-plugin
```

### From local directory

```
/plugin marketplace add /path/to/cc-search-plugin
/plugin install cc-search-plugin
```

## How It Works

### Auto context injection (after compaction)

When you run `/compact` in Claude Code, the plugin's SessionStart hook fires automatically:

1. Reads the current session's JSONL file from `~/.claude/projects/`
2. Extracts the last 10 messages
3. Outputs a formatted summary to stdout, which Claude Code injects into the conversation context

This means Claude retains awareness of recent conversation history after compaction, without any manual action.

**Hook configuration** (`hooks/hooks.json`):
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "compact",
      "hooks": [{
        "type": "command",
        "command": "'${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd' session-start"
      }]
    }]
  }
}
```

### Manual search (skill)

Use the `/history-recall` skill to search past conversations:

```
# Search by keyword
/history-recall
> node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" search "authentication" --limit 20

# Get previous session (skips current session)
> node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" recent --offset 1

# List all projects
> node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" list-projects

# View full session
> node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" session-detail PROJECT_ID SESSION_ID
```

## CLI Reference

```
cc-search search <query> [--limit N] [--project <filter>]
cc-search recent [--sessions N] [--messages N] [--offset N] [--project <filter>]
cc-search list-projects
cc-search session-detail <projectId> <sessionId>
cc-search inject-context [--count N]
```

| Command | Description |
|---|---|
| `search` | Search conversations by keyword. Returns matching text with context. |
| `recent` | Get recent sessions. Use `--offset 1` to skip the current session. |
| `list-projects` | List all Claude Code projects. |
| `session-detail` | Get full message history for a specific session. |
| `inject-context` | Read hook input from stdin and output context summary. Used by the SessionStart hook. |

### Key flags

| Flag | Default | Description |
|---|---|---|
| `--limit` | 20 | Max search results |
| `--sessions` | 1 | Number of recent sessions to return |
| `--messages` | 20 | Messages per session |
| `--offset` | 0 | Skip N most recent sessions (use `1` to skip current session) |
| `--project` | — | Filter by project ID |
| `--count` | 10 | Messages to include in context injection |

## Build from source

```bash
npm install
npm run build
```

Requires Node.js 18+ and TypeScript 5.7+.

## Data source

All data is read directly from Claude Code's local JSONL files at `~/.claude/projects/`. No external services or databases are required.

## License

MIT
