# Agent Instructions

**Read:** `.specify/memory/constitution.md`

That file is your source of truth for this project.

For clingy, also read before implementing:
- `PRD.md` — product requirements
- `DESIGN.md` — design system and copy
- `DEVDOC.md` — flow status and regression surface
- `.cursor/rules` — quality bar and coding standards
- `RALPH_PROMPT.md` — Ralph loop workflow

## Analytics insight loop

Anonymized usage analytics live in `supabase/migrations/2026061910*/2026061911*`, the
`track-events` edge function, and `src/lib/analytics.ts`. To turn data into prioritized
backlog items (harness-agnostic), follow `docs/ANALYTICS_LOOP.md` and
`specs/analytics-insight-loop.md`.

## Cursor workflow (no CLI)

| Step | Command |
|------|---------|
| Create spec | `/speckit.specify [feature description]` |
| Implement | `/speckit.implement` or `/ralph` |
| Start loop | `Start a ralph loop: "..." --completion-promise "DONE" --max-iterations 30` |
| Stop loop | `/cancel-ralph` |

One-time setup: `/add-plugin ralph-loop`
