---
title: Refactor Dealer Onboarding Flow
status: accepted
decided_by: imported-legacy-log
created_at: 2026-03-31T04:00:00.000Z
---

# Decision: Refactor Dealer Onboarding Flow

## Context
Dealers were previously forced to complete their profile before accessing any other page.

## Decision
1. **Removed Redirection**: Replaced global `useEffect` redirects in `DealerLog` and `DealerRFQ` with a non-intrusive `DealerOnboardingPrompt` banner.
2. **Auto-Generated Client IDs**: To reduce friction, Client IDs are now automatically generated (`DLR-XXXX`) upon the first profile save if one doesn't exist.
3. **Restricted Client ID Edits**: To prevent accidental changes, dealers' access to the `clientId` field is read-only.
4. **Admin Overrides**: Admins/Owners were given a dedicated `DealerManagement` tab in Settings to oversee all dealer profiles and manually override Client IDs when necessary.
5. **Session-Based Dismissal**: The onboarding banner is dismissible for the current session via `localStorage` ('csb_onboarding_dismissed') to balance guidance with user freedom.

---

## Consequences
Imported from docs/ai_context/decision_log.md during master-pack bridge bootstrap.
