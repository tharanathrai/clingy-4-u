# Specification: Liquid Metal UI Evolution

## Status: COMPLETE

## Feature: 3D Liquid Metal Visual Identity & Surface Refresh

### Overview
Sticky Bridges already aims to feel **physical, glossy, and alive** (`DESIGN.md` §1). The current MVP delivers this primarily through flat CSS morph blobs, grain overlay, and soft radial glows. Users should experience a **fresh, new-age** product that leans into **stickiness, fluids, and liquid-metal tactility** — surfaces that look poured, stretched, and caught in light rather than flat cards on a dark background.

This spec evolves the visual language and branding across the app shell and hero surfaces while preserving retention-critical rules (one primary action per screen, readable contrast, reduced-motion support, mobile-first performance). It updates `DESIGN.md` to v0.3 with the new material system and rolls the treatment through the highest-visibility touchpoints first, then shared components.

**In scope:** Design-system definition, token/CSS foundation, hero-surface visuals (gum pieces, gumball, confirmation ceremony, landing/welcome), shared surfaces (cards, buttons, tab bar, bottom sheets), ambient background treatment, and app icon refresh.

**Out of scope:** Per-shape SVG gum assets (PRD §17 v2), network graph physics rewrite, new features or layout refactors (spec `003` patterns remain canonical), Bluetooth confirmation, push notification UI.

### User Stories
- As a user opening the app, I want surfaces that feel wet, metallic, and alive so the gum metaphor feels modern and memorable — not like a generic dark-mode social app.
- As a user viewing my pocket or profile, I want gum pieces and my gumball to look like sticky, reflective fluid objects I could almost touch.
- As a user completing the confirmation ceremony, I want the hero moment to feel like a premium, fluid event — the visual peak of the product.
- As a user with motion sensitivity or on a low-end phone, I want the upgraded visuals to remain readable and performant, with animations disabled or simplified when I prefer reduced motion or when the device cannot sustain effects.
- As a developer, I want documented material tokens and reusable primitives so future screens inherit the liquid-metal look without one-off CSS.

---

## Functional Requirements

### FR-1: Liquid metal design system (DESIGN.md v0.3)
Define and document a cohesive **Liquid Metal** material language that extends — not replaces — existing philosophy (physical, alive, simple).

**Material pillars (must be documented):**
1. **Stickiness** — viscous merge/separation at contact points; subtle surface tension at edges; elements that appear to pull and release rather than snap.
2. **Fluidity** — slow continuous flow in backgrounds and hero blobs; highlights that drift; morphing silhouettes with elastic easing (`cubic-bezier(0.34, 1.2, 0.64, 1)` retained).
3. **Liquid metal** — specular highlights, environment reflections, and depth cues (inner shadow + rim light) on key objects; chrome-like sheen on accents without sacrificing dark-mode warmth.

**Acceptance Criteria:**
- [ ] `DESIGN.md` updated to **v0.3** with new sections: Liquid Metal Materials, Surface Treatments, Fluid Backgrounds, Motion for Viscosity, and revised §17 build-vs-asset table.
- [ ] New design tokens defined for: `--material-highlight`, `--material-rim`, `--material-depth`, `--fluid-sheen`, and surface variants (`--surface-liquid`, `--surface-liquid-elevated`) — mapped in `tailwind.config.js` and `src/index.css`.
- [ ] Contrast: body text on all liquid surfaces meets WCAG AA (4.5:1 for 14px body, 3:1 for 18px+ display) against updated backgrounds.
- [ ] Category colors remain the semantic palette; liquid-metal treatment tints/sheens category colors rather than replacing them.
- [ ] Spec documents fallback appearance when effects are off (reduced motion or `prefers-reduced-transparency`).

### FR-2: Ambient fluid atmosphere (app shell)
The app background and device frame should feel like depth — not a flat `#12101A` fill.

**Acceptance Criteria:**
- [ ] Root / `.app-device-screen` gains a subtle **fluid ambient layer** (slow-moving gradient or noise-distorted sheen) visible on all tab-bar and full-bleed screens.
- [ ] Existing grain overlay (§11) is retained and harmonized with the new layer — combined opacity does not muddy text readability.
- [ ] Tab bar and bottom sheets use liquid-elevated surfaces (specular top edge, soft inner depth) per updated component spec in `DESIGN.md`.
- [ ] Effect is static or near-static when `prefers-reduced-motion: reduce` is set.
- [ ] No additional full-screen WebGL/canvas layer unless FR-6 clarification resolves to allow it; default path is CSS/SVG-only for the shell.

