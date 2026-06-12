# Specification: Social Share Export

## Feature: Social-First Network Graph Export

### Overview
Today, share and save on the network graph produce a raw 2× canvas snapshot: chalk-spoke mesh on a square `#12101A` background, no branding, no readable labels at thumbnail size, and no framing tuned for how people actually post (Instagram feed, Stories, iMessage, X). BACKLOG item #1 and PRD §9 defer a "social-first preset" beyond the basic export.

This spec defines a **social share card** treatment layered on top of the existing graph capture so exported images feel intentional, on-brand, and worth posting — without turning Sticky Bridges into a growth-hack billboard. The graph remains the hero; the frame adds context, legibility, and a subtle invitation for viewers who do not know the app.

**In scope:** Export/share image composition (layout, typography, branding, stats, aspect presets), preview before share (optional lightweight), updated DESIGN.md / PRD export notes, tests for composition logic.

**Out of scope:** Animated/video export, per-bridge story cards, feed post image export, server-side image generation, paid watermark removal, user-customizable templates.

### User Stories
- As a user proud of my bridges, I want a share image that looks designed — not a screenshot — so I feel good posting it to Instagram or sending it to friends.
- As a user sharing to Stories or DMs, I want the graph readable at phone thumbnail size so people can see who I am connected to without squinting.
- As a recipient who does not use Sticky Bridges, I want enough context on the image (app name, what bridges mean) to understand what I am looking at without opening a link.
- As a user saving the image, I want a filename and dimensions that work in my camera roll and photo apps without awkward cropping.

---

## Current Baseline (Reference)

| Aspect | Today | Gap |
|--------|-------|-----|
| Capture | Direct canvas snapshot at 2×, chalk-spoke view (selection cleared) | No post-processing frame |
| Canvas shape | Square (`max(w,h)`) | Social feeds favor 4:5 or 9:16; square crops awkwardly |
| Branding | None | No app identity; looks like internal debug capture |
| Legibility | Node labels only at in-app zoom | Illegible in IG grid / iMessage preview |
| Context | Graph only | Viewer cannot tell bridge count, categories, or what app this is |
| Texture | In-app grain not in export | Export feels flatter than the live app |

---

## Design Direction: Social Share Card

### Principle
**Graph is hero, frame is whisper.** The export should feel like a premium dark-mode poster from DESIGN.md — glossy, grainy, alive — not a marketing flyer. One stat line max. No QR codes in MVP.

### Recommended MVP layout — "Bridge Constellation Card"

```
┌─────────────────────────────────────┐
│  ░░░ subtle radial glow (accent) ░░░ │
│                                     │
│         [ graph — centered ]        │
│      chalk spokes, larger scale     │
│      optional first-name labels     │
│                                     │
│  ─────────────────────────────────  │
│  Bagel Fat One: "my bridges"        │
│  DM Sans meta: "8 people · 12 bridges" │
│  wordmark + tiny tagline              │
└─────────────────────────────────────┘
```

**Visual elements (MVP):**

1. **Aspect preset — 4:5 portrait (1080×1350)**  
   Default export for share/save. Fits Instagram feed and most phone screens without letterboxing. Square (1080×1080) as secondary "Save square" option in share menu is stretch, not MVP.

2. **Safe margins**  
   48px outer padding at 1080px width; graph content inset so IG circular crop on avatars in grid does not clip the viewer's node. Critical nodes (self + top 3 by bridge count) kept inside central 80% "safe zone."

3. **Graph re-framing for export**  
   Dedicated export camera pass: zoom-to-fit all nodes with extra padding (~1.25× current fit), temporarily scale node radii +25% and label font +2px for capture only (restore after). Matches BACKLOG social-first preset intent without changing in-app graph scale.

4. **Header glow**  
   Soft radial gradient behind graph using viewer's dominant bridge category color (`--color-glow` pattern from DESIGN.md §11). Opacity low enough that graph edges stay crisp.

5. **Footer band**  
   Fixed-height footer (~18% of card height) with `--color-surface` at 85% opacity over bg, subtle top border `--color-border`. Contents:
   - Title: **"my bridges"** — Bagel Fat One, `--text-heading` scale
   - Stat line: **"{N} people · {M} bridges"** — DM Sans meta, humanized counts
   - Wordmark: **Sticky Bridges** + micro tagline: *"time spent together"* (sentence case, tertiary text)

