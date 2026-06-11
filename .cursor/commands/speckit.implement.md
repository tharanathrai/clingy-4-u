---
description: Implement specs using Ralph Wiggum loop in Cursor (no CLI required)
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Prerequisites

1. **Cursor Ralph Loop plugin** installed (one-time):
   ```
   /add-plugin ralph-loop
   ```

2. **At least one spec** in `specs/` with a Completion Signal section

3. **Context files** (read before implementing):
   - `.specify/memory/constitution.md`
   - `PRD.md`, `DESIGN.md`, `DEVDOC.md`, `.cursor/rules`
   - `AGENTS.md`

## Execution

### Option A: Single spec

If `$ARGUMENTS` names a spec (e.g. `001-user-auth`), tell the user to run:

```
Start a ralph loop: "Implement spec $ARGUMENTS from specs/$ARGUMENTS/spec.md.

Read .specify/memory/constitution.md, PRD.md, DESIGN.md, DEVDOC.md, and .cursor/rules first.
Complete ALL items in the spec's Completion Signal section.
Run npm run quality. Update DEVDOC.md.
Commit and push when done.

Output <promise>DONE</promise> only when 100% verified." --completion-promise "DONE" --max-iterations 30
```

### Option B: Highest-priority spec (default)

If `$ARGUMENTS` is empty, pick the highest-priority incomplete spec from `specs/` and tell the user to run:

```
Start a ralph loop: "Find the highest-priority incomplete spec in specs/ (lowest number without ## Status: COMPLETE).
Implement it fully from its spec.md.

Read .specify/memory/constitution.md, PRD.md, DESIGN.md, DEVDOC.md, and .cursor/rules first.
Complete ALL items in the Completion Signal section.
Run npm run quality. Update DEVDOC.md and history.md.
Commit and push when done.

Output <promise>DONE</promise> only when 100% verified." --completion-promise "DONE" --max-iterations 30
```

### Option C: All specs

```
Start a ralph loop: "Work through all incomplete specs in specs/ in numerical order.
For each: implement, verify Completion Signal, run npm run quality, update DEVDOC.md and history.md, commit and push.

Read .specify/memory/constitution.md, PRD.md, DESIGN.md, DEVDOC.md, and .cursor/rules first.

Output <promise>ALL_DONE</promise> when every spec has ## Status: COMPLETE." --completion-promise "ALL_DONE" --max-iterations 100
```

## Stop the loop

```
/cancel-ralph
```

## If the Ralph Loop plugin is not installed

Implement manually in this session:
1. Read `RALPH_PROMPT.md` and the highest-priority incomplete spec
2. Implement until all Completion Signal items pass
3. Run `npm run quality`
4. Update `DEVDOC.md` and `history.md`
5. Do not output `<promise>DONE</promise>` until truly complete
