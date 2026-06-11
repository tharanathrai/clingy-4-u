---
description: Start Ralph Wiggum loop for the highest-priority incomplete spec (Cursor-only)
---

## User Input

```text
$ARGUMENTS
```

## Prerequisites

Install the Cursor Ralph Loop plugin once:
```
/add-plugin ralph-loop
```

## Start loop

If `$ARGUMENTS` is provided, use it as the spec name. Otherwise pick the highest-priority incomplete spec from `specs/`.

Tell the user to paste this into chat:

```
Start a ralph loop: "Implement spec {SPEC_NAME} from specs/{SPEC_NAME}/spec.md.

Read .specify/memory/constitution.md, PRD.md, DESIGN.md, DEVDOC.md, and .cursor/rules.
Complete ALL Completion Signal items. Run npm run quality. Update DEVDOC.md and history.md.
Commit and push when done.

Output <promise>DONE</promise> only when 100% verified." --completion-promise "DONE" --max-iterations 30
```

Replace `{SPEC_NAME}` with the actual spec folder name (e.g. `001-graph-share-preset`).

## Stop

```
/cancel-ralph
```

## Help

```
/ralph-loop-help
```
