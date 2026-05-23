# Agent Session Template

Every coding session follows this checklist in order. Roles are sequential, not parallel — each role produces an artifact before the next role writes code.

---

## Session checklist

### 1. PM — Scope & regression surface (5 min)

Before writing any code, answer:

- **What flows are touched?** (list from DEVDOC)
- **What shared hooks/libs are touched?** (anything in `src/hooks/`, `src/lib/`)
- **What edge functions are touched?** (anything in `supabase/functions/`)
- **What is the regression risk?** (which of the 15 flows could break as a side effect)

Write one paragraph. Add a row to `docs/regression-matrix.md` with flows + shared libs.

### 2. Product designer — Four-state checklist

For every screen touched, confirm:

- [ ] Loading state: skeleton (not spinner) matching DESIGN.md § 12
- [ ] Error state: friendly message + retry button, DESIGN.md voice
- [ ] Empty state: copy from DESIGN.md § 13
- [ ] Happy path: matches PRD spec

### 3. Frontend engineer — Implementation

Rules that are not optional:

- Use `subscribePostgresChannel()` from `src/lib/realtime.ts` — never call `supabase.channel()` directly
- Use `queryKeys.*` from `src/lib/queryKeys.ts` for all query keys — never inline arrays
- Use `invalidate*()` from `src/lib/invalidate.ts` for cross-flow invalidations
- Run `npm run typecheck` after every file group — do not accumulate type errors
- Run `npm run lint` after every file group — `import/first` errors are blocking

### 4. Backend / Integration engineer (if applicable)

For any edge function touched:

- [ ] JWT validated with `supabase.auth.getUser()`
- [ ] All inputs validated with explicit error codes
- [ ] RLS policy verified for every table the function touches
- [ ] DEVDOC "Architecture decisions" updated if a new pattern is introduced

### 5. QA engineer — Tests

For every bug fix:
- Write a failing test first, then the fix, then confirm green

For every new feature touching a shared lib:
- Add or update a test in `src/tests/`
- Run `npm run test` — must be 100% green before moving on

### 6. Integration — E2E smoke

For any flow that changes navigation, auth, or realtime:
- Add or update a spec in `e2e/smoke.spec.ts`
- If a preview URL is available, run `npx playwright test`
- If not available (CI only), annotate the PR with the relevant spec name

### 7. Close — DEVDOC + regression matrix

Before the session is considered done:

- Update `DEVDOC.md` flow status to `Verified (automated)` or `Verified (manual)` — never "Working" without evidence
- Fill in the session row in `docs/regression-matrix.md`
- Run the full quality gate: `npm run quality`

If `npm run quality` fails, the session is **not done**.

---

## Status vocabulary

| Status | Meaning |
|---|---|
| `Verified (automated)` | Covered by a passing unit or E2E test |
| `Verified (manual)` | Tested manually in the last 7 days; checklist entry in regression matrix |
| `Broken` | Known regression — must be fixed before ship |
| `Not built` | Spec exists but no code yet |

---

## Common patterns (quick reference)

**Subscribe to realtime changes:**
```ts
useEffect(() => {
  if (!userId) return
  return subscribePostgresChannel(`my-prefix-${userId}`, [
    { event: '*', table: 'my_table', callback: () => { void queryClient.invalidateQueries({ queryKey }) } },
  ])
}, [queryClient, userId])
```

**Invalidate a query key:**
```ts
import { invalidateNetworkGraph } from '../lib/invalidate.ts'
invalidateNetworkGraph(userId, queryClient)
```

**Mark onboarding complete:**
```ts
import { markProfileReady } from '../hooks/useProfileReady.ts'
markProfileReady(user.id, queryClient)
navigate('/add', { replace: true })
```
