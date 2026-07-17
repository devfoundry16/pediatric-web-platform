# Booking redesign: single consultation + purchasable packages

**Date:** 2026-07-17
**Status:** Approved (ready for implementation planning)

## Problem

When a parent clicks "Book Consultation", the first screen offers three timed
tiers (15 / 30 / 45 min at 150 / 250 / 350 AED). Business now wants:

1. A single **one-time consultation** (399 AED) instead of the three tiers.
2. Two purchasable **packages** surfaced at the same decision point — Monthly
   Follow-up (1400 AED) and Newborn Care (1200 AED) — so a parent can buy credit
   for repeat consultations. (Emergency Priority package stays available.)
3. After a parent owns package credit, the consultation-selection screen is
   **skipped** on subsequent bookings — they go straight to date/time and a
   credit is consumed.
4. Parents can buy **more than one** package at once via a quantity selector.
5. Payments are real: the one-time consult and package purchases both charge
   through Stripe. Package-credit bookings remain free.

## Current state (relevant facts)

- **Consultation types** are hardcoded in three places: `step-select-type.tsx`,
  `apps/api/src/controllers/appointments.ts` (`CONSULTATION_CONFIG`), and
  `apps/web/types/appointment.ts` (`CONSULTATION_TYPES`). The DB enforces
  `CHECK (consultation_type IN ('quick','standard','extended'))`
  (migration `002_appointments.sql`).
- **Packages** already exist (migration `006_consultation_packages.sql`):
  Monthly Follow-up (4×30min @ 750, applies to `standard`), Newborn Care
  (3×30min @ 600, applies to `standard`), Emergency Priority (1×30min @ 350,
  applies to `quick`,`standard`). There is a working packages page
  (`/dashboard/parent/packages`) with **real Stripe checkout** (quantity hardcoded
  to 1) and a webhook that provisions credits.
- **Booking** (`appointments.create`) already auto-consumes a matching active
  package credit; when none matches it marks the appointment `paid` with a
  **fake** reference and no real charge. The Stripe webhook is registered once at
  `POST /api/packages/webhook` and already handles package + group-session
  payments, refunds, and disputes.

## Decisions (resolved with stakeholder)

- One-time consult: **single 45-min type, 399 AED**, replaces the three tiers.
- One-time consult **charges via Stripe** (webhook-confirmed appointment).
- Packages: reprice Monthly → 1400, Newborn → 1200; **keep** Emergency (350).
- After buying a package in the booking flow, **continue to pick a time**
  (skip the selection screen, consume a credit).
- Quantity: buy N at once → **N × price, N × credits** in a single checkout.
- New explicit consultation type id `consultation` (not overloading `extended`).
- Abandoned one-time checkouts must not hold slots forever (see §6).

## Design

### 1. Single consultation model

Introduce a new consultation type id **`consultation`** (45 min, 399 AED).

- Migration extends the CHECK to
  `consultation_type IN ('quick','standard','extended','consultation')` so
  historical appointments remain valid while new bookings use `consultation`.
- `appointments.ts` `CONSULTATION_CONFIG` gains
  `consultation: { duration: 45, price: 399 }`.
- `types/appointment.ts`: add `consultation` to the union; `CONSULTATION_TYPES`
  becomes the single consult (historical ids kept in the union for display).
- `consultation-labels` gains a `consultation` label ("Consultation").
- Booking UI offers only `consultation`.

### 2. Packages repricing — migration `013_booking_packages.sql`

- `UPDATE consultation_packages SET price_aed = 1400 WHERE slug = 'monthly_followup';`
- `UPDATE consultation_packages SET price_aed = 1200 WHERE slug = 'newborn_care';`
- Emergency Priority unchanged (350).
- Set `applicable_consultation_types` to include `consultation` for all three
  packages, so credits apply to the new single consult.
- UPDATE/ALTER only — **no RLS policy changes**.

### 3. New booking entry screen (replaces `step-select-type.tsx`)

Data-driven from `packagesApi.list()` (DB is the single source of price truth).
Renders:

- **One-time Consultation** card — 399 AED / 45 min → selectable, then the normal
  flow continues (sets `typeId = 'consultation'`).
- **Package cards** (Monthly / Newborn / Emergency) — each with a **quantity
  stepper** (min 1) and a **"Buy & Continue"** button → Stripe checkout.

### 4. Booking flow (`app/booking/page.tsx`)

