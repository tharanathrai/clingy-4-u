# Week 3 — Confirmation + Bridges
**Goal:** Plans can be completed end-to-end. The core loop works.
**Deadline:** End of week
**Live URL:** https://clingy-4-u.vercel.app/

Read PRD.md, DESIGN.md, and .cursor/rules before starting anything.

## Current implementation snapshot (Apr 2026)

This file started as the Week 3 build plan. Current codebase status:

- ✅ Confirmation session flow is implemented in `supabase/functions/start-confirmation/index.ts`, `supabase/functions/submit-confirmation/index.ts`, `src/pages/PieceConfirm.tsx`, and `src/components/confirmation/OTPDisplay.tsx`.
- ✅ Unwrap flow is implemented in `src/components/confirmation/UnwrapCeremony.tsx`, including reduced-motion handling.
- ✅ Expiry automation is implemented in `supabase/functions/run-expiry/index.ts`, including graveyard inserts and confirmation session cleanup.
- ✅ Graveyard page is fully implemented in `src/pages/Graveyard.tsx`.
- ✅ Email utility and integrations are implemented in `supabase/functions/send-email/index.ts` and invoked from create/respond/expiry functions.
- ℹ️ Delta from original plan: expiry notifications now use `plan_expired` in `run-expiry` (not just `plan_expiring_soon`).
- ℹ️ `submit-confirmation` now also creates/returns `draft_post_id` for Week 6 post opt-in behavior.

---

## Edge functions

### 1. Start confirmation session
File: supabase/functions/start-confirmation/index.ts

Authenticated endpoint (validate JWT).
Accept: { gum_piece_id: string }

