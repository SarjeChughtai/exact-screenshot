# Canada Steel Buildings Platform

Internal operations platform for Canada Steel Buildings - a steel building broker managing quoting, deal tracking, production, payments, freight, and commissions across Canada.

## Tech Stack

- Framework: React 18 + TypeScript
- Build: Vite 5
- Styling: Tailwind CSS 3 + shadcn/ui components
- Routing: React Router DOM 6
- State: React Context with localStorage persistence
- Charts: Recharts
- PDF Parsing: pdfjs-dist 4.4.168
- Other: TanStack React Query, date-fns, Sonner

## Getting Started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Folder Structure

| Path | Contents |
|------|----------|
| `src/pages/` | Page components, one per route |
| `src/components/` | Layout, navigation, shared UI, and shadcn primitives |
| `src/lib/` | Calculation, parsing, workflow, and storage helpers |
| `src/data/` | Reference data and seeds |
| `src/context/` | App state, auth, role, and settings contexts |
| `src/types/` | Shared TypeScript interfaces and unions |

## Documentation

- [Architecture](./ARCHITECTURE.md) - state management, data flow, role system, and routing
- [Data Model](./DATA_MODEL.md) - types, fields, and relationships
- [Reference Data](./REFERENCE_DATA.md) - pricing, insulation, taxes, freight, markups, and commissions
- [Calculations](./CALCULATIONS.md) - pricing engine formulas and examples
- [Pages](./PAGES.md) - route-by-route behavior and page responsibilities
- [Business Rules](./BUSINESS_RULES.md) - pricing, tax, commission, and access rules
- [Changelog](./CHANGELOG.md) - engineering history
- [Portal Tool User Manual](./TOOL_USER_MANUAL.md) - operator-facing guide for the live tools
- [Tool Change Log](./TOOL_CHANGE_LOG.md) - practical record of workflow and tool behavior changes
- [Department Manual Index](./manuals/INDEX.md) - role-based guides for sales, estimating, operations, accounting, freight, dealer, vendor/manufacturer, and admin/owner
