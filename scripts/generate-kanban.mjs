#!/usr/bin/env node
/**
 * generate-kanban.mjs
 * Reads ai-context/tasks.json and generates an Obsidian Kanban-compatible
 * markdown file at ai-context/kanban-board.md.
 *
 * The Obsidian Kanban plugin (by mgmeyers) reads this file and renders it
 * as a drag-and-drop Kanban board.
 *
 * Usage:
 *   node scripts/generate-kanban.mjs            # Generate once
 *   node scripts/generate-kanban.mjs --watch    # Regenerate on tasks.json change
 *   node scripts/generate-kanban.mjs --dry-run  # Print output without writing
 *   node scripts/generate-kanban.mjs --verbose  # Show detailed per-task info
 *
 * Output: ai-context/kanban-board.md
 */

import { readFileSync, writeFileSync, watchFile, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── PATHS ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TASKS_PATH = resolve(ROOT, 'ai-context', 'tasks.json');
const OUTPUT_PATH = resolve(ROOT, 'ai-context', 'kanban-board.md');

// ─── ARGS ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// ─── COLUMN DEFINITIONS ──────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'pending',     label: 'Pending' },
  { id: 'ready',       label: 'Ready' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'blocked',     label: 'Blocked' },
  { id: 'review',      label: 'Review' },
  { id: 'done',        label: 'Done' },
];

// ─── PRIORITY BADGE ──────────────────────────────────────────────────────────

/**
 * Map priority string to a display badge.
 * Uses GHL-style tag syntax that the Kanban plugin can color via tag-colors config.
 */
function priorityBadge(priority) {
  const p = (priority || 'medium').toLowerCase();
  const labels = {
    critical: '@{priority: critical}',
    high:     '@{priority: high}',
    medium:   '@{priority: medium}',
    low:      '@{priority: low}',
  };
  return labels[p] || `@{priority: ${p}}`;
}

// ─── CARD RENDERER ───────────────────────────────────────────────────────────

/**
 * Render a single task as a Kanban card line.
 * Format: - [ ] **[ID]** Title @{priority: X} @{owner: Y}
 *
 * The checkbox state: done tasks use - [x], all others use - [ ]
 */
function renderCard(task, isDone = false) {
  const check = isDone ? '[x]' : '[ ]';
  const id = task.id || '?';
  const title = (task.title || 'Untitled').replace(/\n/g, ' ');
  const priority = priorityBadge(task.priority);
  const owner = task.owner ? `@{owner: ${task.owner}}` : '@{owner: unassigned}';

  // Optional: append area tag if present
  const area = task.area ? ` @{area: ${task.area}}` : '';

  return `- ${check} **[${id}]** ${title} ${priority} ${owner}${area}`;
}

// ─── MAIN GENERATOR ──────────────────────────────────────────────────────────

function generate() {
  // Read and parse tasks.json
  if (!existsSync(TASKS_PATH)) {
    console.error(`[kanban] tasks.json not found at: ${TASKS_PATH}`);
    console.error('Run the agent context setup first, then try again.');
    if (!WATCH) process.exit(1);
    return;
  }

  let data;
  try {
    const raw = readFileSync(TASKS_PATH, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`[kanban] Failed to parse tasks.json: ${err.message}`);
    return;
  }

  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const meta = data.meta || {};
  const lastUpdated = meta.last_updated
    ? new Date(meta.last_updated).toISOString().slice(0, 16).replace('T', ' ')
    : 'unknown';

  if (VERBOSE) {
    console.log(`[kanban] Found ${tasks.length} tasks, last updated: ${lastUpdated}`);
  }

  // Bucket tasks into columns
  const buckets = {};
  for (const col of COLUMNS) buckets[col.id] = [];

  for (const task of tasks) {
    const status = (task.status || 'pending').toLowerCase();
    if (status in buckets) {
      buckets[status].push(task);
    } else {
      // Unknown status falls into Pending
      buckets['pending'].push(task);
      if (VERBOSE) console.log(`[kanban] Task ${task.id} has unknown status "${status}" → placed in Pending`);
    }
  }

  // Sort each bucket: critical first, then high, medium, low; then by ID
  const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  function sortTasks(taskList) {
    return taskList.slice().sort((a, b) => {
      const pa = PRIORITY_ORDER[(a.priority || 'medium').toLowerCase()] ?? 2;
      const pb = PRIORITY_ORDER[(b.priority || 'medium').toLowerCase()] ?? 2;
      if (pa !== pb) return pa - pb;
      return (a.id || '').localeCompare(b.id || '');
    });
  }

  // Build the markdown
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const lines = [];

  // Frontmatter required by Obsidian Kanban plugin
  lines.push('---');
  lines.push('kanban-plugin: basic');
  lines.push('---');
  lines.push('');

  // Generator metadata comment (not shown in Kanban UI)
  lines.push(`%% Generated by generate-kanban.mjs at ${now} %%`);
  lines.push(`%% Source: ai-context/tasks.json (last updated: ${lastUpdated}) %%`);
  lines.push(`%% Total tasks: ${tasks.length} %%`);
  lines.push('');

  // Render each column
  for (const col of COLUMNS) {
    const colTasks = sortTasks(buckets[col.id]);
    lines.push(`## ${col.label}`);
    lines.push('');

    if (colTasks.length === 0) {
      // Empty column — no cards, just blank section
    } else {
      const isDone = col.id === 'done';
      for (const task of colTasks) {
        lines.push(renderCard(task, isDone));
        if (VERBOSE) {
          console.log(`  [${col.label}] ${task.id}: ${task.title}`);
        }
      }
    }
    lines.push('');
  }

  // Kanban settings block — must be at the end
  lines.push('%% kanban:settings');
  lines.push('{"kanban-plugin":"basic","lane-width":280,"show-checkboxes":true}');
  lines.push('%%');

  const output = lines.join('\n');

  // Stats
  const stats = Object.fromEntries(
    COLUMNS.map(c => [c.label, buckets[c.id].length])
  );

  if (DRY_RUN) {
    console.log('[kanban] --dry-run: output preview:\n');
    console.log(output);
    console.log('\n[kanban] Stats:', stats);
    return;
  }

  // Write output
  try {
    writeFileSync(OUTPUT_PATH, output, 'utf-8');
    const timestamp = new Date().toLocaleTimeString('en-CA', { hour12: false });
    console.log(`[${timestamp}] Kanban board generated → ai-context/kanban-board.md`);
    console.log('  Columns:', Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(', '));
  } catch (err) {
    console.error(`[kanban] Failed to write kanban-board.md: ${err.message}`);
  }
}

// ─── WATCH MODE ──────────────────────────────────────────────────────────────

if (WATCH) {
  console.log(`[kanban] Watch mode active — monitoring: ${TASKS_PATH}`);
  console.log('[kanban] Press Ctrl+C to stop.\n');

  // Generate immediately on start
  generate();

  // Watch for changes
  let debounceTimer = null;
  watchFile(TASKS_PATH, { interval: 100 }, (curr, prev) => {
    // Debounce: wait 150ms after last change before regenerating
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (curr.mtime > prev.mtime) {
        generate();
      }
    }, 150);
  });

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n[kanban] Watch mode stopped.');
    process.exit(0);
  });
} else {
  // Single run
  generate();
}
