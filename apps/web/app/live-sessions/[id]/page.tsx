"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  Clock,
  Users,
  Video,
  Radio,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import {
  liveSessionsApi,
  type GroupSession,
  type SessionRegistration,
} from "@/lib/api/live-sessions";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatTimeInTimezone } from "@/lib/timezone";

export default function SessionDetailPage() {
  const { dictionary: t } = useI18n();
  // scheduled_at is a real instant (TIMESTAMPTZ) — format it with an explicit
  // zone rather than relying on the runtime default.
  const { timezone: viewerTimezone } = useViewerTimezone();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const [session, setSession] = useState<GroupSession | null>(null);
  const [registration, setRegistration] = useState<SessionRegistration | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // If Stripe redirected back with a session ID, verify the payment first
        const stripeSessionId = searchParams.get("stripe_session_id");
        if (stripeSessionId && user) {
          try {
            await liveSessionsApi.verifyPayment(stripeSessionId);
            setSuccessMsg(t.liveSessions.paymentConfirmed);
          } catch {
            // Webhook may have already confirmed it; fall through to load registration
          }
        } else if (searchParams.get("registered") === "1") {
          setSuccessMsg(t.liveSessions.alreadyRegistered);
        }

        const s = await liveSessionsApi.getSession(params.id);
        setSession(s);

        if (user) {
          try {
            const regs = await liveSessionsApi.getMyRegistrations();
            const match = regs.find(
              (r) => r.group_sessions?.id === params.id
            );
            if (match) setRegistration(match);
          } catch {
            // not registered or not logged in
          }
        }
      } catch {
        setError("Session not found");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.id, user]);

  const isRegistered =
    registration?.payment_status === "free" ||
    registration?.payment_status === "paid";

  async function handleRegister() {
    if (!user) {
      router.push(`/auth/login?redirectTo=/live-sessions/${params.id}`);
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const result = await liveSessionsApi.register(params.id);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else if (result.registration) {
        setRegistration(result.registration);
        setSuccessMsg(t.liveSessions.alreadyRegistered);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Registration failed";
      setError(msg);
    } finally {
      setRegistering(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-destructive">{error ?? "Session not found"}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const spotsLeft = session.max_participants - session.participant_count;
  const isFull = spotsLeft <= 0;
  const scheduledDate = new Date(session.scheduled_at);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/live-sessions"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.liveSessions.title}
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                  {session.title}
                </h1>
                {session.status === "live" && (
                  <Badge className="gap-1 bg-red-500 text-white hover:bg-red-600">
                    <Radio className="h-3 w-3" />
                    {t.liveSessions.live}
                  </Badge>
                )}
                {session.status === "ended" && (
                  <Badge variant="secondary">{t.liveSessions.statusEnded}</Badge>
                )}
              </div>
              {session.doctors && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.liveSessions.hostedBy} {session.doctors.full_name}
                  {session.doctors.specialty
                    ? ` · ${session.doctors.specialty}`
                    : ""}
                </p>
              )}
            </div>
            {session.is_free ? (
              <Badge variant="secondary" className="text-base px-3 py-1">
                {t.liveSessions.free}
              </Badge>
            ) : (
              <Badge className="text-base px-3 py-1">
                {Number(session.price_aed)} {t.common.aed}
              </Badge>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {scheduledDate.toLocaleDateString("en-AE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: viewerTimezone,
              })}
            </span>
            <span className="flex items-center gap-x-1.5 gap-y-1 flex-wrap">
              <Clock className="h-4 w-4" />
              {formatTimeInTimezone(scheduledDate, viewerTimezone)}{" "}
              ({session.duration_minutes} {t.common.minutes})
              <TimezoneNotice timezone={viewerTimezone} variant="compact" />
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {session.participant_count}/{session.max_participants}{" "}
              {t.liveSessions.participants}
            </span>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {/* Description */}
            <Card className="sm:col-span-2">
              <CardContent className="p-6">
                <h2 className="font-semibold text-foreground mb-3">
                  {t.liveSessions.aboutSession}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {session.description ?? "—"}
                </p>
              </CardContent>
            </Card>

            {/* Registration panel */}
            <Card>
              <CardContent className="p-6 flex flex-col gap-4">
                {successMsg && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    {successMsg}
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                {session.status === "ended" ? (
                  session.recording_url ? (
                    <Button asChild className="w-full gap-2">
                      <a
                        href={session.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Video className="h-4 w-4" />
                        {t.liveSessions.watchRecording}
                      </a>
                    </Button>
                  ) : (
                    <p className="text-sm text-center text-muted-foreground">
                      {t.liveSessions.sessionEnded}
                    </p>
                  )
                ) : session.status === "live" && isRegistered ? (
                  <Button
                    className="w-full gap-2"
                    onClick={() =>
                      router.push(`/live-sessions/${params.id}/room`)
                    }
                  >
                    <Radio className="h-4 w-4" />
                    {t.liveSessions.joinRoom}
                  </Button>
                ) : isRegistered ? (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <p className="text-sm font-medium">
                      {t.liveSessions.alreadyRegistered}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.liveSessions.scheduledFor}{" "}
                      {formatTimeInTimezone(scheduledDate, viewerTimezone)}
                    </p>
                  </div>
                ) : isFull ? (
                  <p className="text-sm text-center text-destructive font-medium">
                    {t.liveSessions.sessionFull}
                  </p>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={handleRegister}
                    disabled={registering}
                  >
                    <Video className="h-4 w-4" />
                    {registering
                      ? t.common.loading
                      : session.is_free
                      ? t.liveSessions.registerFree
                      : `${t.liveSessions.registerSession} — ${Number(session.price_aed)} ${t.common.aed}`}
                  </Button>
                )}

                {!isFull && !isRegistered && session.status === "scheduled" && (
                  <p className="text-xs text-center text-muted-foreground">
                    {spotsLeft} {t.liveSessions.spotsLeft}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
