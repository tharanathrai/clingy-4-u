# Week 1 — Foundation + Connections
**Goal:** Two people can sign up and add each other.
**Deadline:** End of week
**Live URL:** https://clingy-4-u.vercel.app/

Read PRD.md, DESIGN.md, and .cursor/rules before starting anything.

---

## Setup tasks (do these first, in order)

### 1. Tailwind config
Replace tailwind.config.js with the full token config from DESIGN.md section 16.
Add the Google Fonts import to index.html:
```html
<link href="https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
```
Set the base styles in index.css:
- Background: #12101A
- Font: DM Sans
- Text: #F2EFF8
- Remove all default Vite styles

### 2. Supabase client
Fill in src/lib/supabase.ts:
- Initialize Supabase client using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Export typed client

### 3. Constants
Fill in src/lib/constants.ts:
- CATEGORIES object with slug, label, color_hex for all 7 categories
- GUM_SHAPES array with all 5 shape names
- getCategoryColor(slug) helper function
- getRandomShape() helper function

### 4. TypeScript types
Fill in src/types/index.ts with interfaces for:
- User
- Connection
- GumPiece
- Bridge
- Notification
- Category
Match exactly to the database schema in PRD.md section 3.

### 5. React Router setup
Install and configure react-router-dom in main.tsx.
Set up routes for all screens listed in PRD.md section 13.
Use lazy loading for all page components.

---

## Auth

### 6. Supabase Auth config
In the Supabase dashboard, enable Google and Apple OAuth providers.
In src/hooks/useAuth.ts, create a hook that exposes:
- user (current user object)
- loading (boolean)
- signInWithGoogle()
- signInWithApple()
- signOut()

### 7. Landing page (/)
File: src/pages/Landing.tsx
- Only shown to unauthenticated users — redirect to /home if already signed in
- App name "clingy 4 u" in Bagel Fat One, large, centered
- Short tagline in DM Sans
- Sign in with Google button (primary style from DESIGN.md)
- Sign in with Apple button (secondary style)
- Dark background, grain overlay
- No other content

### 8. Auth callback (/auth/callback)
File: src/pages/AuthCallback.tsx
- Handle OAuth redirect from Supabase
- Show loading spinner while session is being set
- On success: check if user has a profile in public.users
  - No profile → redirect to /welcome
  - Has profile → redirect to /home
- On error: redirect to / with error message

### 9. Auth guard
Create src/components/layout/AuthGuard.tsx
- Wraps protected routes
- Redirects to / if not authenticated
- Shows loading state while checking auth

---

## Onboarding

### 10. Welcome / onboarding (/welcome)
File: src/pages/Welcome.tsx
- 3-step flow, linear, no skipping
- Step 1: Display name input (required, max 50 chars)
- Step 2: Username input (required, max 30 chars, lowercase, no spaces)
  - Real-time availability check against public.users (debounced 400ms)
  - Show checkmark if available, error if taken
- Step 3: Avatar — show generated initial avatar by default, option to upload image
  - Upload goes to Supabase Storage bucket 'avatars'
- Progress indicator (3 dots) at top
- On complete: insert row into public.users, redirect to /add
- Bagel Fat One for step headlines, DM Sans for inputs and labels

---

## Connections

### 11. Add someone — QR display (/add)
File: src/pages/Add.tsx
- Protected route
- Calls edge function to generate a rotating QR token (POST /functions/v1/generate-qr-token)
- Displays QR code using 'qrcode.react' library (install it)
- 60-second countdown ring around QR code (CSS animation)
- Auto-refreshes token when countdown reaches 0
- "Switch to scan" button → /add/scan
- Explanation copy: "Show this to someone you want to connect with. It refreshes every 60 seconds."

### 12. Scan QR (/add/scan)
File: src/pages/AddScan.tsx
- Use 'html5-qrcode' library (install it) for camera access
- On successful scan: call edge function to validate token (POST /functions/v1/validate-qr-token)
- Success state: show scanned user's name and avatar, "Send request" CTA
- Error states:
  - Token expired: "This code has expired. Ask them to refresh."
  - Already connected: "You're already connected with this person."
  - Own QR: "That's your own code."
- Back button → /add

### 13. Connection requests (/connections/requests)
File: src/pages/ConnectionRequests.tsx
- List of pending incoming connection requests
- Each item: avatar, display name, username, Accept + Ignore buttons
- Accept: update connection status to 'active', set accepted_at, create notification
- Ignore: leave as pending (don't delete — they can try again)
- Empty state: "No pending requests."

---

## Profile stub

### 14. Your profile — stub (/profile/me)
File: src/pages/ProfileMe.tsx
- Minimal for Week 1 — full version in Week 5
- Show display name, username, avatar
- "Add someone" button → /add
- Settings link → /settings (stub page, just a back button for now)

---

## Layout

### 15. Bottom tab bar
File: src/components/layout/BottomTabBar.tsx
- 5 tabs: Pocket (/home), Network (/network), Feed (/feed), Notifications (/notifications), Profile (/profile/me)
- Use Lucide React icons, strokeWidth={1.75}, size 22
- Active tab: --color-accent (#CF8EE8)
- Inactive: --color-text-tertiary (#5C5478)
- Notification badge on notifications tab (red dot, 8px)
- Safe area inset bottom padding
- Fixed to bottom, full width, background --color-surface (#1E1B2E)
- Top border: 1px solid --color-border

### 16. Page layout wrapper
File: src/components/layout/Layout.tsx
- Wraps all authenticated pages
- Renders children + BottomTabBar
- Page content has padding-bottom to clear the tab bar

### 17. Stub pages
Create minimal stub pages for routes not built this week.
Each stub just shows the page name centered and the tab bar.
- src/pages/Home.tsx → "Pocket coming in Week 2"
- src/pages/Network.tsx → "Network coming in Week 4"
- src/pages/Feed.tsx → "Feed coming in Week 6"
- src/pages/Notifications.tsx → "Notifications coming soon"

---

## Edge functions

### 18. Generate QR token
File: supabase/functions/generate-qr-token/index.ts
- Authenticated endpoint (validate JWT)
- Delete any existing unexpired tokens for this user
- Generate a random 32-char token
- Insert into rotating_qr_tokens with expires_at = now() + 60 seconds
- Return: { token, expires_at }

### 19. Validate QR token
File: supabase/functions/validate-qr-token/index.ts
- Authenticated endpoint (validate JWT)
- Accept: { token }
- Look up token in rotating_qr_tokens
- Validate: exists, not expired, not used, not owned by calling user
- If valid:
  - Mark token as used
  - Check if connection already exists between the two users
  - If not: create pending connection (requested_by = calling user)
  - Return: { success: true, user: { display_name, username, avatar_url } }
- If invalid: return appropriate error message

---

## Deploy checklist (end of week)

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run build` completes successfully
- [ ] Sign in with Google works on live URL
- [ ] New user flow completes (name → username → avatar → /add)
- [ ] QR code generates and refreshes every 60 seconds
- [ ] QR scan sends connection request
- [ ] Connection request can be accepted
- [ ] Two test accounts are connected to each other
- [ ] Push to main → Vercel auto-deploys
- [ ] No console errors in production build

---

## Notes for Cursor

- Run `npm run typecheck` after every major change
- If you hit a type error you can't resolve, add a comment `// TODO: fix type` and move on — do not use `any`
- All edge functions use Deno — import from esm.sh, not npm
- Test the QR flow by opening the app in two different browser tabs logged in as two different users
- The grain overlay goes in index.html as a fixed div with z-index 9999 and pointer-events none
