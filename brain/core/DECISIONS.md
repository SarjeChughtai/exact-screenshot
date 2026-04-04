# Project Decisions

This file documents the "why" behind significant architectural and logic choices for the Canada Steel Platform.

> [!NOTE]
> This file is a continuation of the legacy decision log found at `docs/ai_context/decision_log.md`.

## 🏗️ Architectural Decisions

### Mar 31, 2026: Refactor Dealer Onboarding Flow
**Context**: Dealers were previously forced to complete their profile before accessing any other page.

**Decisions**:
1. **Removed Redirection**: Replaced global `useEffect` redirects in `DealerLog` and `DealerRFQ` with a non-intrusive `DealerOnboardingPrompt` banner.
2. **Auto-Generated Client IDs**: To reduce friction, Client IDs are now automatically generated (`DLR-XXXX`) upon the first profile save if one doesn't exist.
3. **Restricted Client ID Edits**: To prevent accidental changes, dealers' access to the `clientId` field is read-only.
4. **Admin Overrides**: Admins/Owners were given a dedicated `DealerManagement` tab in Settings to oversee all dealer profiles and manually override Client IDs when necessary.
5. **Session-Based Dismissal**: The onboarding banner is dismissible for the current session via `localStorage` ('csb_onboarding_dismissed') to balance guidance with user freedom.

### Mar 31, 2026: Standardized Internationalization (i18n)
**Decisions**:
1. Full migration of hardcoded strings to `t()` keys in `en.json` and `fr.json`.
2. Structured keys hierarchically by page name (e.g., `dealerRfq.title`, `settings.tabs.markups`).
3. Standardized naming for common actions in `common.json` (inside the main language files) to prevent duplicate keys for "Save," "Edit," "Cancel," etc.

---

## 🧠 Brain System Decisions

### Apr 2, 2026: Implementation of Tool-Agnostic Agent Memory
**Context**: Need for a shared memory system that works across Antigravity, Cursor, Copilot, and Obsidian.

**Decisions**:
1. **File-Based Memory**: Use `/brain` as the operational layer for AI context.
2. **Cross-Tool Instructions**: Create standardized `AGENTS.md`, `CLAUDE.md`, and `.cursorrules` to ensure all tools respect the same memory system.
3. **Obsidian Integration**: Design the structure to be compatible with Obsidian, recommending the repo root as the vault.
4. **Operational Rules**: Enforce strict read/update orders for all agents to maintain consistency.