6. **Grain overlay**  
   Apply same SVG noise texture as app root (DESIGN.md §11) at export resolution so PNG matches in-app tactility.

7. **Filename**  
   Keep `my-bridges-YYYY-MM-DD.png`; no change required for MVP.

### Alternative concepts (document for future specs — implement one MVP only)

| Concept | Hook | Best for | Risk |
|---------|------|----------|------|
| **A. Constellation Card** (recommended MVP) | Clean poster + stats | IG feed, iMessage | Safe; may feel static |
| **B. Spotlight Card** | Highlights one selected friend + bridge count between you two | "Look who I see" posts | Needs selection UX; conflicts with "no selection required" unless optional |
| **C. Category Spectrum** | Horizontal strip of category chips with % under graph | Users with diverse bridge types | Busy; harder at small size |
| **D. Stories Tall (9:16)** | Graph top two-thirds, bold stat + CTA bottom third | IG/TikTok Stories | More vertical dead space if network is small |
| **E. Minimal Watermark** | Graph only + small corner wordmark | Users who hate overlays | Least context for virality |

**MVP picks Concept A.** Concept B may ship as optional "Share with [name]" when a node is selected (stretch).

### Virality levers (without violating product ethos)

- **Curiosity gap:** Tagline *"time spent together"* implies a story without explaining the full product — invites "what app is this?"
- **Social proof without vanity:** Show bridge *count* and *people count*, not follower counts or streaks (aligned with PRD §10).
- **Color identity:** Dominant-category glow makes each export visually unique — users recognize *their* palette in the grid.
- **Name labels on closest connections:** First names (not usernames) on the 3–5 nearest nodes increase personal recognition when friends see the post ("that's me!").
- **No link / QR in MVP:** Reduces spammy feel; recipients discover via caption or bio. Revisit if attribution data shows need.

### Accessibility & legibility checks

- Footer text contrast ≥ 4.5:1 against footer band (WCAG AA).
- Graph labels: minimum 11px equivalent at 1080px width after scaling.
- Do not rely on color alone for category meaning in the export frame (stats are numeric).

---

## Functional Requirements

### FR-1: Social share card composition
Export and share flows must produce a composed PNG using the Bridge Constellation Card layout instead of a raw centered canvas square.

**Acceptance Criteria:**
- [ ] Share and Save image both use the social card composer (shared code path).
- [ ] Default output dimensions: 1080×1350 (4:5).
- [ ] Background `#12101A`; footer uses design-system surface/border tokens.
- [ ] Graph occupies upper portion; footer band shows title, stat line, wordmark, and tagline per layout above.
- [ ] Grain overlay applied to final composite.
- [ ] Existing behavior preserved: chalk-spoke view only; active node selection cleared during capture.

### FR-2: Export-optimized graph framing
The capture path must temporarily adjust graph presentation for legibility without changing the live in-app view after share completes.

**Acceptance Criteria:**
- [ ] Export uses zoom-to-fit all nodes with increased padding vs default in-app fit.
- [ ] Node radii and label size boosted only during snapshot (restored in `finally`).
- [ ] Viewer node remains visually central (accent ring visible).
- [ ] Works with 0 bridges (solo node), 1 connection, and 20+ nodes without layout overflow or clipped labels.
- [ ] First-name labels on up to 5 nearest nodes (by bridge count); usernames never shown on export.

### FR-3: Dynamic stats footer
Footer copy reflects the user's actual network data at capture time.

