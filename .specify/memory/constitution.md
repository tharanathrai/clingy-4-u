# Sticky Bridges Constitution

> Sticky Bridges is a mobile-first PWA that helps people make and keep real-life plans together. Every plan is a piece of gum; every completed plan forms a permanent bridge between two people. The app records time spent together — not content consumed or followers gained. Design principle: **more friction on creation, zero friction on connection.**

**Ralph Wiggum version:** `3f15f0fb83b8c2e0ac8d11abdae0e83ab8204981`  
**Created:** 2026-06-11

---

## Context Detection

**Ralph Loop Mode** (Cursor `/ralph-loop` or `/speckit.implement`):
- Requires Cursor Ralph Loop plugin: `/add-plugin ralph-loop`
- Pick highest priority incomplete spec from `specs/` (or task from `IMPLEMENTATION_PLAN.md` if it exists)
- Read project docs before coding: `PRD.md`, `DESIGN.md`, `DEVDOC.md`, `.cursor/rules`, `RALPH_PROMPT.md`
- Implement, test, commit, push
- Update `DEVDOC.md` after each spec
- Output `<promise>DONE</promise>` only when 100% complete
- Output `<promise>ALL_DONE</promise>` when no work remains
- Stop loop: `/cancel-ralph`

**Interactive Mode** (normal Cursor conversation):
- Be helpful, guide decisions, create specs with `/speckit.specify`
- Do not commit unless the user explicitly asks

**Note:** `scripts/ralph-loop*.sh` require Claude Code / Codex CLI — not used in this project.

---

## Core Principles

1. **Real connection over engagement** — Plans require mutual acceptance; completion requires physical presence. Reward consistency, not volume.
2. **Physical, alive, simple** — UI feels tactile and glossy (DESIGN.md). One primary action per screen. Empty states invite; never cold system language.
3. **Production quality always** — Every page: loading, error, empty, and happy path. Edge functions: JWT validation, input validation, consistent `{ error, code }` responses. RLS on every table. Run `npm run quality` before signaling done.

---

## Technical Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| Data | TanStack React Query (optimistic updates, manual invalidation) |
| Backend | Supabase (Auth, PostgreSQL, Realtime, Edge Functions, Storage) |
| Graph | `react-force-graph-2d` |
| Mobile | Capacitor (v2+) |
| Deploy | Vercel (web) |
| Tests | Vitest (unit), Playwright (E2E) |

Quality gate: `npm run quality` (= typecheck + lint + test + build)

---

## Autonomy

YOLO Mode: **ENABLED**  
Git Autonomy: **ENABLED** (Ralph loop only — commit and push after each completed spec)

Commit messages: concise, focus on why. Never commit secrets (`.env`, credentials).

---

## Specs

Specs live in `specs/NNN-feature-name/spec.md`. Pick the highest priority incomplete spec (lower number = higher priority). A spec is incomplete if it lacks `## Status: COMPLETE`.

Spec template: `templates/spec-template.md`  
Checklist template: `templates/checklist-template.md`

When all specs are complete, re-verify a random one before signaling `<promise>ALL_DONE</promise>`.

Existing product docs (`PRD.md`, `BACKLOG.md`) are reference material — translate work into numbered specs before Ralph picks them up.

---

## NR_OF_TRIES

Track attempts per spec via `<!-- NR_OF_TRIES: N -->` at the bottom of the spec file. Increment each attempt. At 10+, the spec is too hard — split it into smaller specs.

---

## History

Append a 1-line summary to `history.md` after each spec completion. For details, create `history/YYYY-MM-DD--spec-name.md` with lessons learned, decisions made, and issues encountered. Check history before starting work on any spec.

---

## Completion Logs

After each spec, create `completion_log/YYYY-MM-DD--HH-MM-SS--spec-name.md` with a brief summary of what was built and verified.

---

## Completion Signal

All acceptance criteria verified, `npm run quality` passes, changes committed and pushed, `DEVDOC.md` updated → output `<promise>DONE</promise>`. Never output this until truly complete.