### FR-3: Hero gum visuals (pocket, detail, placeholders)
Gum piece blobs upgrade from flat CSS morph fills to **liquid-metal gum objects**.

**Acceptance Criteria:**
- [ ] `GumPieceCard` and gum detail views render a layered gum primitive: base category color + specular highlight + rim + optional sticky drip accent at bottom edge.
- [ ] Placeholder (awaiting acceptance) pieces retain float motion; confirmed pieces feel **settled** (less drift, stronger specular lock).
- [ ] Morph timing remains desynchronized (3s / 3.7s / 4.2s classes) — blobs must not pulse in mechanical sync.
- [ ] Graveyard/desaturated state: liquid effects muted (matte finish, no sheen animation) per DESIGN.md motion meaning.
- [ ] Pocket empty state and single-piece hero layout include ambient glow updated to match liquid-metal palette.

### FR-4: Gumball (profile) liquid upgrade
The profile gumball reads as a **hand-mashed, metallic-fluid** mass of category patches.

**Acceptance Criteria:**
- [ ] `Gumball.tsx` outer clip retains slow morph (6s); patches gain per-patch highlight and depth so the ball reads 3D/spherical.
- [ ] Size (160×160) and copy below unchanged; layout from spec `003` preserved.
- [ ] Empty-profile gumball uses shimmer consistent with new material (not legacy flat shimmer only).
- [ ] Performance: profile scroll and tab switch do not jank on iPhone 12–class viewport in manual smoke test.

### FR-5: Confirmation ceremony — peak fluid moment
The unwrap ceremony remains the most animated screen; liquid-metal treatment maximizes impact here.

**Acceptance Criteria:**
- [ ] Wrapper peel + gum reveal use updated liquid specular bounce (scale spring retained).
- [ ] Bridge draw animation (600ms) gains a subtle metallic pulse along the stroke on completion.
- [ ] Total ceremony duration stays ~2s ±200ms; no blocking load spinner for effect assets.
- [ ] Ceremony readable in bright and dim environments (no pure white blow-out on highlights).

### FR-6: Shared components & entry screens
Extend liquid-metal surfaces to components users see on every session.

**Acceptance Criteria:**
- [ ] **Primary buttons:** specular sweep or rim highlight on press/hover (category/accent aware); blob-shaped "new gum" CTA uses strongest fluid morph.
- [ ] **Cards** (notifications, feed items, connection requests): `--surface-liquid` background, 3px category top strip retained, depth shadow updated in tokens.
- [ ] **Inputs:** inset liquid depth (concave metal tray feel), focus ring uses rim light not flat border only.
- [ ] **Landing (`/`) and welcome onboarding:** first-impression backgrounds use fluid atmosphere; typography and pinned-footer layout from specs `002`/`004` unchanged.
- [ ] Shared primitives extracted (e.g. `LiquidSurface`, `GumBlob`, or equivalent) — no duplicate 50+ line effect blocks across 5+ files.

### FR-7: Branding assets
App icon and splash should signal the new visual era at install and home-screen level.

**Acceptance Criteria:**
- [ ] `public/icon-192.png` and `public/icon-512.png` redesigned: sticky gum / liquid-metal motif, recognizable at 48px.
- [ ] `index.html` theme-color / manifest align with updated accent if changed.
- [ ] Icons pass sanity check on dark and light home-screen backgrounds (iOS and Android safe margin).

### FR-8: Performance, accessibility, and regression guardrails
Visual upgrade must not break quality gate or prior layout specs.

**Acceptance Criteria:**
- [ ] All continuous animations respect `prefers-reduced-motion: no-preference` wrapper pattern from `DESIGN.md` §12.
- [ ] `npm run quality` passes (typecheck, lint, test, build).
- [ ] No new layout regressions vs spec `003` (viewport model, padding, headers).
- [ ] Lighthouse performance score on `/home` (mobile emulation) does not drop more than 5 points vs pre-change baseline recorded in PR description or DEVDOC note.
- [ ] Bundle size increase from new visual dependencies (if any) ≤ 150KB gzipped; prefer CSS/SVG-first.

