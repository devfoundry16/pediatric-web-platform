# Google Calendar Integration Setup

Bookings are pushed to Google Calendar, Calendly-style: the app is the source of
truth and creates, updates and deletes the events it owns.

**Anyone can connect their own calendar.** Parents and doctors connect from
their profile page (**Dashboard → Profile → Google Calendar**); an admin can
also connect one clinic-wide account from **Dashboard → Admin → Integrations**.

- **Connected** — appointments and live sessions are written directly into that
  person's own calendar, and kept in step through reschedules and cancellations.
- **Not connected** — they are invited to the clinic calendar's event by email,
  exactly as before. Nothing is required of them.

Connecting is always optional, so the integration works from day one and gets
better as people opt in. Events link to the app dashboards — video calls stay on
Daily.co.

## Step 1: Google Cloud project

Reuse the project and OAuth client created for Google Sign-In (see
`AUTH_SETUP.md`, "Step 5.5"). In [Google Cloud Console](https://console.cloud.google.com):

1. **APIs & Services → Library** → **Google Calendar API** → **Enable**.
2. **APIs & Services → OAuth consent screen**:
   - User type **External**, publishing status **In production**.
   - Add the scope `https://www.googleapis.com/auth/calendar.events`.
   - Fill in app name, logo, support email, and the links to
     `https://<your-domain>/privacy` and `https://<your-domain>/terms`
     (both ship with the app).
3. **APIs & Services → Credentials** → open the **Web application** OAuth client
   → add to **Authorized redirect URIs**:
   - `http://localhost:4000/api/google-calendar/callback` (development)
   - `https://<your-api-host>/api/google-calendar/callback` (production)

## Step 2: API environment

Add to `apps/api/.env` (values from the OAuth client page):

```
GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google-calendar/callback
```

`GOOGLE_REDIRECT_URI` must match an authorized redirect URI exactly. Restart the
API afterwards. Without these three variables the feature stays hidden — the
connect card does not render and no calendar calls are made.

## Step 3: Run the migrations

Run these in the Supabase SQL Editor, in order:

1. `database/migrations/024_google_calendar.sql`
2. `database/migrations/025_google_calendar_accounts.sql`

025 carries any account connected under 024 forward, so it is safe to run on an
environment that already had the clinic-only version.

## Step 4: Connect

- **Parents / doctors** — Dashboard → Profile → **Connect Google Calendar**.
- **Admin (clinic account)** — Dashboard → Admin → Integrations → **Connect**.
  This is the calendar that carries invitations for everyone who has not
  connected their own, so it is worth setting up even once users start
  connecting individually.

Admins can see every connected account and every calendar write (including
failures) on the Integrations page.

## Google verification — required before launch

`calendar.events` is a **sensitive** scope. Because members of the public
(parents) can connect, the app must pass Google's OAuth verification.

**Until it is approved:** a hard cap of **100 connected Google accounts**, and
users see an "unverified app" warning during consent (they can continue via
**Advanced → Continue**). Everything else keeps working — unconnected users get
email invitations as usual.

Checklist before submitting in the Cloud Console **Verification Center**:

- [ ] Consent screen published **In production** (in "Testing", refresh tokens
      die after 7 days and the integration breaks weekly).
- [ ] Privacy policy and terms live on the production domain — `/privacy` and
      `/terms` ship with the app. **Have a lawyer review them first**; the
      privacy policy contains the Limited Use affirmation Google looks for.
- [ ] Homepage on the same domain explaining what the app does.
- [ ] Domain ownership verified in Google Search Console.
- [ ] Scope justification: we request `calendar.events` (not the broader
      `calendar` scope) purely to create and manage the appointment events the
      app itself owns.
- [ ] Demo video showing the whole flow: sign in → Profile → Connect Google
      Calendar → consent screen → book an appointment → event appears.

Expect around 10 days officially, often several weeks in practice.

## What gets synced

| App change | Calendar effect |
| --- | --- |
| Appointment confirmed (credit or Stripe) | Event created on every connected participant's calendar; anyone unconnected is invited via the clinic event |
| Appointment rescheduled (parent or admin) | Every copy moves |
| Appointment cancelled / no-show / refunded | Every copy removed |
| Appointment completed | Left as calendar history |
| Live session published | Event created |
| Registration confirmed (free or paid) | Registrant gets their own event, or an invite if not connected |
| Session edited / cancelled / registration refunded | Copies patched / removed |
| User connects | Their upcoming bookings are backfilled immediately |
| User disconnects | Their copies are removed; they go back to email invitations |

A background sweep re-checks upcoming bookings every few minutes and repairs
anything a transient Google outage dropped.

## Troubleshooting

- **"Access expired — reconnect"** — the refresh token was revoked (password
  reset, access removed at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions),
  or a Testing-mode consent screen). Only that account is affected; everyone
  else keeps syncing. Click Reconnect.
- **`no_refresh_token` while connecting** — Google skipped consent because an
  old grant exists. Remove the app at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  and connect again.
- **A parent's event did not appear automatically** — they have not connected
  their calendar, so they received an invitation instead; Google adds it once
  they accept. Connecting removes that step entirely.
- **Nothing syncs at all** — either the `GOOGLE_*` variables are missing (the
  Integrations page says "Not configured") or nobody has connected an account.
- **Failures** — every failed write is listed on the Integrations page with the
  exact Google error and the account it belongs to.