Step order unchanged: child → entry → date/time → symptoms → review.

- **Skip logic:** when the flow reaches the entry step, check `getMyPackages`;
  if an active applicable credit exists, auto-advance to the date/time step (the
  entry screen never renders).
- **Resume after package purchase:** package checkout `success_url` returns to
  `/booking?resume=1&childId=<id>`. The page restores the child, **polls
  `getMyPackages`** until the purchased credit appears (bounded timeout with a
  friendly "finalizing payment" state to absorb webhook latency), then jumps to
  the date/time step. Booking then consumes one credit (free).

### 5. One-time consult = real Stripe charge

- `appointments.create` splits on credit availability:
  - **Credit available** → consume credit, `status: confirmed`,
    `payment_status: package_credit` (existing behavior).
  - **No credit** → create appointment `status: pending`,
    `payment_status: pending`, `price_aed: 399`, **no fake reference**; return
    its id.
- New `POST /api/appointments/checkout { appointmentId }`: validates the
  appointment belongs to the caller and is pending → creates a Stripe session
  (Consultation, 399 AED, currency `aed`), metadata
  `{ type: 'appointment', appointmentId, userId }`,
  `success_url = /booking/success?appointment=<id>`,
  `cancel_url = /booking?cancelled=<id>`. Returns the checkout URL.
- Webhook (extend existing `stripeWebhook`): on `checkout.session.completed` with
  `metadata.type === 'appointment'` → set appointment `payment_status: paid`,
  `status: confirmed`, store `stripe_checkout_session_id` /
  `stripe_payment_intent`. Refund/dispute events matching the stored
  `payment_intent` → `payment_status: refunded`, `status: cancelled`.
- New columns on `appointments`:
  `stripe_checkout_session_id text`, `stripe_payment_intent text`
  (added in migration `013`; needed for refund matching).

### 6. Slot integrity for pending one-time appointments

A `pending` appointment reserves its slot (the conflict check already counts
non-cancelled/rescheduled rows). To prevent abandoned checkouts from holding
slots forever:

- On `cancel` return (`/booking?cancelled=<id>`), call an endpoint to delete the
  caller's own pending, unpaid appointment.
- The slot conflict check ignores `pending` appointments older than ~15 minutes
  (the payment window), so a stale hold cannot block a new booking.

### 7. Quantity (packages)

- `packages/checkout` accepts `quantity` (integer ≥ 1, sane upper bound):
  Stripe line item `quantity: N` (charges N × unit price); `metadata.quantity = N`.
- Webhook provisions `credits_total = credits_remaining = N × pkg.sessions` in a
  single `user_packages` row; idempotent upsert on `stripe_checkout_session_id`
  is unchanged.
- Package checkout `success_url` / `cancel_url` are parameterized by a `source`
  (`booking` vs `packages`) plus `childId`, so a booking-initiated purchase
  returns into the booking flow (§4) while the standalone packages page keeps its
  existing success page.
- The standalone packages page gains the same quantity stepper for consistency.

## Affected files (rough)

- **DB:** `database/migrations/013_booking_packages.sql`; sync `database/schema.sql`.
- **API:** `controllers/appointments.ts`, `routes/appointments.ts`,
  `controllers/packages.ts` (quantity + source-based success routing + webhook
  handling for `appointment` type and quantity).
- **Web:** `types/appointment.ts`, `types/packages.ts`,
  `lib/api/appointments.ts`, `lib/api/packages.ts`,
  new booking entry screen (replacing `components/booking/step-select-type.tsx`),
  `app/booking/page.tsx`, new `app/booking/success/page.tsx`,
  `components/booking/step-review.tsx` (single-consult price/label),
  `lib/i18n/consultation-labels.ts`, dictionaries `en.json` / `ar.json`,
  `app/dashboard/parent/packages/page.tsx` (quantity stepper).

## Out of scope

- Going live on Stripe (swapping `sk_live_…`, live webhook secret, registering
  the live endpoint) — an ops step, not code.
- Changing group/live-session payments.
- Reworking historical appointment records.

## Risks / notes

- **Webhook latency on resume** — mitigated by bounded polling on the resume
  path (§4); a timeout shows a retry state rather than silently booking at full
  price.
- **Pending-slot holds** — mitigated by cancel-cleanup + stale-pending exclusion
  (§6).
- **Consultation-type consolidation** — the union/CHECK keep old ids valid so
  existing appointments still render; only new bookings use `consultation`.