Steps:
1. Fetch the gum piece — must exist, status must be 'active'
2. Calling user must be creator_id or recipient_id
3. Check for an existing unexpired confirmation_session for this gum_piece_id — if one exists, return it (don't create a duplicate)
4. Generate a 6-digit numeric OTP code (zero-padded, e.g. "047823")
5. Insert into confirmation_sessions:
   - gum_piece_id
   - otp_code
   - initiator_id = calling user
   - initiator_confirmed = true (initiator starts the session, counts as their confirm)
   - responder_confirmed = false
   - expires_at = now() + 5 minutes
6. Return: { session_id, otp_code, expires_at }

Deploy after creating.

### 2. Submit confirmation
File: supabase/functions/submit-confirmation/index.ts

Authenticated endpoint (validate JWT).
Accept: { session_id: string, otp_code: string }

Steps:
1. Fetch the confirmation_session by session_id
2. Validate: exists, not expired, otp_code matches
3. Determine if calling user is initiator or responder (compare with initiator_id and the gum piece's other party)
4. Set the appropriate confirmed flag (initiator_confirmed or responder_confirmed) to true
5. If BOTH flags are now true AND session is not expired:
   a. Update gum_piece status → 'confirmed', confirmed_at = now()
   b. Insert into bridges:
      - gum_piece_id
      - user_a_id / user_b_id (lower UUID first, matching connections table convention)
      - category, color_hex, activity_title from the gum piece
      - formed_at = now()
   c. Insert notification for both users: type = 'bridge_formed', reference_id = new bridge.id
   d. Delete the confirmation_session (ephemeral — clean up after use)
   e. Return: { success: true, bridge_formed: true, bridge: { id, activity_title, category, color_hex, formed_at } }
6. If only one flag is true: return { success: true, bridge_formed: false } — waiting for the other person
7. If session expired: return 400 { error: 'session_expired' }

Deploy after creating.

### 3. Nightly expiry cron
File: supabase/functions/run-expiry/index.ts

This function is called by pg_cron on a schedule. It does not require JWT auth — use the service role key internally.

Steps:
1. Expire placeholder pieces older than 48 hours:
   - UPDATE gum_pieces SET status = 'expired' WHERE status = 'placeholder' AND expires_at < now()
   - No graveyard entry for these (PRD rule)

2. Expire active pieces older than 1 year:
   - SELECT all gum_pieces WHERE status = 'active' AND expires_at < now()
   - For each: UPDATE status → 'expired'
   - INSERT into graveyard: gum_piece_id, user_a_id, user_b_id, title, color_hex, created_at, expired_at = now()
   - Insert notification for both users: type = 'plan_expiring_soon' (use this for the expiry event — rename to 'plan_expired' in copy)

3. Clean up expired confirmation_sessions:
   - DELETE FROM confirmation_sessions WHERE expires_at < now()

4. Return: { expired_placeholders: N, expired_active: N, cleaned_sessions: N }

After creating the function, set up the pg_cron schedule in the Supabase SQL editor:
```sql
select cron.schedule(
  'nightly-expiry',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/run-expiry',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )
  $$
);
```
Replace <project-ref> and <service-role-key> with the actual values from the Supabase dashboard.

Deploy after creating.

---

## Database

### 4. RLS policies for new tables
In the Supabase dashboard SQL editor, run:

```sql
-- bridges: users can view bridges they are part of
CREATE POLICY "Users can view their own bridges"
ON bridges FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- graveyard: users can view their own graveyard entries
CREATE POLICY "Users can view their own graveyard"
ON graveyard FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- confirmation_sessions: users can view sessions for their gum pieces
CREATE POLICY "Users can view their confirmation sessions"
ON confirmation_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM gum_pieces
    WHERE gum_pieces.id = confirmation_sessions.gum_piece_id
    AND (gum_pieces.creator_id = auth.uid() OR gum_pieces.recipient_id = auth.uid())
  )
);
```

---

## Hooks

### 5. useConfirmationSession hook
File: src/hooks/useConfirmationSession.ts

Props: { gumPieceId: string }

- Subscribe to real-time changes on confirmation_sessions for this gum_piece_id
- Return: { session, loading, error }
- When session updates (responder_confirmed or initiator_confirmed changes), the UI reacts automatically
- When session is deleted (bridge formed), trigger a callback: onBridgeFormed()

### 6. useBridges hook
File: src/hooks/useBridges.ts

- Fetch all bridges where user_a_id = user.id OR user_b_id = user.id
- Optionally filter by other_user_id for profile views
- Return: { bridges, loading, error, refetch }

---

## Components

### 7. OTP code display
File: src/components/confirmation/OTPDisplay.tsx

Props: { code: string, expiresAt: string, confirmed: { initiator: boolean, responder: boolean }, isInitiator: boolean }

Visual spec — this is the hero moment (DESIGN.md section 2: "Confirmation is the hero moment"):
- Full screen modal / bottom sheet feel, bg-surface
- Ambient glow behind the code: radial-gradient in --color-accent at 15% opacity
- The 6-digit code displayed large: Bagel Fat One, 64px, letter-spacing 0.2em, text-text, centered
- Subtitle: "Show this to [name] — both of you tap confirm" in DM Sans 400 text-2
- Countdown timer below code: shows seconds remaining, animates, turns warning color (#F0A84A) under 60 seconds
- Two avatar chips below: one for each user, with a checkmark overlay when confirmed. Initiator's chip already shows checkmark on mount.
- Confirm button (primary, full width): "I'm here" — disabled if current user already confirmed
- On confirm tap: call submit-confirmation edge function
- If bridge_formed = true: trigger the unwrap ceremony (see component 8)
- If session_expired error: show "The window closed. Try again." and a "Start over" button that calls start-confirmation again

### 8. Unwrap ceremony
File: src/components/confirmation/UnwrapCeremony.tsx

Props: { bridge: Bridge, onComplete: () => void }

This is the single most animated moment in the app (DESIGN.md section 12).

Animation sequence (~2 seconds total):
1. Wrapper peels away: two rectangles (top and bottom halves of a wrapper shape) rotate outward on the X axis using CSS rotateX — top half rotates to -90deg, bottom to +90deg, over 400ms with ease-in
2. Gum blob bounces in: scale from 0 → 1.15 → 1.0 over 300ms, elastic easing cubic-bezier(0.34, 1.2, 0.64, 1), colored in bridge's color_hex
3. Bridge line draws: a thin line grows from left to right over 600ms, colored in bridge's color_hex, with a pulse glow at the end point
4. Text appears: bridge activity title in Bagel Fat One 28px fades in, then "Bridge formed." below in DM Sans text-2
5. Brief radial pulse emanates from the blob center: category color at 30% → 0% opacity over 400ms

After the sequence completes (after ~2100ms), call onComplete() which navigates to /home.

Wrap all animations in @media (prefers-reduced-motion: no-preference) — if reduced motion, skip straight to the final state and show onComplete after 500ms.

---

## Pages

### 9. Confirmation flow (/piece/:id/confirm)
File: src/pages/PieceConfirm.tsx

Replace the stub with the real implementation.

This page is the confirmation ceremony. Both users navigate here independently.

On mount:
- Fetch the gum piece by id — must be status 'active', user must be part of it
- Check for an existing active confirmation_session for this piece
  - If initiator (no session exists yet): call start-confirmation edge function to create one
  - If responder (session already exists): join the existing session via real-time subscription

Layout:
- Back button top left (only shown before confirmation starts — once OTP is visible, back is disabled)
- Page title "[name]'s plan" in font-display
- CategoryChip and activity title centered
- OTPDisplay component filling the main content area
- Real-time subscription on the session — when both confirmed, trigger UnwrapCeremony

State machine:
- loading → fetching/creating session
- waiting → OTP shown, waiting for both confirms
- bridge_formed → UnwrapCeremony plays
- expired → "Window closed" state with retry

### 10. Graveyard (/home/graveyard)
File: src/pages/Graveyard.tsx

Replace the Week 2 stub with the real implementation.

Fetch graveyard entries for current user, ordered by expired_at desc.

Layout:
- Back button → /home
- Page title "graveyard" in font-display
- Subline "Plans that didn't happen." in DM Sans text-2
- List of graveyard cards:
  - Same structure as GumPieceCard but:
  - All colors desaturated (apply CSS filter: saturate(0.3) grayscale(0.4))
  - No animation — static, settled
  - No actions — read only
  - Shows: activity title, "with [name]", "created [humanized date]", "expired [humanized date]"
  - No blob morph, no float
- Empty state: "Nothing here." subline "Keep it that way." — no CTA (per DESIGN.md)

---

## Email notifications (SendGrid)

### 11. SendGrid setup
In the Supabase dashboard:
1. Go to Project Settings → Edge Functions → Secrets
2. Add secret: SENDGRID_API_KEY = your SendGrid API key
   (Create a free SendGrid account at sendgrid.com — free tier is 100 emails/day)

### 12. Send email edge function
File: supabase/functions/send-email/index.ts

Internal utility function — called by other edge functions, not directly by the client.
Accept: { to: string, subject: string, body: string }

Use the SendGrid API to send a transactional email:
```typescript
await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: 'hello@stickybridges.app', name: 'Sticky Bridges' },
    subject,
    content: [{ type: 'text/plain', value: body }],
  })
})
```

### 13. Wire emails into existing edge functions
Update the following edge functions to call send-email after their key actions.
Call send-email as a fire-and-forget (do not await, do not let email failure block the main response).

Events that trigger email (from PRD.md section 14):
- create-gum-piece: email recipient when invite received
  Subject: "[Name] wants to make a plan with you"
  Body: "[Creator name] sent you a plan: '[title]'. Open the app to accept or pass."

- respond-gum-piece (turn_down only): email the other party
  Subject: "A plan was turned down"
  Body: "[Name] passed on '[title]'. Your slot is now free."

- run-expiry (active pieces only): email both users
  Subject: "A plan expired"
  Body: "Your plan '[title]' with [name] expired without being confirmed. It's in your graveyard."

Do not email for: invite_accepted, bridge_formed, comments, reactions (per PRD.md section 14 table).

To get the user's email address for sending: query auth.users (service role only — this is fine inside edge functions using the service role key).

Deploy all updated functions after changes.

---

## Deploy checklist (end of week)

- [ ] npm run typecheck passes with no errors
- [ ] npm run build completes successfully
- [ ] Start confirmation session creates OTP and shows code to both users
- [ ] Real-time: second user sees the OTP without refreshing
- [ ] Both users confirming triggers the unwrap ceremony
- [ ] Bridge row exists in DB after ceremony
- [ ] Graveyard entry created when active piece expires (test by manually setting expires_at to the past in Supabase)
- [ ] Nightly cron function runs without error when called manually
- [ ] Email received on invite (check spam)
- [ ] UnwrapCeremony animation plays and completes correctly
- [ ] Reduced motion: ceremony skips animation
- [ ] Graveyard page shows desaturated expired pieces
- [ ] Push to main → Vercel auto-deploys
- [ ] No console errors in production build

---

## Notes for Cursor

- Run npm run typecheck after every major change
- All edge functions use Deno — import from esm.sh, not npm
- The OTP is 6 digits, zero-padded. Generate with: Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
- Real-time subscription on confirmation_sessions: subscribe to UPDATE events on the row matching session_id
- The unwrap ceremony uses CSS 3D transforms — make sure the parent element has perspective: 600px set
- Send-email is fire-and-forget: call it with fetch() but do not await the result inside other edge functions
- To test expiry locally: manually UPDATE a gum_piece SET expires_at = now() - interval '1 day' in the Supabase SQL editor, then call run-expiry manually via curl or the Supabase dashboard
- The confirmation flow must handle the race condition where both users tap confirm simultaneously — the DB update is idempotent (setting a boolean to true twice is safe), and bridge formation checks both flags after each update