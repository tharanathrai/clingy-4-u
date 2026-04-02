# Week 2 — The Pocket
**Goal:** Two connected users can make and manage plans.
**Deadline:** End of week
**Live URL:** https://clingy-4-u.vercel.app/

Read PRD.md, DESIGN.md, and .cursor/rules before starting anything.

---

## Setup tasks

### 1. Install dependencies
```
npm install date-fns
```

---

## Edge functions

### 2. Categorizer edge function
File: supabase/functions/categorize-gum/index.ts

Authenticated endpoint (validate JWT).
Accept: { title: string }

Implement the rule-based keyword categorizer from PRD.md section 8:
```typescript
const categories = [
  { slug: 'intimate',  color_hex: '#CF8EE8', keywords: ['sleepover','night in','movie','tv','chill','cozy','girls night','game night','board game','netflix','cuddle','stay in'] },
  { slug: 'active',    color_hex: '#7DD47A', keywords: ['hike','bike','cycle','walk','run','climb','kayak','swim','park','trail','outdoor','camp','sport','gym','workout'] },
  { slug: 'playful',   color_hex: '#F07868', keywords: ['paint','draw','music','concert','art','craft','make','build','studio','shoot','photo','creative','comedy','karaoke'] },
  { slug: 'explore',   color_hex: '#6DB8F0', keywords: ['travel','trip','road','visit','museum','gallery','market','festival','show','tour','explore','discover'] },
  { slug: 'recharge',  color_hex: '#82C9A0', keywords: ['yoga','spa','meditate','pilates','stretch','class','breathe','sauna','float','massage','wellness'] },
  { slug: 'savor',     color_hex: '#F0A84A', keywords: ['dinner','lunch','brunch','breakfast','café','coffee','cook','bake','restaurant','eat','drinks','bar','wine','food','tasting'] },
  { slug: 'support',   color_hex: '#E89AA8', keywords: ['help','move','support','show up','be there','hospital','appointment','pick up','drop off','errand'] },
]
```

Logic:
- Lowercase the input title, split into words
- Score each category by counting keyword matches
- Highest score wins
- Tie or no match → default to 'explore'

Return: { category: string, color_hex: string }

Deploy after creating.

### 3. Create gum piece edge function
File: supabase/functions/create-gum-piece/index.ts

Authenticated endpoint (validate JWT).
Accept: { recipient_id: string, title: string }

Steps in order:
1. Validate title is non-empty and max 60 chars
2. Confirm an active connection exists between calling user and recipient_id
3. Inline the categorizer logic to get category + color_hex
4. Slot check — global: count placeholder + active pieces where creator_id = user OR recipient_id = user. Must be under 25.
5. Slot check — per pair: count placeholder + active pieces between this exact pair. Must be under 5.
6. If either slot check fails: return 400 with { error: 'slot_limit_global' } or { error: 'slot_limit_pair' } and current count
7. Insert into gum_pieces: status = 'placeholder', expires_at = now() + 48 hours
8. Insert notification for recipient: type = 'invite_received', reference_id = new gum_piece.id
9. Return: { gum_piece: { id, title, category, color_hex, status, expires_at } }

Deploy after creating.

### 4. Respond to gum piece edge function
File: supabase/functions/respond-gum-piece/index.ts

Authenticated endpoint (validate JWT).
Accept: { gum_piece_id: string, action: 'accept' | 'turn_down' }

Steps:
1. Fetch the gum piece — must exist
2. Confirm calling user is creator_id or recipient_id
3. If action = 'accept':
   - Verify status is 'placeholder'
   - Verify calling user is recipient
   - Run slot checks (same as create)
   - Update status → 'active', accepted_at = now(), expires_at = now() + 365 days
   - Insert notification for creator: type = 'invite_accepted'
4. If action = 'turn_down':
   - Status must be 'placeholder' or 'active'
   - Update status → 'turned_down'
   - Notify the other party: type = 'invite_rejected' if was placeholder, 'plan_turned_down' if was active
5. Return: { success: true, gum_piece: updated row }

Deploy after creating.

---

## Database

