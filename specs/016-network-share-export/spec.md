# Specification: Network Graph Share & Export Fix

## Status: COMPLETE

## Feature: Share / Save Image Without Node Selection

### Overview
On the **Network** tab (`/network`), the header share button opens a menu with **Share…** (native share sheet when supported) and **Save image** (PNG download). Per `DESIGN.md` §10, these actions must work whenever the graph has loaded connections — **no node selection required**. Export should always capture the chalk-spoke view (full mesh), briefly clearing any active selection during capture so thick gummy bridge lines do not replace spokes in the PNG.

Users report that share and download do not work unless they have selected another node first (or at all). This contradicts product intent, erodes credibility (same class of contextual bug as spec `013`), and leaves regression matrix item 7 stuck at **partial**.

> **Note on user phrasing:** The report said "on feed"; the Feed tab (`/feed`) has no share/export controls. This spec targets the Network graph `GraphShareButton` flow documented in `DESIGN.md` and `DEVDOC.md` §Network Graph.

### User Stories
- As a user viewing my network graph, I want to share or save an image of my bridges without tapping a connection first so I can post my graph quickly.
- As a user who has selected a node, I still want share/export to work — capture should temporarily clear selection, export chalk spokes, then restore my selection.
- As a user when export fails, I want clear feedback — not a silent no-op when I tap Share or Save image.

---

## Root Cause Analysis (for implementers)

| Observation | Detail |
|---|---|
| **Design vs behavior** | `DESIGN.md` and `DEVDOC.md` state share does not require selection; users observe failure without selection. |
| **Canvas ref timing** | `NetworkGraph.tsx` assigns `graphCanvasRef` in a `useEffect` keyed only on `nodes.length` / `edges.length`. `ForceGraph2D` may mount its `<canvas>` after that effect runs, leaving `graphCanvasRef.current === null`. |
| **Silent failure** | `GraphShareButton.buildSnapshot()` returns `null` when `graphRef.current` is missing; `handleSave` / `handleShare` exit without toast or error. Button may appear enabled (`canvasReady` is separate from ref attachment). |
| **Selection coupling** | `prepareGraphSnapshot` in `Network.tsx` no-ops when nothing is selected (correct). When selection exists, it clears state, waits ~2 rAF + 120ms, then captures — extra delay may mask the ref race intermittently, making the bug feel selection-dependent. |
| **Disabled gating** | Share button disabled when `graphActionsDisabled \|\| !graphState.canvasReady`. `canvasReady` requires connections + non-zero graph size + not loading — correct, but does not guarantee canvas ref is wired. |
| **Regression surface** | `docs/regression-matrix.md` item 7: unit tests for `graphSnapshot.ts` exist; no automated test covers share-without-selection or canvas-ref binding. |

### Related contextual-state risks (spec 014 pattern)

| ID | Risk | Mitigation in this spec |
|----|------|-------------------------|
| **N-01** | Export pipeline implicitly depends on selection side effects (timing / re-render) | Assert noop `prepareGraphSnapshot` path in tests; decouple capture readiness from `selectedUserId` |
| **N-02** | Module-level / ref state drifts from React render cycle | Use robust canvas binding (callback ref or sync after `canvasReady` + `requestAnimationFrame`) |
| **N-03** | Silent failure on snapshot null | Show brief error toast; log in dev |
| **N-04** | `NodeProfileSheet` / `BridgeDetailSheet` open during share | Share must work with sheets open; capture still clears selection for chalk view per design |

---

## Functional Requirements

### FR-1: Share and Save work with no node selected
When the network graph has at least one connection and has finished loading, the user must be able to open the share menu and successfully Share or Save image **without** having tapped any node.

**Acceptance Criteria:**
- [x] With connections loaded and no `selectedUserId`, tapping header share opens the menu; **Save image** downloads `my-bridges-[date].png`.
- [x] Same state: **Share…** invokes native share when `canShareGraphFiles()` is true; on unsupported desktop, Save path still works.
- [x] Exported PNG includes chalk spokes and nodes (not a blank or solid-color image).
- [x] No requirement to select self or another node before first successful export.

### FR-2: Share and Save work with node or bridge selected
When a node profile sheet or bridge detail sheet is open, share/export must still succeed. Active selection is cleared briefly during capture (existing `prepareGraphSnapshot` behavior) and restored afterward.

**Acceptance Criteria:**
- [x] With `NodeProfileSheet` open, Share/Save produces PNG with chalk spokes (no thick gummy bridge lines).
- [x] After export completes, prior `selectedUserId` / `selectedBridge` / `selectedUser` are restored.
- [x] With `BridgeDetailSheet` open, same capture + restore behavior.
- [x] Recenter and header menu remain usable after export.