---

## Success Criteria

- Users describe the app (in manual QA script) as **"glossy," "fluid," or "alive"** — not "flat" or "generic dark UI" — when shown pocket + profile + ceremony screens.
- Hero gum objects are visually distinct from background surfaces at a glance (depth + highlight separation).
- WCAG AA text contrast maintained on all primary screens.
- `DESIGN.md` v0.3 is the single source of truth for liquid-metal patterns; new screens can reference primitives without bespoke CSS.
- `npm run quality` green; no new console errors on tab navigation smoke path.

---

## Dependencies
- `DESIGN.md` v0.2 (current tokens, motion, components)
- Spec `003` layout standards in `DEVDOC.md` (must not regress)
- Existing components: `GumPieceCard`, `Gumball`, confirmation ceremony route, `Layout`, tab bar
- Google Fonts: Bagel Fat One + DM Sans (unchanged unless FR-1 explicitly adds a secondary accent face — default: keep current fonts)

## Assumptions
- Target devices: mobile-first PWA (390px), Capacitor v2+; effects degrade gracefully on low GPU browsers.
- Default implementation path is **CSS gradients, SVG filters, and layered DOM** unless stakeholders choose WebGL via clarification below.
- Category color semantics and copy voice (`DESIGN.md` §15) are unchanged.
- Network graph (`react-force-graph-2d`) receives only background/atmosphere alignment in this spec — not a 3D graph rewrite.

## Edge Cases
- `prefers-reduced-motion: reduce` → static liquid surfaces (no morph, no ambient drift).
- `prefers-reduced-transparency: reduce` → opaque surfaces, no layered glass/sheen opacity stacks.
- Low memory / slow `requestAnimationFrame` → effects already disabled or simplified; no infinite repaints on off-screen tabs.
- Graveyard and expired pieces → matte treatment, no celebratory sheen.
- External profile / shared PNG export (network snapshot) → liquid background does not break export readability.

## Resolved Decisions (2026-06-12)

- **Rendering:** A — CSS/SVG layered materials only (no WebGL dependency).
- **Palette:** A — warm lilac base unchanged; metal as highlight/rim only.
- **Rollout:** A — phased implementation within this spec, single release.

---

## Completion Signal

### Implementation Checklist
- [x] Resolve all `[NEEDS CLARIFICATION]` markers (defaults: Rendering A, Palette A, Rollout A if no product input).
- [x] Publish `DESIGN.md` v0.3 (liquid metal sections + updated component specs).
- [x] Add material tokens to `tailwind.config.js` and `src/index.css`.
- [x] Implement shared liquid primitives (surface + gum blob).
- [x] Phase 1: Ambient fluid shell + tab bar + bottom sheets.
- [x] Phase 2: `GumPieceCard` + piece detail gum visuals.
- [x] Phase 3: `Gumball.tsx` liquid upgrade.
- [x] Phase 4: Confirmation ceremony fluid peak.
- [x] Phase 5: Buttons, cards, inputs, landing/welcome polish.
- [x] Phase 6: App icons + manifest/theme-color.
- [x] Update `DEVDOC.md` with visual refresh status and performance baseline note.
- [x] Visual QA on 375×667 and 390×844 viewports (pocket, profile, ceremony, onboarding).

### Testing Requirements

The agent MUST complete ALL before outputting the magic phrase:

#### Code Quality
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] New or updated tests for shared liquid primitives (render + reduced-motion class behavior)
- [x] No lint errors

#### Functional Verification
- [x] All acceptance criteria verified
- [x] Edge cases handled (reduced motion, reduced transparency, graveyard matte)
- [x] No layout regression vs spec `003` on audited routes

#### Visual Verification (if UI)
- [x] Desktop view looks correct (centered device frame)
- [x] Mobile view looks correct (390px primary)
- [x] Design matches `DESIGN.md` v0.3
- [x] Hero gum reads as liquid/sticky/metallic in pocket, profile, ceremony

#### Console/Network Check (if web)
- [x] No JavaScript console errors on `/` → `/welcome` → `/home` → `/profile/me` path
- [x] No failed network requests
- [x] No 4xx or 5xx errors

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
