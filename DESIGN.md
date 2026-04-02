# Sticky Bridges — Design System
**Version:** 0.1  
**Status:** Living document — updated alongside PRD  
**Last updated:** Pre-sprint 0

---

## 1. Design Philosophy

Sticky Bridges should feel like something you want to open. Dark, glossy, alive. The gum metaphor isn't decoration — every design decision should make the app feel tactile, physical, and slightly chaotic in the best way.

Three principles drive every decision:

**Physical over flat.** Gum has weight, texture, and presence. UI elements should feel like objects, not diagrams. Gloss highlights, grain texture, blob shapes that breathe.

**Alive over static.** Nothing should feel frozen. Blobs morph. Bridges stretch. The network graph drifts. The app should feel like it has a heartbeat even when you're not interacting with it.

**Simple enough to disappear.** The UI exists to get out of the way of the experience. One primary action per screen. No feature density. If a user has to think about how to use something, it's too complex.

---

## 2. Retention-Critical Design Rules

These apply to every screen and override aesthetic preferences when in conflict.

**Empty states must invite, not inform.** An empty pocket doesn't say "you have no plans." It says "who do you want to make a memory with?" Every empty state has a single CTA and warm copy. No cold system language.

**Onboarding ends at the add screen.** After setting up their profile, the user's first destination is the QR add screen — not the empty pocket. The app is useless alone and the design should never let someone forget that.

**The pocket must feel worth opening.** Even one gum piece should make the screen feel alive. The blob morphs, the color chip glows slightly, the expiry date is humanized ("11 months left" not "2025-03-14"). A single piece should feel like a promise, not a task.

**Confirmation is the hero moment.** The OTP ceremony screen gets the most design investment of any screen. This is the moment that makes everything worth it. It should feel like an event.

---

## 3. Color System

### Background + surfaces

Dark, warm-purple undertone. Not navy. Not pure black. Somewhere between the two — like the inside of a closed eye.

```
--color-bg:         #12101A   /* page background */
--color-surface:    #1E1B2E   /* cards, sheets, modals */
--color-surface-2:  #272438   /* elevated surfaces, inputs */
--color-border:     rgba(255,255,255,0.07)  /* subtle borders */
--color-border-mid: rgba(255,255,255,0.12)  /* hover borders */
```

### Text

```
--color-text-primary:   #F2EFF8   /* headings, primary content */
--color-text-secondary: #9B93B8   /* supporting text, meta */
--color-text-tertiary:  #5C5478   /* placeholders, disabled, timestamps */
```

### Category colors

Calibrated for dark backgrounds — slightly more saturated than the light-mode versions to maintain vibrancy.

```
--color-intimate:   #CF8EE8   /* soft lilac — romantic, cozy, personal */
--color-active:     #7DD47A   /* grass green — physical, energetic, sports */
--color-playful:    #F07868   /* coral red — creative, artistic, fun */
--color-explore:    #6DB8F0   /* sky blue — travel, events, new places */
--color-recharge:   #82C9A0   /* sage green — calm, restorative, wellness */
--color-savor:      #F0A84A   /* warm amber — food, drinks, luxury */
--color-support:    #E89AA8   /* dusty rose — showing up, being present */
```

### Accent + brand

```
--color-accent:     #CF8EE8   /* intimate/lilac — primary brand accent */
--color-glow:       rgba(207,142,232,0.15)  /* ambient glow for key moments */
```

### Semantic

```
--color-success:    #7DD47A
--color-warning:    #F0A84A
--color-error:      #F07868
--color-info:       #6DB8F0
```

---

## 4. Typography

### Fonts

```
Display:  'Bagel Fat One', cursive      /* Google Fonts — free */
Body:     'DM Sans', sans-serif         /* Google Fonts — free */
```

