# Canada Steel Buildings Platform

**Internal operations platform for Canada Steel Buildings** — a steel building broker managing quoting, deal tracking, production, payments, freight, and commissions across Canada.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite 5
- **Styling**: Tailwind CSS 3 + shadcn/ui components
- **Routing**: React Router DOM 6
- **State**: React Context (localStorage persistence)
- **Charts**: Recharts
- **PDF Parsing**: pdfjs-dist 4.4.168
- **Other**: TanStack React Query, date-fns, Sonner (toasts)

## Getting Started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Folder Structure

| Path | Contents |
|------|----------|
| `src/pages/` | 17 page components, one per route |
| `src/components/` | Layout, NavLink, AppSidebar, and shadcn/ui primitives |
| `src/lib/` | `calculations.ts` (pricing engine), `freightEstimate.ts` (postal code lookup), `utils.ts` |
| `src/data/` | `referenceData.json` (143 MBS projects, 48 insulation quotes, tax rates, freight logic), `seedDeals.ts` (8 real deals) |
| `src/context/` | `AppContext.tsx` (state), `RoleContext.tsx` (RBAC), `SettingsContext.tsx` (config) |
| `src/types/` | `index.ts` — all TypeScript interfaces and type unions |

## Documentation

- [Architecture](./ARCHITECTURE.md) — state management, data flow, role system, routing
- [Data Model](./DATA_MODEL.md) — every type, field, and relationship
- [Reference Data](./REFERENCE_DATA.md) — steel tiers, insulation, foundation, taxes, freight, markups, commissions
- [Calculations](./CALCULATIONS.md) — every function in the pricing engine with formulas and examples
- [Pages](./PAGES.md) — every page, its route, purpose, data reads/writes, and user actions
- [Business Rules](./BUSINESS_RULES.md) — plain English explanation of all pricing, tax, commission, and access rules
- [Changelog](./CHANGELOG.md) — version history