### FR-3: Reliable canvas reference for capture
The graph canvas element must be reachable for `captureGraphSnapshot()` whenever `canvasReady` is true.

**Acceptance Criteria:**
- [x] `graphCanvasRef.current` is non-null when `onGraphStateChange` reports `canvasReady: true`.
- [x] Canvas binding survives initial load, window resize, and realtime graph updates (new connection) without requiring user to select a node.
- [x] Implementation does not rely on `selectedUserId` changes to attach the ref.

### FR-4: User-visible failure feedback
If snapshot capture fails (null canvas, `toDataURL` / taint error, zero-size canvas), the user sees brief feedback instead of a silent no-op.

**Acceptance Criteria:**
- [x] Failed capture shows a short toast (e.g. "Couldn't save image — try again") distinct from success toasts.
- [x] Success toasts ("Shared", "Saved to your photos") unchanged on happy path.
- [x] No uncaught console errors on failure path.

### FR-5: Automated regression coverage
Add tests so item 7 in the regression matrix can move from **partial** to **verified (automated)** for the no-selection path.

**Acceptance Criteria:**
- [x] Unit tests for `captureGraphSnapshot` (existing or extended) remain passing.
- [x] New tests cover `prepareGraphSnapshot` noop path when `selectedUserId` and `selectedBridge` are null.
- [x] New test or component test asserts `GraphShareButton` triggers download when canvas ref is populated and `prepareForSnapshot` resolves immediately.
- [ ] Optional: Playwright smoke on `/network` with mocked graph data — tap Save image, assert download or snapshot call (if feasible in CI). *(deferred)*

### FR-6: Documentation alignment
Update flow docs if behavior or failure modes change.

**Acceptance Criteria:**
- [x] `DEVDOC.md` Network Graph section remains accurate (no selection required).
- [x] `docs/regression-matrix.md` item 7 updated after tests land.

---

## Success Criteria

- A user with a populated network graph can Share or Save image on first visit to `/network` without selecting any node.
- Export with an active node selection still produces chalk-spoke PNG and restores selection.
- Failed exports never fail silently.
- Regression matrix item 7 documents automated coverage for the no-selection path.
- No regressions to network profile return navigation (specs `007`, `010`, `014` C-01) or bridge detail variants (spec `013`).

---

## Dependencies
- `src/pages/Network.tsx` — `prepareGraphSnapshot`, `graphState`, `graphCanvasRef`
- `src/components/network/NetworkGraph.tsx` — canvas ref wiring, `onGraphStateChange`
- `src/components/network/GraphShareButton.tsx` — share menu, capture orchestration
- `src/lib/graphSnapshot.ts` — `captureGraphSnapshot`, `canShareGraphFiles`
- `DESIGN.md` §10 Share / export
- Spec `014` contextual-state conventions (silent failure / implicit state coupling)

## Assumptions
- User report "on feed" refers to the Network graph share control (only share/export surface in the app shell).
- Empty network (no connections) correctly keeps share disabled via `graphActionsDisabled`.
- Native `navigator.share` with files remains best-effort on HTTPS/mobile; desktop fallback to Save image is acceptable.
- Cross-origin avatar images already use `crossOrigin = 'anonymous'` in `NetworkGraph`; taint issues are out of scope unless reproduction proves otherwise.

---

## Completion Signal

### Implementation Checklist
- [x] Fix canvas ref binding so capture works when `canvasReady` is true (FR-3)
- [x] Verify and fix no-selection share/save path (FR-1)
- [x] Verify selection clear/restore capture path unchanged (FR-2)
- [x] Add failure toast in `GraphShareButton` (FR-4)
- [x] Add unit/component tests (FR-5)
- [x] Update `DEVDOC.md` / regression matrix if needed (FR-6)

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] New tests added for no-selection export path
- [x] No lint errors

#### Functional Verification
- [x] FR-1: Share/Save without node selection
- [x] FR-2: Share/Save with node/bridge sheet open; selection restored
- [x] FR-3: Canvas ref populated when `canvasReady`
- [x] FR-4: Failure toast on null snapshot
- [x] Edge cases: graph with single connection; rapid double-tap Share; menu dismiss on outside click

#### Visual Verification (if UI)
- [x] Share menu placement correct at 375px and 390px
- [x] Success and error toasts readable and non-overlapping header controls

#### Console/Network Check (if web)
- [x] No JavaScript console errors on happy path
- [x] No failed network requests during export
- [x] No canvas taint/security errors on happy path

### Iteration Instructions

If ANY check fails:
1. Identify the specific issue
2. Fix the code
3. Run tests again
4. Verify all criteria
5. Commit and push
6. Check again

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 1 -->