Import in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
```

### Scale

```
--text-hero:    48px / Bagel Fat One / line-height 1.0  /* app name, landing */
--text-display: 32px / Bagel Fat One / line-height 1.1  /* screen titles */
--text-heading: 22px / Bagel Fat One / line-height 1.2  /* section headers */
--text-body-lg: 16px / DM Sans 400   / line-height 1.65 /* primary content */
--text-body:    14px / DM Sans 400   / line-height 1.6  /* default body */
--text-meta:    12px / DM Sans 400   / line-height 1.5  /* timestamps, labels */
--text-label:   10px / DM Sans 500   / line-height 1.4  /* caps labels, tags */
```

### Rules

- Bagel Fat One is display only — screen titles, the app name, empty state headlines, the confirmation ceremony title. Never for body copy or UI labels.
- DM Sans handles everything else. Weight 400 for body, 500 for emphasis and button labels.
- Sentence case always. No ALL CAPS except for the 10px label style.
- Text on dark: always use `--color-text-primary` or `--color-text-secondary`. Never hardcode colors.
- Text on category colors: use white at 90% opacity. The colors are mid-saturation — white reads cleanly on all of them.

---

## 5. Spacing + Layout

Mobile-first. Design for 390px wide (iPhone 14). All spacing in 4px increments.

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px    /* default inner padding */
--space-5:  20px
--space-6:  24px    /* card padding */
--space-8:  32px
--space-10: 40px
--space-12: 48px    /* section gaps */
```

**Page padding:** 20px horizontal on all screens.
**Safe area:** always account for bottom safe area on mobile — add `padding-bottom: env(safe-area-inset-bottom)` to bottom-tab-bar and any fixed bottom elements.
**Max content width:** 480px centered. On wider screens content stays centered, background extends full width.

---

## 6. Corner Radius

Everything is rounded. The language is organic, not geometric.

```
--radius-sm:   8px    /* tags, pills, small chips */
--radius-md:   14px   /* inputs, small cards */
--radius-lg:   20px   /* cards, sheets */
--radius-xl:   28px   /* modals, bottom sheets */
--radius-full: 9999px /* buttons, badges */
```

---

## 7. Component Specs

### Bottom tab bar

5 tabs: Pocket, Network, Feed, Notifications, Profile.
- Background: `--color-surface` with a top border at `--color-border`
- Active tab: category accent color icon + label. Inactive: `--color-text-tertiary`.
- Notification badge: `--color-accent` dot, 8px, top-right of icon.
- Height: 56px + safe area inset.

### Cards (gum pieces in pocket)

- Background: `--color-surface`
- Border: `--color-border` default, category color at 30% opacity on hover/press
- Top accent: 3px strip of category color across the top edge
- Corner radius: `--radius-lg`
- Padding: `--space-6`
- The gum shape asset sits left, 48×48, morphing slowly
- Placeholder cards (awaiting acceptance): same structure, 60% opacity, subtle float animation
- Shadow: `0 4px 24px rgba(0,0,0,0.3)`

### Buttons

Primary action (confirm, accept, send):
- Background: category color or `--color-accent`
- Text: white, DM Sans 500, 14px
- Padding: 14px 28px
- Radius: `--radius-full`
- Hover: scale(1.03), slight glow shadow in category color

Secondary action (turn down, skip, cancel):
- Background: `--color-surface-2`
- Text: `--color-text-secondary`
- Same padding and radius

Destructive (delete, turn down confirmed):
- Background: transparent
- Text: `--color-error`
- Border: `--color-error` at 40% opacity

The "new gum" CTA is the only blob-shaped button — morphing border-radius animation, `--color-accent` fill.

### Inputs

- Background: `--color-surface-2`
- Border: `--color-border` default, `--color-border-mid` focused
- Text: `--color-text-primary`
- Placeholder: `--color-text-tertiary`
- Radius: `--radius-md`
- Padding: 14px 16px
- Character counter sits bottom-right of the input field, `--color-text-tertiary`

### Bottom sheets / modals

- Background: `--color-surface`
- Radius: `--radius-xl` top corners only
- Drag handle: 4px × 36px pill, `--color-border-mid`, centered at top
- Backdrop: `rgba(0,0,0,0.6)`

### Tags / category chips

- Background: category color at 15% opacity
- Text: category color at full opacity, DM Sans 500, 11px, uppercase
- Dot: 6px circle, category color, sits left of label
- Radius: `--radius-full`
- Padding: 4px 10px

### Notification items

- Unread: left border 3px in category/accent color, background slightly lighter than surface
- Read: no border accent, full opacity text
- Timestamp: `--color-text-tertiary`, right-aligned

---

## 8. Gum Shape Assets

5 SVG shapes, designed in Figma. Each has:
- A base shape (the gum itself)
- A highlight layer (white ellipse at 30-40% opacity, top-left — implies gloss)
- A shadow layer (dark at 20% opacity, bottom — implies depth)
- A `--gum-color` CSS variable slot for dynamic category color application