### 5. RLS policies
In the Supabase dashboard SQL editor, run:
```sql
-- gum_pieces: users can view pieces they are part of
CREATE POLICY "Users can view their own gum pieces"
ON gum_pieces FOR SELECT
USING (auth.uid() = creator_id OR auth.uid() = recipient_id);

-- gum_pieces: users can update pieces they are part of
CREATE POLICY "Users can update their own gum pieces"
ON gum_pieces FOR UPDATE
USING (auth.uid() = creator_id OR auth.uid() = recipient_id);

-- notifications: users can view their own
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- notifications: users can mark their own as read
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);
```

---

## Hooks

### 6. useGumPieces hook
File: src/hooks/useGumPieces.ts

- Fetch gum pieces where creator_id = user.id OR recipient_id = user.id
- Filter to status IN ('placeholder', 'active') for pocket view
- Subscribe to real-time changes
- Return: { pieces, loading, error, refetch }

### 7. useNotifications hook
File: src/hooks/useNotifications.ts

- Fetch notifications for current user, ordered by created_at desc
- Subscribe to real-time inserts
- Expose: { notifications, unreadCount, markAsRead(id), markAllAsRead, loading }

---

## Components

### 8. GumPieceCard component
File: src/components/gum/GumPieceCard.tsx

Props: { piece: GumPiece, currentUserId: string, onPress: () => void }

