# clingy

Mobile-first PWA for making real-life plans with people you care about. Every plan is a piece of gum; every completed plan forms a permanent bridge in your network graph.

**Live:** https://clingy-4-u.vercel.app/

## Product docs

| Document | Purpose |
|---|---|
| [PRD.md](./PRD.md) | Product requirements, data model, flows, edge functions |
| [DESIGN.md](./DESIGN.md) | Design system, tokens, copy, component specs |
| [DEVDOC.md](./DEVDOC.md) | Implementation status per flow, architecture decisions, known issues |
| [BACKLOG.md](./BACKLOG.md) | UX follow-ups from live testing |
| [AGENTS.md](./AGENTS.md) | Agent workflow entry point |

## Stack

- React 19 + Vite + TypeScript + Tailwind CSS v4
- TanStack React Query + Supabase (Auth, Postgres, Realtime, Edge Functions, Storage)
- `react-force-graph-2d` for the network graph
- Vitest + Playwright for tests

## Development

```bash
npm install
npm run dev          # local dev server
npm run quality      # typecheck + lint + test + build
npm run test:e2e     # Playwright smoke tests
```

### Environment

Create `.env.local`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Supabase edge functions require secrets (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, service role key) configured in the Supabase dashboard — not in the client.

## Spec-driven workflow

Numbered specs live in `specs/`. Agent instructions: `.specify/memory/constitution.md` and [RALPH_PROMPT.md](./RALPH_PROMPT.md).

Quality bar before shipping any change: `npm run quality` passes, four UI states handled (loading, error, empty, happy path), `DEVDOC.md` updated.
