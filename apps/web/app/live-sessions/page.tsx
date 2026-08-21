"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SessionCard } from "@/components/live-sessions/session-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  liveSessionsApi,
  isConfirmedRegistration,
  type GroupSession,
  type RegistrationPaymentStatus,
} from "@/lib/api/live-sessions";
import { doctorApi } from "@/lib/api/doctor";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/timezone";
import { sessionOpensAt } from "@/lib/session-window";
import {
  joinNotYetOpen,
  joinOpensAtLabel,
  joinWindowHintText,
} from "@/lib/appointment-window";

/** The list is public, so a doctor going live has to be picked up by polling. */
const REFRESH_MS = 30_000;

export default function LiveSessionsPage() {
  const { dictionary: t, dateLocale } = useI18n();
  // scheduled_at is a real instant (TIMESTAMPTZ); render it in the viewer's
  // zone explicitly, rather than relying on the runtime default and then
  // labelling it GST regardless.
  const { timezone: viewerTimezone } = useViewerTimezone();
  const user = useAuthStore((s) => s.user);
  const [upcoming, setUpcoming] = useState<GroupSession[]>([]);
  const [past, setPast] = useState<GroupSession[]>([]);
  const [registrations, setRegistrations] = useState<
    Map<string, RegistrationPaymentStatus>
  >(new Map());
  const [hostDoctorId, setHostDoctorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // The list endpoint is unauthenticated and cannot know who is asking,
        // so the viewer's own registrations are fetched alongside and joined
        // here — otherwise every card offers "Register" to someone who already
        // holds a place. Host status is joined the same way.
        const [up, pa, regs, hostDoctor] = await Promise.all([
          liveSessionsApi.listSessions("upcoming"),
          liveSessionsApi.listSessions("past"),
          user
            ? liveSessionsApi.getMyRegistrations().catch(() => [])
            : Promise.resolve([]),
          user ? doctorApi.getMe().catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setUpcoming(up);
        setPast(pa);
        setRegistrations(
          new Map(
            regs.flatMap((r) =>
              r.group_sessions
                ? [[r.group_sessions.id, r.payment_status] as const]
                : []
            )
          )
        );
        setHostDoctorId(hostDoctor?.id ?? null);
      } catch {
        // Keep whatever is already on screen rather than blanking the page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t.liveSessions.title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.liveSessions.subtitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {joinWindowHintText(t)}
            </p>
          </div>

          <Tabs defaultValue="upcoming" className="mt-10">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="upcoming">
                {t.liveSessions.upcoming}
              </TabsTrigger>
              <TabsTrigger value="past">{t.liveSessions.past}</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-6 flex flex-col gap-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-12">
                  {t.common.loading}
                </p>
              ) : upcoming.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  {t.liveSessions.noSessions}
                </p>
              ) : (
                upcoming.map((session) => {
                  const isRegistered = isConfirmedRegistration(
                    registrations.get(session.id)
                  );
                  const isHost =
                    hostDoctorId !== null &&
                    session.doctors?.id === hostDoctorId;
                  // Only the host gets the opens-at line here: the card's
                  // only enabled join CTA before a session is live is the
                  // host's. Registrants join from the detail page, which
                  // carries its own opens-at line.
                  const opensAt = sessionOpensAt(session);
                  const joinOpensAtText =
                    isHost &&
                    opensAt &&
                    joinNotYetOpen(opensAt)
                      ? joinOpensAtLabel(
                          t,
                          opensAt,
                          new Date(session.scheduled_at),
                          viewerTimezone,
                          dateLocale
                        )
                      : undefined;
                  return (
                    <Link key={session.id} href={`/live-sessions/${session.id}`}>
                      <SessionCard
                        session={{
                          id: session.id,
                          title: session.title,
                          description: session.description ?? "",
                          date: formatDateInTimezone(session.scheduled_at, viewerTimezone),
                          time: formatTimeInTimezone(session.scheduled_at, viewerTimezone),
                          timezone: viewerTimezone,
                          duration: session.duration_minutes,
                          maxUsers: session.max_participants,
                          currentUsers: session.participant_count,
                          price: Number(session.price_aed),
                          isLive: session.status === "live",
                          isRegistered,
                          paymentPending:
                            registrations.get(session.id) === "pending",
                          isHost,
                          joinOpensAtText,
                        }}
                      />
                    </Link>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="past" className="mt-6 flex flex-col gap-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-12">
                  {t.common.loading}
                </p>
              ) : past.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  {t.liveSessions.noSessions}
                </p>
              ) : (
                past.map((session) => (
                  <Link key={session.id} href={`/live-sessions/${session.id}`}>
                    <SessionCard
                      session={{
                        id: session.id,
                        title: session.title,
                        description: session.description ?? "",
                        date: formatDateInTimezone(session.scheduled_at, viewerTimezone),
                        time: formatTimeInTimezone(session.scheduled_at, viewerTimezone),
                        timezone: viewerTimezone,
                        duration: session.duration_minutes,
                        maxUsers: session.max_participants,
                        currentUsers: session.participant_count,
                        price: Number(session.price_aed),
                        isPast: true,
                        hasRecording: !!session.recording_url,
                        recordingUrl: session.recording_url ?? undefined,
                      }}
                    />
                  </Link>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