Visual spec (from DESIGN.md):
- Background: bg-surface
- Top accent: 3px strip of piece's color_hex across top edge
- Corner radius: rounded-lg (20px)
- Padding: 24px
- Shadow: shadow-card
- Left: blob SVG 48×48 in piece's color_hex with slow morphing border-radius animation. Duration varies by piece.id mod 3: 3s / 3.7s / 4.2s. Use will-change: border-radius.
- Right: title (DM Sans 400 16px), CategoryChip below, expiry below that
- Expiry: humanized with date-fns — "11 months left", "2 days left", "23 hours left". Use warning color (#F0A84A) if under 7 days.
- Placeholder pieces (status: 'placeholder'): 60% opacity + subtle float animation (translateY -4px to 4px, 3s ease-in-out infinite)
- Tap → onPress

### 9. CategoryChip component
File: src/components/gum/CategoryChip.tsx

Props: { category: CategorySlug, size?: 'sm' | 'md' }

- Background: category color_hex at 20% opacity
- Text: category color_hex, DM Sans 500, uppercase
- Radius: rounded-full
- Size sm: 10px text, 4px 10px padding
- Size md: 12px text, 6px 14px padding

### 10. NotificationItem component
File: src/components/notifications/NotificationItem.tsx

Props: { notification: Notification, onPress: () => void }

Copy per type:
- invite_received → "[name] wants to make a plan with you"
- invite_accepted → "[name] accepted your plan"
- invite_rejected → "[name] passed on your plan"
- plan_turned_down → "[name] turned down a plan"
- plan_expiring_soon → "A plan is expiring soon"
- bridge_formed → "You formed a bridge!"
- connection_request → "[name] wants to connect"

- Show: avatar, copy, humanized timestamp (date-fns)
- Unread: left border 2px accent color, slightly brighter background (bg-surface-2)
- Read: normal surface background
- Tap → onPress

---

## Pages

### 11. Pocket view (/home)
File: src/pages/Home.tsx

Replace the stub with the real implementation.

Layout:
- Page title "your pocket" in font-display (Bagel Fat One), text-display (32px)
- Slot counter below title: "X / 25 slots used" in text-meta, text-3 color
- List of GumPieceCards, sorted: placeholder first (awaiting response), then active by expires_at ascending
- Pull-to-refresh (use a refresh button on mobile web — true pull-to-refresh is Capacitor v2)
- Floating "new gum" button, bottom right, above tab bar — morphing blob shape, bg-accent, Bagel Fat One label. CSS border-radius animation, same elastic easing as DESIGN.md section 12. Tapping → /piece/new (pre-check: must have at least one connection, else show toast "add someone first")
- Empty state (no connections): headline "Your pocket is empty." subline "Make a plan with someone you love." CTA → /add
- Empty state (has connections, no pieces): headline "Nothing brewing yet." subline "Who do you want to do something with?" CTA → /piece/new

### 12. Piece creation (/piece/new)
File: src/pages/PieceNew.tsx

Replace the stub with the real implementation.

Layout:
- Back button top left
- Page title "new gum" in font-display
- Recipient selector: if navigated from a profile, pre-fill. Otherwise show a list of active connections to pick from (avatar + display name). Required.
- Title input: single text input, max 60 chars, character counter bottom-right of input (DM Sans 400 12px, text-3). Placeholder: "what do you want to do together?"
- As user types (debounced 300ms): call categorize-gum edge function, show category preview chip below input — "looks like [category]" — updates live
- Submit button "wrap it" (primary style, bg-accent) — disabled until recipient selected and title non-empty
- On submit: call create-gum-piece edge function
  - slot_limit_global error: show toast "Your pocket is full (25/25). Complete or clear a plan first."
  - slot_limit_pair error: show toast "You have 5 plans with this person already."
  - Success: navigate to /home, show toast "Plan sent to [name]!"

### 13. Piece detail (/piece/:id)
File: src/pages/PieceDetail.tsx

Replace the stub with the real implementation.

Fetch the gum piece by id. User must be creator or recipient — else redirect to /home.

Layout:
- Back button top left
- Large blob shape centered, 96×96, piece's color_hex, morphing animation
- Title in font-display, 28px, centered below blob
- CategoryChip centered below title
- Status line: humanized status — "Waiting for [name] to accept", "Active · 11 months left", "Turned down", "Expired"
- Expiry bar: thin progress bar showing time elapsed vs total window, category color fill
- Action buttons at bottom (context-sensitive):

  If status = 'placeholder' AND current user is recipient:
  - Primary: "Accept" → call respond-gum-piece (accept)
  - Destructive: "Pass" → call respond-gum-piece (turn_down)

  If status = 'placeholder' AND current user is creator:
  - Destructive: "Cancel" → call respond-gum-piece (turn_down)

  If status = 'active' AND current user is creator OR recipient:
  - Primary: "Mark as done" → navigate to /piece/:id/confirm
  - Destructive: "Turn down" → call respond-gum-piece (turn_down), confirm with bottom sheet first ("Are you sure? This can't be undone.")

  If status = 'confirmed', 'expired', 'turned_down':
  - No actions. Show read-only status message.

- Real-time subscription on this piece — UI updates instantly if other user takes action

### 14. Notifications page (/notifications)
File: src/pages/Notifications.tsx

Replace the stub with the real implementation.

Layout:
- Page title "notifications" in font-display
- "Mark all as read" text button top right (text-2, only shown if unread count > 0)
- List of NotificationItems, ordered by created_at desc
- Tapping a notification: mark as read, navigate to relevant screen (gum piece → /piece/:id, connection request → /connections/requests)
- Empty state: "All caught up." centered, no CTA
- Notification badge on tab bar syncs with unreadCount from useNotifications hook

---

## Stub page update

### 15. Graveyard stub (/home/graveyard)
File: src/pages/Graveyard.tsx

Create a minimal stub (full build in Week 3):
- Page title "graveyard" in font-display
- Subline "Plans that didn't happen. Coming soon." in text-2
- Back button → /home

---

## Deploy checklist (end of week)

- [ ] npm run typecheck passes with no errors
- [ ] npm run build completes successfully
- [ ] Categorizer correctly assigns categories from typed titles (test: "get dinner" → savor, "go hiking" → active)
- [ ] Gum piece can be created from /piece/new
- [ ] Placeholder card appears in pocket for recipient
- [ ] Recipient can accept → card updates to active
- [ ] Recipient can pass → piece removed from both pockets
- [ ] Creator can turn down an active piece
- [ ] Slot limit blocks creation at 25 global / 5 per pair
- [ ] Notifications appear in real-time
- [ ] Notification badge shows unread count
- [ ] Marking notifications as read works
- [ ] Push to main → Vercel auto-deploys
- [ ] No console errors in production build

---

## Notes for Cursor

- Run npm run typecheck after every major change
- All edge functions use Deno — import from esm.sh, not npm
- The categorizer logic is inlined in create-gum-piece — do not make a network call to the categorize-gum function from within another edge function
- Test the full invite flow by opening the app in two browser tabs logged in as two different connected users
- Blob morph animation: use CSS keyframes on border-radius, not JS. Example:
  @keyframes morph { 0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40% } 50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60% } 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40% } }
- Humanized expiry examples: use date-fns formatDistanceToNow with addSuffix: false, then append "left"
- The "new gum" floating button blob shape should use the same morph keyframes, just faster (2s)