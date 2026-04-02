# Antigravity Agent OS — MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the `ai-context/` directory as live, callable tools. Agents use these tools instead of reading files directly, giving them structured access to tasks, handoffs, logs, decisions, and project state.

---

## Quick Start

### 1. Install dependencies

```bash
cd mcp-server && npm install
```

### 2. Configure your MCP client

Add the server to your agent's MCP configuration. The exact file depends on your client:

**Cursor / VS Code (`.vscode/settings.json` or `settings.json`)**
```json
{
  "mcpServers": {
    "agent-os": {
      "command": "node",
      "args": ["./mcp-server/index.mjs"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

**Claude Desktop (`~/.claude/claude_desktop_config.json`)**
```json
{
  "mcpServers": {
    "agent-os": {
      "command": "node",
      "args": ["/absolute/path/to/antigravity-agent-os/mcp-server/index.mjs"]
    }
  }
}
```

**Generic `.agent/mcp.json`**
```json
{
  "mcpServers": {
    "agent-os": {
      "command": "node",
      "args": ["./mcp-server/index.mjs"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### 3. Restart your MCP client

After updating the config, restart your IDE or agent client to load the new server.

---

## Available Tools

### Task Management

| Tool | Description |
|---|---|
| `get_tasks` | List all tasks; filter by status, priority, owner, or area |
| `get_task` | Fetch a single task by ID (e.g. `SYS-001`) |
| `update_task` | Update status, owner, next_action, priority, or notes |
| `create_task` | Create a new task; ID is auto-generated in `AREA-NNN` format |

### Handoffs

| Tool | Description |
|---|---|
| `get_handoff` | Parse the active handoff into structured JSON |
| `write_handoff` | Write a new handoff; archives the previous one automatically |

### Dashboard

| Tool | Description |
|---|---|
| `get_dashboard` | Parse dashboard.md into structured JSON |
| `update_dashboard` | Update state fields or append to Recent Activity |

### Logs

| Tool | Description |
|---|---|
| `append_log` | Append a structured entry to today's log file |
| `get_logs` | Read log entries; filter by date, agent, or task_id |

### Decisions & Project

| Tool | Description |
|---|---|
| `record_decision` | Create a new decision file in `ai-context/decisions/` |
| `get_project` | Read `project.md` content |

### System

| Tool | Description |
|---|---|
| `detect_conflicts` | Run conflict detection; returns severity-tagged issues |
| `get_federation_status` | Read cross-repo task summaries from federation-cache.json |

---

## Usage Examples

### Get all in-progress tasks owned by claude

```json
{
  "tool": "get_tasks",
  "arguments": {
    "status": "in_progress",
    "owner": "claude"
  }
}
```

### Mark a task done

```json
{
  "tool": "update_task",
  "arguments": {
    "id": "FE-003",
    "updated_by": "codex",
    "status": "done",
    "next_action": "Deploy to staging"
  }
}
```

### Create a new task

```json
{
  "tool": "create_task",
  "arguments": {
    "title": "Add rate limiting to API endpoints",
    "area": "BE",
    "priority": "high",
    "owner": "claude",
    "next_action": "Implement middleware in src/middleware/rateLimiter.ts",
    "created_by": "claude"
  }
}
```

### Write a handoff after finishing a session

```json
{
  "tool": "write_handoff",
  "arguments": {
    "from": "claude",
    "to": "codex",
    "task_id": "BE-007",
    "completed": "Implemented JWT validation middleware in src/middleware/auth.ts. Added tests — all 12 passing.",
    "blockers": "None",
    "exact_next_step": "Open src/routes/users.ts and wire the auth middleware to the /api/users endpoint at line 34.",
    "files_touched": ["src/middleware/auth.ts", "tests/auth.test.ts", "ai-context/tasks.json"]
  }
}
```

### Append a log entry

```json
{
  "tool": "append_log",
  "arguments": {
    "agent": "claude",
    "task_id": "BE-007",
    "summary": "Implemented JWT validation middleware with RS256 support",
    "files_changed": ["src/middleware/auth.ts", "tests/auth.test.ts"],
    "blockers": "None",
    "next_step": "Wire middleware to user routes"
  }
}
```

### Read today's logs filtered by agent

```json
{
  "tool": "get_logs",
  "arguments": {
    "agent": "claude"
  }
}
```

### Record an architectural decision

```json
{
  "tool": "record_decision",
  "arguments": {
    "title": "Use Supabase for persistent agent memory",
    "context": "Agents need cross-device, cross-session memory. Local files alone are insufficient for concurrent multi-agent workflows.",
    "decision": "Use Supabase as the primary persistence layer. All ai-context/ writes are mirrored to Supabase via the sync-ai-context edge function.",
    "consequences": "Agents can read from Supabase for real-time state. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.",
    "decided_by": "human",
    "related_files": ["supabase/schema.sql", "supabase/functions/sync-ai-context/index.ts"]
  }
}
```

### Run conflict detection

```json
{
  "tool": "detect_conflicts",
  "arguments": {}
}
```

**Example response:**
```json
{
  "conflicts": [
    {
      "type": "stale_handoff",
      "file": "ai-context/handoffs/active.md",
      "description": "Active handoff is 52h old",
      "severity": "warning",
      "suggested_resolution": "Update or archive the active handoff"
    }
  ],
  "summary": {
    "total": 1,
    "critical": 0,
    "warnings": 1,
    "info": 0
  }
}
```

---

## How It Works

The MCP server:

1. **Finds the repo root** by walking up the directory tree until it finds `ai-context/`. This means it works whether launched from `mcp-server/` or the repo root.
2. **Reads and writes files directly** — no database, no caching. Every tool call reflects the current file state.
3. **Uses stdio transport** — compatible with all MCP-compliant clients (Claude Desktop, Cursor, VS Code with MCP extension, etc.).
4. **Archives before overwriting** — `write_handoff` always moves the current `active.md` to `handoffs/archive/` before creating a new one.
5. **Auto-generates task IDs** — `create_task` finds the highest existing `AREA-NNN` number and increments it.

---

## File Structure

```
mcp-server/
├── index.mjs       # MCP server entry point (all tool implementations)
├── package.json    # Dependencies and scripts
└── README.md       # This file
```

---

## Requirements

- Node.js 18+
- The `ai-context/` directory must exist at or above the MCP server's working directory

---

## Troubleshooting

**"tasks.json not found"** — Confirm `ai-context/tasks.json` exists in the repo root. The server searches parent directories.

**Server not appearing in client** — Ensure you restarted the client after updating the MCP config. Check the path to `index.mjs` is correct.

**Conflict detection returns script error** — The built-in fallback checker runs automatically if `.agent/skills/conflict-resolver/scripts/detect-conflicts.mjs` is not found. Results will be less detailed but still functional.

**Logs show "Repo root: /some/path"** — This is informational output sent to stderr. It confirms the server located the correct root directory.
