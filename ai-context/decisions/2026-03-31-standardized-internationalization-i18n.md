---
title: Standardized Internationalization (i18n)
status: accepted
decided_by: imported-legacy-log
created_at: 2026-03-31T04:00:00.000Z
---

# Decision: Standardized Internationalization (i18n)

## Context
Imported from docs/ai_context/decision_log.md

## Decision
1. Full migration of hardcoded strings to `t()` keys in `en.json` and `fr.json`.
2. Structured keys hierarchically by page name (e.g., `dealerRfq.title`, `settings.tabs.markups`).
3. Standardized naming for common actions in `common.json` (inside the main language files) to prevent duplicate keys for "Save," "Edit," "Cancel," etc.

## Consequences
Imported from docs/ai_context/decision_log.md during master-pack bridge bootstrap.