**Shape-to-category mapping** (randomized at piece creation — same pair can get different shapes for different plans):

| Shape | Feel |
|---|---|
| Wrigley strip | Long, flat, energetic |
| Gumball | Round, bouncy, social |
| Chiclet | Clean, precise, compact |
| Chewy block | Dense, substantial, tactile |
| Organic blob | Soft, irregular, personal |

All five shapes are used across all categories. The color communicates the category — the shape is a surprise.

**Wrapper treatment:**
Each shape has a wrapped state (foil/wrapper visible) and an unwrapped state (gum exposed). The wrapper is a lighter, slightly desaturated version of the category color with a diagonal line texture implying foil. Switching between states is animated.

**Implementation:**
```tsx
<GumPiece 
  shape="wrigley-strip"    // randomized at creation, stored in DB
  color="#CF8EE8"           // derived from category
  state="wrapped"           // wrapped | unwrapped
  size={48}                 // default pocket size
/>
```

---

## 9. Gumball (Profile)

One single organic blob. All category colors as random chunky patches — not gradients, not segments. Like someone mashed 7 pieces of gum together with their hands.

**Implementation approach:**
SVG with irregular path shapes for each color chunk, overlapping slightly, clipped to an outer blob shape that morphs slowly. Not a pie chart. Not a gradient. Patches.

The more bridges in a category, the larger its patch. A user who's only ever done Intimate activities has a mostly-lilac blob with small traces of others. A user who does everything has a chaotic multicolor mass.

Sits centered on the profile page. Size: 160px × 160px. Slow morph animation on the outer clip path (6s loop).

Below it: `"chewed gum with N people"` in DM Sans 400, `--color-text-secondary`. Nothing else numerical.

---

## 10. Network Graph

**Library:** `react-force-graph-2d`
**Background:** `--color-bg` (the dark background — the graph lives in darkness)

**Nodes:**
- Your node: 44px circle, `--color-accent` fill, your avatar inside, white border 2px
- Other nodes: 36px circle, `--color-surface-2` fill, avatar or initial, `--color-border-mid` border
- Hover: scale(1.1), border brightens to category color of strongest bridge

**Edges (bridges):**
- Hidden by default
- Revealed on node tap — all bridges to that node appear
- Color: the category color of that individual bridge
- Thickness: scales with bridge count (1 bridge = 1.5px, 5+ bridges = 4px)
- Multiple bridges between same two people: stacked parallel lines, each colored by category
- Opacity: 0.7 default, 1.0 on hover

**Physics:**
- Bridge weight increases attractive force — more bridges = nodes sit closer
- Drag nodes freely, graph re-balances with elastic easing
- Collision detection so nodes never fully overlap

**Bridge detail sheet (on bridge tap):**
- Activity title (Bagel Fat One, 20px)
- Category chip + color
- Date ("a Tuesday in March" — humanized, not ISO format)
- Both participants

**Export:**
`html2canvas` snapshot of the canvas. Exports as PNG with `--color-bg` background. Filename: `my-bridges-[date].png`.

---

## 11. Texture + Atmosphere

**Grain overlay:**
A subtle noise texture across the entire app. Adds tactility — the moodboard's "grainy" aesthetic without being heavy.

```css
.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,..."); /* SVG noise */
}
```

Apply once at the root level. Opacity 0.035 — barely perceptible but felt.

**Ambient glow:**
Key UI moments get a soft radial glow behind them in the category color. The gum piece in pocket view, the gumball on profile, the confirmed bridge. Not a drop shadow — a soft radial background.

```css
.gum-glow {
  background: radial-gradient(
    circle at center,
    var(--category-color-15) 0%,
    transparent 70%
  );
}
```

**No hard white elements.** Everything on the dark background uses the surface colors. Pure white is reserved for text and critical UI moments only.

---

## 12. Animation Principles

**Elastic, not bouncy.** Easing for blob morphs and interactive elements:
```
cubic-bezier(0.34, 1.2, 0.64, 1)
```

**Motion has meaning:**
- Floating / slight vertical drift = unresolved (placeholder pieces awaiting acceptance)
- Settled + still = confirmed and active
- Pulsing glow = something needs attention
- Desaturated + no motion = graveyard

