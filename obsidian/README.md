# Obsidian Bridge

Obsidian is the first-class external surface for this master pack. The repo keeps `ai-context/` canonical and generates Obsidian-friendly artifacts on top of it.

## What Gets Generated

Run:

```bash
npm run context:obsidian:bootstrap
```

This does three things:

1. Regenerates `ai-context/kanban-board.md` from `ai-context/tasks.json`
2. Mirrors task, decision, and activity notes into `obsidian/generated/`
3. Keeps `.base` templates available under `obsidian/bases/`

## Files

- `ai-context/kanban-board.md`: Kanban board derived from task state
- `obsidian/bases/tasks.base`: task browsing view
- `obsidian/bases/decisions.base`: decision browsing view
- `obsidian/bases/activity.base`: activity browsing view
- `obsidian/generated/index.md`: generated note index
- `obsidian/generated/tasks/`: task notes
- `obsidian/generated/decisions/`: decision mirrors
- `obsidian/generated/activity/`: log mirrors

## Source Of Truth

- Edit `ai-context/tasks.json`, not the Kanban board markdown.
- Edit `ai-context/decisions/` and `ai-context/logs/`, not the generated mirrors.
- Treat `obsidian/generated/` as disposable derived output.

## Recommended Flow

1. Open the repo root as your Obsidian vault.
2. Install the Kanban community plugin.
3. Run `npm run context:obsidian:bootstrap`.
4. Open `ai-context/kanban-board.md` and the `.base` files from Obsidian.

## Kanban Only

If you only want the board and not the extra note generation, run:

```bash
npm run context:kanban
```

For live regeneration:

```bash
npm run context:kanban:watch
```
