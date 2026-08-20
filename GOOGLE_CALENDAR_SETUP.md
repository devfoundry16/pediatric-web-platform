# Google Calendar Integration Setup

Bookings are pushed to Google Calendar, Calendly-style: the app is the source of
truth and creates, updates and deletes the events it owns.

**Anyone can connect their own calendar**, and their role decides what appears
on it:

| Role | What lands on their calendar | Where they connect |
| --- | --- | --- |
| **Admin** | Every appointment and live session on the platform | Dashboard → Admin → Integrations |
| **Doctor** | The appointments and sessions they host | Dashboard → Profile |
| **Parent** | The appointments they booked and sessions they registered for | Dashboard → Profile |

Each person gets their **own private copy** of the event. Nobody is added as an
attendee on anybody else's event, so one family never sees another's email
address. Anyone who has not connected a calendar simply gets nothing here — they
still receive the usual booking emails.

Connecting is always optional. Events link to the app dashboards (each calendar
shows only the link its owner can open) — video calls stay on Daily.co.

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
3. `database/migrations/026_calendar_personal_accounts.sql`

Each carries the previous version's data forward. If an earlier build connected
a shared "clinic" calendar, **disconnect it before running 026** — otherwise the
events it created stay on that Google account and have to be removed by hand.

## Step 4: Connect

- **Parents / doctors** — Dashboard → Profile → **Connect Google Calendar**.
- **Admins** — Dashboard → Admin → Integrations → **Connect**. An admin's
  calendar receives every booking on the platform.

Admins can also see every connected account and every calendar write (including
failures) on the Integrations page.

## Google verification — required before launch

`calendar.events` is a **sensitive** scope. Because members of the public
(parents) can connect, the app must pass Google's OAuth verification.

**Until it is approved:** a hard cap of **100 connected Google accounts**, and
users see an "unverified app" warning during consent (they can continue via
**Advanced → Continue**). Everything else keeps working — bookings, and the
booking emails everyone receives regardless of whether they connected a
calendar.

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
| Appointment confirmed (credit or Stripe) | Event created on the parent's, doctor's and every admin's connected calendar |
| Appointment rescheduled (parent or admin) | Every copy moves |
| Appointment cancelled / no-show / refunded | Every copy removed |
| Appointment completed | Left as calendar history |
| Live session published | Event created |
| Registration confirmed (free or paid) | Registrant gets their own event |
| Session edited / cancelled / registration refunded | Copies patched / removed |
| User connects | Their upcoming bookings are backfilled immediately (for an admin, everything) |
| User disconnects | Their copies are removed from their calendar |

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
- **A parent's event did not appear** — they have not connected a calendar.
  Only connected users receive events; everyone still gets the booking emails.
- **Nothing syncs at all** — either the `GOOGLE_*` variables are missing (the
  Integrations page says "Not configured") or nobody has connected an account.
- **An event shows at an unexpected time** — appointments are stored in the
  clinic's timezone (Asia/Dubai by default) and Google renders them in each
  viewer's own zone, so 13:00 Dubai correctly reads 11:00 on a Berlin calendar.
- **Failures** — every failed write is listed on the Integrations page with the
  exact Google error and the account it belongs to.
