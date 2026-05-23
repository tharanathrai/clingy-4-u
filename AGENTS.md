# Clingy 4 U — Codex Agent Instructions
# Read PRD.md and DESIGN.md before writing any code.

## What this project is
Clingy 4 U (working title: Sticky Bridges) is a mobile-first PWA. People make plans together, each plan is a piece of gum, completing a plan IRL forms a permanent bridge between two people. The network of bridges is visualized as a physics-based graph.

## Stack
- React + Vite + TypeScript (strict mode)
- Tailwind CSS — use only tokens defined in tailwind.config.js
- Supabase — auth, database, realtime, edge functions
- react-force-graph-2d — network graph
- Lucide React — icons
- Vercel — deployment

## Commands to know
- `npm run dev` — dev server
- `npm run build` — production build  
- `npm run typecheck` — TypeScript check (run after every set of changes)
- `npm run lint` — ESLint
- `npm run test` — Vitest unit tests (37+ tests, must all pass)
- `npm run quality` — **full gate: typecheck + lint + test + build** — run before marking any work done

## Key conventions

**TypeScript:** Strict mode. No `any`. No `@ts-ignore`. Props interfaces above every component. Named exports for components, default exports for pages.

**Components:** Functional only. Data fetching in custom hooks (`src/hooks/`), not components. Every async action needs loading + error states. Every screen needs an empty state.

**Styling:** Tailwind only — no inline styles, no arbitrary values. Mobile-first (390px base). CSS variables from DESIGN.md for anything not in Tailwind config.

**Supabase:** All DB calls via typed client. RLS enabled on all tables — never disable. Never expose service role key to client. Edge functions in `supabase/functions/`.

**Categories:** Always import from `src/lib/constants.ts`. Never hardcode category colors or slugs inline.

**Gum pieces:** Shape randomized at creation, stored in DB, never re-randomized. Color derived from category. `gum-body` SVG layer uses `fill="var(--gum-color)"`.

**Slot limits:** Enforced server-side only in edge functions. Global: 25 per user. Per-pair: 5. Client shows count, never enforces.

## File structure
```
src/
  assets/gum/        ← SVG shape assets
  components/
    ui/              ← Button, Card, Tag, Input, BottomSheet
    gum/             ← GumPiece, GumPocket, GumBall
    network/         ← NetworkGraph, BridgeDetail
    feed/            ← PostCard, CommentList
    layout/          ← Layout, BottomTabBar, PageHeader
  pages/             ← one file per route
  hooks/             ← useAuth, useGumPieces, useConnections etc.
  lib/
    supabase.ts
    categorizer.ts
    constants.ts
  types/
  utils/
```

## Categories and colors
```ts
// src/lib/constants.ts
export const CATEGORIES = {
  intimate:  { label: 'Intimate',  color: '#CF8EE8' },
  active:    { label: 'Active',    color: '#7DD47A' },
  playful:   { label: 'Playful',   color: '#F07868' },
  explore:   { label: 'Explore',   color: '#6DB8F0' },
  recharge:  { label: 'Recharge',  color: '#82C9A0' },
  savor:     { label: 'Savor',     color: '#F0A84A' },
  support:   { label: 'Support',   color: '#E89AA8' },
} as const;

export const GUM_SHAPES = [
  'gum-strip',
  'gum-ball', 
  'gum-chiclet',
  'gum-block',
  'gum-blob',
] as const;
```

## Realtime subscriptions
Use `subscribePostgresChannel()` from `src/lib/realtime.ts` for every Supabase postgres_changes subscription.
Never call `supabase.channel()` directly. This prevents the "cannot add callbacks after subscribe()" bug.

## Query keys
Use `queryKeys.*` from `src/lib/queryKeys.ts` for every React Query key.
Never inline `['key', userId]` arrays — use the registry.

## Cross-flow cache invalidation
Use helpers from `src/lib/invalidate.ts` for multi-query invalidations (e.g. accepting a connection).

## Auth / onboarding
Call `markProfileReady(userId, queryClient)` from `src/hooks/useProfileReady.ts` after successful onboarding.
Never mutate the `profileReadyCache` Map (it no longer exists).

## Quality gate
`npm run quality` must pass before marking any work done.
DEVDOC.md flows must be marked `Verified (automated)` or `Verified (manual)` — never just "Working" without evidence.
Add a row to `docs/regression-matrix.md` for every session.

## Session workflow
Follow `docs/AGENT_SESSION.md` for the role-based session checklist.

## Hard rules
- No features outside PRD.md — add ideas to BACKLOG.md
- No console.log in committed code
- No localStorage for sensitive data
- No schema changes without updating PRD.md
- Always handle loading, error, and empty states
- Always use safe-area-inset-bottom on bottom-fixed elements