**Blob morph:**
All gum piece blobs morph continuously via CSS border-radius animation. Duration varies per piece (3s, 3.7s, 4.2s) — they never sync up and feel mechanical. Use `will-change: border-radius` for performance.

**The unwrap ceremony:**
The single most animated moment in the app. Wrapper peels away (top and bottom fold in opposite directions, CSS rotateX), then the gum blob bounces in with a scale spring. Bridge line draws from left node to right node over 600ms. On completion, a brief pulse radiates from the bridge. Total duration: ~2 seconds.

**Screen transitions:**
Slide up for deeper navigation. Slide down to dismiss. Fade for tab switching. Duration: 250ms.

**Reduced motion:**
Always wrap continuous animations in:
```css
@media (prefers-reduced-motion: no-preference) {
  /* animation here */
}
```

---

## 13. Empty States

Every empty state follows the same structure: a centered illustration (simple SVG, on-brand), a Bagel Fat One headline, a DM Sans subline, and a single CTA button.

| Screen | Headline | Subline | CTA |
|---|---|---|---|
| Empty pocket (new user) | "Your pocket is empty." | "Make a plan with someone you love." | Add someone |
| Empty pocket (has connections) | "Nothing brewing yet." | "Who do you want to do something with?" | New gum |
| Empty network | "No bridges yet." | "They form when you actually show up." | Add someone |
| Empty feed | "Nothing here yet." | "Your feed fills up when your people do things together." | — |
| Empty graveyard | "Nothing here." | "Keep it that way." | — |
| Empty notifications | "All caught up." | — | — |

Empty state copy is written in the app's voice — warm, slightly dry, never hollow.

---

## 14. Icon Style

**Style:** Rounded, slightly chunky, 1.5px stroke weight. Not filled, not ultra-thin. Sits between Phosphor Icons (rounded) and Lucide — use Lucide React as the library, `strokeWidth={1.75}`.

**Size:** 22px in tab bar, 20px in UI, 16px inline.

**Color:** Inherit from parent context. Active states use category color. Inactive uses `--color-text-tertiary`.

---

## 15. Voice + Copy Style

The app has a personality. Copy should feel like a friend wrote it, not a product team.

- Warm and direct. Never corporate.
- Slightly dry humor is fine. Never sarcastic.
- Humanize everything: "11 months left" not "335 days remaining." "A Tuesday in March" not "2025-03-11."
- Avoid: "complete your profile," "no items found," "an error occurred."
- Use: "add your name," "nothing here yet," "something went wrong — try again."

Auto-generated profile bio format:
`"[Verb]s [doing X] — most of [their] bridges happen [context]."`
Example: `"Loves getting outside — most of her bridges happen somewhere with good food."`
Derived from top 2 categories. Generated server-side on profile load.

---

## 16. Tailwind Configuration

Add to `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg:         '#12101A',
        surface:    '#1E1B2E',
        'surface-2':'#272438',
        text:       '#F2EFF8',
        'text-2':   '#9B93B8',
        'text-3':   '#5C5478',
        intimate:   '#CF8EE8',
        active:     '#7DD47A',
        playful:    '#F07868',
        explore:    '#6DB8F0',
        recharge:   '#82C9A0',
        savor:      '#F0A84A',
        support:    '#E89AA8',
        accent:     '#CF8EE8',
      },
      fontFamily: {
        display: ['"Bagel Fat One"', 'cursive'],
        body:    ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: {
        sm:  '8px',
        md:  '14px',
        lg:  '20px',
        xl:  '28px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.3)',
        glow: '0 0 40px rgba(207,142,232,0.15)',
      },
    },
  },
}
```

---

## 17. What to Build vs What to Asset

| Element | Approach |
|---|---|
| Gum piece shapes | SVG assets (Figma → export → `/src/assets/gum/`) |
| Gumball blob | Built in code (SVG with JS-driven patches) |
| Network graph | Built in code (react-force-graph-2d + Three.js bridges) |
| Category chips / tags | Built in code (Tailwind) |
| Empty state illustrations | SVG assets (simple, designed in Figma) |
| App icon | SVG asset (single gumball blob, `--color-intimate`) |
| Grain texture | CSS (SVG noise data URI) |
| All animations | CSS keyframes + Tailwind |

---

*Next: `.cursor/rules` — generated at sprint start. `DEVDOC.md` — initialized Week 1.*
