# Email Confirmation Flow — Design

**Date:** 2026-07-15
**Status:** Approved (pending spec review)

## Goal

Email confirmation is now enabled in the Supabase project. We need the app to:

1. Route the Supabase confirmation link back into the app so it verifies the user.
2. Show a "check your email" pending screen after signup (already exists).
3. Show a dedicated success page after the user clicks the confirmation link.

This applies to both **signup** confirmation and **email-change** confirmation on profile update.

## Current state (already in place)

- `apps/web/app/auth/check-email/page.tsx` — static "check your inbox" screen, reads `?email=`. Matches the desired "just a message" pending UX. No change needed.
- `apps/web/app/auth/callback/route.ts` — a `GET` route handler that runs `supabase.auth.exchangeCodeForSession(code)` and honors a same-origin `?next=` param (sanitized against open redirect). Reusable as-is for confirmation links.
- `apps/web/middleware.ts` — `skipAuthLoggedInRedirect` exempts `/auth/callback`, `/auth/check-email`, `/auth/reset-password` from the "already logged in → bounce to dashboard" rule.

## Gaps

- `auth-store.ts › signUp` does not pass `options.emailRedirectTo`; the confirmation link destination depends solely on Supabase dashboard config.
- `auth-store.ts › updateUserEmail` (`updateUser({ email })`) likewise passes no `emailRedirectTo`.
- No success page exists for after the link is clicked.
- `login-form.tsx` ignores the `?error=confirmation_failed` param the callback sets on failure.

## Approach

Reuse the existing `/auth/callback` code-exchange flow (the same pattern the forgot-password feature already uses) rather than adding a new verify route. Point the Supabase email links at `/auth/callback?next=/auth/confirmed`.

### Flow

```
signup → /auth/check-email → user clicks email link
      → /auth/callback (exchangeCodeForSession) → /auth/confirmed → Continue → dashboard

profile email change → confirmation email → user clicks link
      → /auth/callback (exchangeCodeForSession) → /auth/confirmed → Continue → dashboard
```

## Changes

### 1. `apps/web/lib/stores/auth-store.ts`
- `signUp`: add `options.emailRedirectTo: ${window.location.origin}/auth/callback?next=/auth/confirmed`.
- `updateUserEmail`: add `options.emailRedirectTo: ${window.location.origin}/auth/callback?next=/auth/confirmed`.
- Uses `window.location.origin`, consistent with `forgot-password/page.tsx`. No new env var.

### 2. New page: `apps/web/app/auth/confirmed/page.tsx`
- Message: "Your email has been confirmed." (generic — covers signup and email change).
- **Continue** button: if a session exists, go to the role-appropriate dashboard (doctor/parent); otherwise go to `/auth/login`.
- Styled consistently with the other `/auth/*` pages.
- Strings pulled from i18n dictionaries.

### 3. `apps/web/middleware.ts`
- Add `/auth/confirmed` to `skipAuthLoggedInRedirect`, so a freshly-confirmed (now logged-in) user can see the page instead of being bounced to their dashboard.

### 4. `apps/web/components/auth/login-form.tsx`
- Read `?error=confirmation_failed` from the URL and show an inline error message ("Your confirmation link was invalid or has expired. Please sign in or request a new link.").

### 5. i18n
- Add confirmation strings (confirmed-page copy + login error message) to `apps/web/lib/i18n/dictionaries/en.json` and `ar.json`.

## Out of scope (YAGNI)

- Resend-confirmation button and change-email option on the pending screen (user chose "just a message").
- `NEXT_PUBLIC_SITE_URL` env var — `window.location.origin` is sufficient and matches existing code.
- Auto-redirect / polling on the check-email screen.
- Distinguishing signup vs email-change on the success page — one generic message serves both.

## Testing / verification

- Manual: sign up a new user → confirm the check-email screen → click the link in the received email → confirm landing on `/auth/confirmed` → Continue → correct dashboard.
- Manual: change email on profile → confirm the email-change link lands on `/auth/confirmed`.
- Manual: hit `/auth/callback` with a bad/expired code → confirm redirect to login with the visible `confirmation_failed` message.
- Verify Supabase dashboard **Redirect URLs** allow-list includes the app origin(s) so `emailRedirectTo` is honored.