**Acceptance Criteria:**
- [ ] Stat line format: `"{peopleCount} people · {bridgeCount} bridges"` with correct pluralization (`1 person`, `1 bridge`).
- [ ] `peopleCount` = unique users with ≥1 bridge to viewer; `bridgeCount` = total confirmed bridges (matches profile gumball logic).
- [ ] Empty network: `0 people · 0 bridges` — export still succeeds (solo constellation).
- [ ] Title remains **"my bridges"** (sentence case, possessive — viewer's graph).

### FR-4: Dominant-category ambient glow
Export background includes a subtle category-colored glow derived from the viewer's bridge distribution.

**Acceptance Criteria:**
- [ ] Glow color = majority category by bridge count; tie-break by category order in `constants.ts`.
- [ ] Glow is radial, centered on graph area, opacity ≤ 15% — graph edges remain readable.
- [ ] User with no bridges: fallback to `--color-accent` glow at ≤ 10% opacity.

### FR-5: Share menu unchanged; quality upgraded
No regression to share/save availability or native share sheet behavior.

**Acceptance Criteria:**
- [ ] Share button enabled whenever graph has loaded (no node selection required) — per PRD §9 / DESIGN.md §10.
- [ ] Native `navigator.share` with PNG file when supported; Save image fallback unchanged.
- [ ] Toast copy unchanged ("Shared" / "Saved to your photos").
- [ ] File type remains PNG; filename pattern `my-bridges-YYYY-MM-DD.png`.

### FR-6: Design doc sync
Product and design docs reflect the new export treatment.

**Acceptance Criteria:**
- [ ] `DESIGN.md` §Network graph "Share / export" updated with card layout, 4:5 default, and export-only scale rules.
- [ ] `PRD.md` §9 export bullet updated; BACKLOG #1 marked addressed or narrowed to stretch items (9:16 preset, spotlight variant).
- [ ] `DEVDOC.md` notes export pipeline entry point (`graphSnapshot` / composer module).

---

## Stretch (Out of MVP — do not block completion)

- Secondary **Square 1080×1080** menu item.
- **Stories 1080×1920** preset.
- **Spotlight Card** when a node is selected ("me & {firstName} — {n} bridges").
- Optional **preview sheet** before share (thumbnail + Share / Save).
- Category chip strip under graph (Concept C).

---

## Success Criteria

- Exported image is legible when viewed at ~150px width (typical IG grid thumbnail): footer text readable, viewer node identifiable.
- Users can share or save without selecting a node; flow completes in ≤ 3 taps (open menu → Share or Save image → done).
- Visual QA: side-by-side with in-app graph, export feels richer (grain, glow, footer) not like a raw screenshot.
- No increase in share/save failure rate vs current export (measure by absence of new console errors / empty blob returns in manual regression).
- `npm run quality` passes with unit tests covering stat formatting, pluralization, and composer output dimensions.

---

## Dependencies
- Existing `GraphShareButton`, `captureGraphSnapshot`, and `prepareForSnapshot` flow in `Network.tsx` / `NetworkGraph.tsx`.
- Network graph data hook for people/bridge counts and per-link bridge counts.
- DESIGN.md tokens: colors, typography, grain overlay asset/pattern.
- Specs affecting share availability (no node selection gate) must not regress.

## Assumptions
- Canvas-based composition (extend `graphSnapshot` or sibling module) is sufficient for MVP; no server rendering.
- Google Fonts (Bagel Fat One, DM Sans) are loaded in the app before export — composer may use `document.fonts.ready` or equivalent before drawing text.
- First-name derivation uses existing display name / username split already used in profile UI.
- English copy only for MVP; i18n deferred.

---

## Completion Signal

### Implementation Checklist
- [ ] Implement `composeSocialShareCard` (or equivalent) module: graph bitmap in, styled PNG out at 1080×1350.
- [ ] Wire composer into `GraphShareButton` build path (replace raw `captureGraphSnapshot` output).
- [ ] Add export-only graph scale/framing in `prepareForSnapshot` callback.
- [ ] Unit tests: stat line, pluralization, dimensions, empty network, dominant category selection.
- [ ] Update `DESIGN.md`, `PRD.md`, `DEVDOC.md`, `BACKLOG.md`.
- [ ] Manual visual check: desktop + mobile share and save.

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] New tests added for composer stats, layout constants, and edge cases (0 bridges, 1 person)
- [ ] No lint errors

#### Functional Verification
- [ ] All acceptance criteria verified
- [ ] Share works with no node selected
- [ ] Save image downloads composed PNG
- [ ] Selection cleared during capture; restored after
- [ ] Large and small networks both produce valid images

#### Visual Verification (if UI)
- [ ] 4:5 export matches DESIGN.md tokens (colors, fonts, grain)
- [ ] Footer readable at thumbnail scale (screenshot scaled to 150px width in devtools)
- [ ] Glow subtle, not muddy
- [ ] Mobile share sheet receives correct file

#### Console/Network Check (if web)
- [ ] No JavaScript console errors during share/save
- [ ] No failed network requests triggered by export
- [ ] No 4xx or 5xx errors

### Iteration Instructions

If ANY check fails:
1. Identify the specific issue
2. Fix the code
3. Run tests again
4. Verify all criteria
5. Commit and push
6. Check again

**Only when ALL checks pass, output:** `<promise>DONE</promise>`

<!-- NR_OF_TRIES: 0 -->
