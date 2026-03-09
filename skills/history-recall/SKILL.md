---
name: history-recall
description: Search and recall past Claude Code conversation history. Use when user asks about previous sessions, past discussions, or wants to find something discussed before.
---

# History Recall

Use the cc-search CLI to search past conversations.

## Search

```bash
node /Volumes/Data/dev/cc-search-plugin/dist/cli.js search "QUERY" --limit 20
```

Replace `QUERY` with the user's search term. Adjust `--limit` as needed.

## Filter by project

```bash
node /Volumes/Data/dev/cc-search-plugin/dist/cli.js search "QUERY" --project PROJECT_ID --limit 20
```

Use `list-projects` to get available PROJECT_IDs.

## List projects

```bash
node /Volumes/Data/dev/cc-search-plugin/dist/cli.js list-projects
```

## Session detail

```bash
node /Volumes/Data/dev/cc-search-plugin/dist/cli.js session-detail PROJECT_ID SESSION_ID
```

## Output format

- `search`: Returns `{ results: [...], total: N }` as JSON
- `list-projects`: Returns array of `{ id, name, path }`
- `session-detail`: Returns array of `{ role, text, timestamp }`

## Tips

- Use specific keywords for better results
- Results are sorted by most recent first
- Use `list-projects` first to find project IDs, then filter with `--project`
