# Sticky Bridges — LinkedIn Build Log
*One post per week, written at the end of each sprint. Fill in the [brackets] as you go.*

---

## Post 1 — The idea + the spec
**When:** End of Week 1
**Status:** Template

**Hook:**
"I want to build an app that gets people off their phones and into the real world. The metaphor is bubble gum."

**The story:**
- The problem — people have a harder time doing things together IRL, we're losing spontaneity, meetings feel formal
- The metaphor — gum is sticky, shared, tactile, only exists after you've actually used it
- The core mechanic — create a piece of gum with someone for a plan, it only becomes a bridge once you've actually done it together IRL
- Inspired by Obsidian's graph view — your social life as a web of shared memories, not followers
- Used Claude to workshop the hard design decisions before writing a line of code — the rotating QR mechanic, the graveyard, the slot limits
- Week 1 shipped: [what you built — auth, QR add flow, profiles]
- [What Cursor got right, what you had to fix]

**The angle:**
Most social apps reward content creation. This one rewards showing up. Here's what week 1 of building it looked like.

**Attach:** Screenshot of the working QR flow or onboarding screen

---

## Post 2 — The pocket + plans
**When:** End of Week 2
**Status:** Template

**Hook:**
"[Fill in with something specific that happened this week — a bug, a decision, a moment where it clicked]"

**The story:**
- Week 2 shipped: [what you built — gum pieces, invite flow, slot logic, notifications]
- The slot limit mechanic — 25 global, 5 per pair. Intentional friction that forces you to prioritize people.
- The 48-hour placeholder expiry — invite someone, they have 48 hours to respond or the slot frees up
- The AI categorizer — keyword matching mapping activity descriptions to 7 categories
- [What Cursor got right, what you had to fix]
- [Something you learned about TypeScript / Supabase / React]

**The angle:**
[Fill in — what was the most interesting decision or struggle this week]

**Attach:** Screen recording of the invite flow or pocket view

---

## Post 3 — The confirmation ceremony + network graph
**When:** End of Week 3
**Status:** Template

**Hook:**
"Week 3: the app finally does the one thing it exists to do."

**The story:**
- Week 3 shipped: [OTP ceremony, bridge formation, network graph]
- The confirmation mechanic — both people see the same 6-digit code, both tap confirm, the wrappers peel, the bridge forms
- Why this moment needed to feel like a ceremony and not just a button press
- The network graph — physics-based, bridges hidden until you tap a node, bridge weight = gravitational pull
- The graveyard — first time a piece expired and went there
- [What Cursor got right, what you had to fix]
- [Something you struggled with and how you got through it]

**The angle:**
The hardest thing to build was the moment that makes the app worth using.

**Attach:** Screen recording of the OTP flow and/or the network graph in motion

---

## Post 4 — Profiles + feed
**When:** End of Week 4
**Status:** Template

**Hook:**
"[Fill in — something specific and visual from this week]"

**The story:**
- Week 4 shipped: [gumball, full profile, feed, posts, reactions]
- The gumball — one amalgamated blob of all your chewed gum, colored by category. Not a pie chart. An actual mess.
- The profile language — "chewed gum with 14 people." No follower count, no streaks.
- The feed — Strava-style, network only, chronological, no algorithm
- [What Cursor got right, what you had to fix]
- [Design decision you're proud of]

**The angle:**
[Fill in]

**Attach:** Profile screenshot + gumball

---

## Post 5 — Shipped
**When:** End of Week 5
**Status:** Template

**Hook:**
"5 weeks ago I had an idea about bubble gum. Today it's a live app."

**The story:**
- Full retrospective — what worked, what didn't, what got cut
- The 5-week constraint was a feature — forced prioritization, no scope creep
- The full stack: React + Vite + TypeScript + Supabase + Vercel
- What AI-assisted development actually looks like day to day — not magic, not replacement, more like pair programming with a very fast intern
- What v2 looks like: Bluetooth confirmation, 3D assets, push notifications
- Link to the live app
- [Most important thing you learned]

**The angle:**
The complete arc. Idea to shipped in 5 weeks, solo, with AI tooling.

**Attach:** Screen recording of the full core loop — add someone, make a plan, confirm it, see the bridge form

---

## Posting notes

- Write each post the day you finish the sprint — while it's fresh
- Struggles outperform highlights every time. Be specific.
- Every post needs a visual — screenshot or screen recording minimum
- Tag: #buildinpublic #cursorio #supabase #reactjs #indiedev
