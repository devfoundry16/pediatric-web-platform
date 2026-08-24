"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * Privacy policy.
 *
 * Google requires a publicly reachable privacy policy before it will verify an
 * OAuth app that uses a sensitive scope (we request calendar.events), and the
 * "Google user data" section below carries the Limited Use affirmation their
 * reviewers look for. Kept in English because that is the language Google
 * reviews in.
 *
 * NOT LEGAL ADVICE — have a lawyer review this before submitting for
 * verification or going live.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 19 August 2026</p>

          <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">Who we are</h2>
              <p className="mt-2">
                Drsahar Pediatrics provides online pediatric consultations and health education. This policy
                explains what we collect, why, and the choices you have. It covers our website, the
                parent and doctor dashboards, and any integration you choose to enable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Information we collect</h2>
              <ul className="mt-2 flex list-disc flex-col gap-2 ps-5">
                <li>
                  <strong className="text-foreground">Account details</strong> — your name, email
                  address and phone number, so we can identify you and contact you about bookings.
                </li>
                <li>
                  <strong className="text-foreground">Child profiles</strong> — the details you add
                  about your child, used to provide care and shown to the treating doctor.
                </li>
                <li>
                  <strong className="text-foreground">Consultation records</strong> — appointment
                  times, the reason for the visit you provide, and clinical notes written by your
                  doctor.
                </li>
                <li>
                  <strong className="text-foreground">Payment information</strong> — processed by
                  Stripe. We store only a payment reference, never your card number.
                </li>
                <li>
                  <strong className="text-foreground">Technical data</strong> — basic log data needed
                  to keep the service secure and working.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                Google user data and Google Calendar
              </h2>
              <p className="mt-2">
                Connecting your Google Calendar is optional. If you do not connect it, you simply
                receive calendar invitations by email instead, and we never access your Google
                account.
              </p>
              <p className="mt-2">If you choose to connect it, we ask Google for:</p>
              <ul className="mt-2 flex list-disc flex-col gap-2 ps-5">
                <li>
                  <strong className="text-foreground">Your email address</strong> (
                  <code>openid</code>, <code>email</code>) — only so we can show you which Google
                  account is connected.
                </li>
                <li>
                  <strong className="text-foreground">Calendar events</strong> (
                  <code>calendar.events</code>) — to add your Drsahar Pediatrics appointments and live
                  sessions to your calendar, and to keep them accurate when a booking is rescheduled
                  or cancelled.
                </li>
              </ul>
              <p className="mt-2">
                We only create and manage the events we place there ourselves. We do not read,
                analyse, export or store the other events in your calendar, and we do not build any
                profile from your calendar.
              </p>
              <p className="mt-2">
                <strong className="text-foreground">Limited Use.</strong> Drsahar Pediatrics&apos;s use and
                transfer of information received from Google APIs adheres to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. We never sell Google user data, never use
                it for advertising, and never allow humans to read it except where required for
                security, to comply with the law, or with your explicit consent.
              </p>
              <p className="mt-2">
                We store the access credential Google issues so we can keep your calendar up to date
                without asking you again. It is held encrypted at rest, is never shared, and is
                deleted the moment you disconnect. You can disconnect at any time from your profile
                page, or revoke access directly at{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  myaccount.google.com/permissions
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">How we use your information</h2>
              <p className="mt-2">
                To provide consultations, take bookings and payments, send you confirmations and
                reminders, keep records your doctor needs to treat your child safely, and to secure
                and improve the service. We do not sell your personal information, and we do not use
                health information for advertising.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Who we share it with</h2>
              <p className="mt-2">
                Only with the providers that make the service work — Supabase (database and
                authentication), Stripe (payments), Daily.co (video calls), Resend (email) and, if
                you connect it, Google Calendar. Each receives only what it needs. We also disclose
                information where the law requires it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Keeping and deleting data</h2>
              <p className="mt-2">
                Medical records are kept for as long as applicable healthcare regulations require.
                Other data is kept while your account is active. You can ask us to delete your
                account at any time; we will remove what we are not legally required to retain.
                Disconnecting Google Calendar deletes the stored Google credential immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Your rights</h2>
              <p className="mt-2">
                You can access, correct, export or delete your information, withdraw consent for any
                optional integration, and object to certain processing. Contact us and we will
                respond within the period the law allows.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Security</h2>
              <p className="mt-2">
                Data is encrypted in transit and at rest. Access is restricted to the people who need
                it to deliver care or support the service. Video consultations use private rooms that
                require a per-participant token to join.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Children&apos;s privacy</h2>
              <p className="mt-2">
                Accounts are for parents and guardians. Information about a child is provided by, and
                remains under the control of, their parent or guardian.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Changes and contact</h2>
              <p className="mt-2">
                If this policy changes materially we will say so here and, where appropriate, notify
                you. Questions or requests: contact us through the details on our website.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
