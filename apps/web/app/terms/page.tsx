"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * Terms of service.
 *
 * Google's OAuth verification expects a reachable terms page alongside the
 * privacy policy. Kept in English because that is the language Google reviews
 * in.
 *
 * NOT LEGAL ADVICE — have a lawyer review this before going live.
 */
export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 19 August 2026</p>

          <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">Medical disclaimer</h2>
              <p className="mt-2">
                Drsahar Pediatrics provides online pediatric consultations. It is not a substitute for
                emergency care.{" "}
                <strong className="text-foreground">
                  If your child has a medical emergency, call your local emergency number or go to
                  the nearest emergency department immediately.
                </strong>{" "}
                A doctor may determine that your child&apos;s condition cannot be assessed safely
                online and ask you to attend in person.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Using the service</h2>
              <p className="mt-2">
                You must be at least 18 and the parent or legal guardian of any child you book for.
                You agree to give accurate information — clinical decisions depend on it — and to
                keep your login details secure. Accounts are personal and may not be shared.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                Bookings, payments and cancellations
              </h2>
              <p className="mt-2">
                Prices are shown before you confirm and are charged in AED through our payment
                provider. Consultation packages are valid for the period stated at purchase. You may
                reschedule or cancel from your dashboard; refunds follow the policy shown at the time
                of booking. We may cancel and refund a booking if the doctor becomes unavailable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Video consultations</h2>
              <p className="mt-2">
                Consultations take place in a private video room you join from your dashboard. You
                need a stable connection, a working camera and microphone. Please do not record a
                consultation without the consent of everyone taking part.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Optional integrations</h2>
              <p className="mt-2">
                You may connect a Google Calendar so your bookings appear there automatically. This
                is optional, can be disconnected at any time, and is governed by our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Acceptable use</h2>
              <p className="mt-2">
                Do not misuse the service: no unlawful use, no attempts to access other people&apos;s
                data, no interference with the platform, and no abuse of our staff or doctors. We may
                suspend accounts that breach these terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                Availability and liability
              </h2>
              <p className="mt-2">
                We aim to keep the service available but cannot guarantee uninterrupted access, and
                we are not responsible for failures of your own device or connection. Nothing in
                these terms limits liability that cannot be limited by law, including for death or
                personal injury caused by negligence.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Changes and contact</h2>
              <p className="mt-2">
                We may update these terms; material changes will be posted here. Continuing to use
                the service after a change means you accept it. Questions: contact us through the
                details on our website.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
