"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SessionCard } from "@/components/live-sessions/session-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { liveSessionsApi, type GroupSession } from "@/lib/api/live-sessions";

export default function LiveSessionsPage() {
  const { dictionary: t } = useI18n();
  const [upcoming, setUpcoming] = useState<GroupSession[]>([]);
  const [past, setPast] = useState<GroupSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [up, pa] = await Promise.all([
          liveSessionsApi.listSessions("upcoming"),
          liveSessionsApi.listSessions("past"),
        ]);
        setUpcoming(up);
        setPast(pa);
      } catch {
        // leave empty arrays on error
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

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
                upcoming.map((session) => (
                  <Link key={session.id} href={`/live-sessions/${session.id}`}>
                    <SessionCard
                      session={{
                        id: session.id,
                        title: session.title,
                        description: session.description ?? "",
                        date: new Date(session.scheduled_at).toLocaleDateString(
                          "en-AE",
                          { day: "numeric", month: "short", year: "numeric" }
                        ),
                        time: new Date(session.scheduled_at).toLocaleTimeString(
                          "en-AE",
                          { hour: "2-digit", minute: "2-digit" }
                        ),
                        duration: session.duration_minutes,
                        maxUsers: session.max_participants,
                        currentUsers: session.participant_count,
                        price: Number(session.price_aed),
                        isLive: session.status === "live",
                      }}
                    />
                  </Link>
                ))
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
                        date: new Date(session.scheduled_at).toLocaleDateString(
                          "en-AE",
                          { day: "numeric", month: "short", year: "numeric" }
                        ),
                        time: new Date(session.scheduled_at).toLocaleTimeString(
                          "en-AE",
                          { hour: "2-digit", minute: "2-digit" }
                        ),
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
