# Ralph Wiggum Master Prompt: Sticky Bridges

## Your Mission

Implement specifications in `specs/`, one at a time, until each spec's acceptance criteria and Completion Signal pass. Work autonomously in Cursor — run tests, fix failures, iterate.

## Context Files (Read First)

1. `.specify/memory/constitution.md` — Core principles and workflow
2. `PRD.md` — Product requirements
3. `DESIGN.md` — Design system and copy
4. `DEVDOC.md` — Flow status and regression surface
5. `.cursor/rules` — Quality bar and coding standards
6. `AGENTS.md` — Agent entry point
7. `history.md` — Prior work (check before starting)

## Process

For each incomplete spec in `specs/` (lowest number first):

1. **Read the spec** — Understand acceptance criteria and Completion Signal
2. **Implement** — Follow constitution and project rules
3. **Verify** — Run `npm run quality` (typecheck + lint + test + build)
4. **Update docs** — `DEVDOC.md`, `history.md`, completion log per constitution
5. **Commit and push** — Meaningful commit message when spec is done

## Per-Spec Completion

Output `<promise>DONE</promise>` only when:
- All acceptance criteria verified
- `npm run quality` passes
- `DEVDOC.md` updated
- Changes committed and pushed

## Master Completion

When ALL specs have `## Status: COMPLETE`:

```
<promise>ALL_DONE</promise>
```

## Error Handling

- If stuck after 5 iterations on the same issue, document the blocker in the spec
- At 10+ attempts (NR_OF_TRIES), split the spec into smaller specs
- Never output the completion promise until criteria are truly met

## Cursor Loop

Start via chat (requires `/add-plugin ralph-loop`):

```
Start a ralph loop: "Implement the highest-priority incomplete spec from specs/. Follow RALPH_PROMPT.md." --completion-promise "DONE" --max-iterations 30
```

Stop: `/cancel-ralph`
