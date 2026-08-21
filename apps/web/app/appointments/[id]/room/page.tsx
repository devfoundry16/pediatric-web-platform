"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { appointmentsApi } from "@/lib/api/appointments";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

/**
 * The consultation itself, embedded in the app.
 *
 * Deliberately not a link to daily.co: the token belongs in daily-js join()
 * rather than the room URL, and leaving Daily's hosted page reloads the room
 * without the token — which, for a private room, renders "the meeting you're
 * trying to join does not exist". Embedding also means we control where Leave
 * goes, which is the dashboard.
 */
export default function AppointmentRoomPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone: viewerTimezone } = useViewerTimezone();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const iframeRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opensAt, setOpensAt] = useState<string | null>(null);

  type DailyCall = {
    join(opts: { url: string; token: string }): Promise<unknown>;
    on(event: string, handler: () => void): void;
    destroy(): void;
  };
  type DailyFactory = {
    createFrame(
      el: HTMLDivElement,
      opts: { iframeStyle: Record<string, string>; showLeaveButton: boolean }
    ): DailyCall;
  };

  // Doctors manage their day from a different dashboard than parents do.
  const role = (user?.user_metadata?.role as string) === "doctor" ? "doctor" : "parent";
  const backHref = `/dashboard/${role}/appointments?appointment=${params.id}`;

  // Known errors (the API's join-gate messages and our own fallback) are
  // translated here at render rather than in the callbacks: the dictionary
  // swaps shortly after mount for a stored non-default locale, and having it
  // in the callbacks' hook deps would tear down and re-join the call.
  const displayError =
    error === null
      ? null
      : opensAt
        ? t.appointments.joinNotOpenYet
        : error === "This consultation has ended"
          ? t.appointments.joinEnded
          : error === "Failed to join the consultation" ||
              error === "Could not join the consultation"
            ? t.appointments.joinFailed
            : error;

  const leave = useCallback(() => {
    if (callRef.current) {
      callRef.current.destroy();
      callRef.current = null;
    }
    router.push(backHref);
  }, [router, backHref]);

  const startCall = useCallback(
    async (DailyIframe: DailyFactory) => {
      if (!iframeRef.current) throw new Error("Room container not ready");

      const joinInfo = await appointmentsApi.join(params.id);

      // Outside the join window the API says when it opens, so say so rather
      // than dropping the user into a failed connection.
      if (!joinInfo.ok) {
        setOpensAt(joinInfo.opensAt ?? null);
        setError(joinInfo.error);
        setLoading(false);
        return;
      }

      const call = DailyIframe.createFrame(iframeRef.current, {
        iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "8px" },
        showLeaveButton: true,
      });

      callRef.current = call;
      // The fix for the dead-end leave screen: Daily tells us the participant
      // left, and we navigate back inside the app.
      call.on("left-meeting", leave);
      setLoading(false);

      call.join({ url: joinInfo.roomUrl, token: joinInfo.token }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to join the consultation");
      });
    },
    [params.id, leave]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Dynamically imported to avoid pulling daily-js into SSR.
        const DailyIframe = (await import("@daily-co/daily-js"))
          .default as unknown as DailyFactory;
        if (!mounted) return;
        await startCall(DailyIframe);
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to join the consultation");
        setLoading(false);
      }
    }

    void init();

    return () => {
      mounted = false;
      if (callRef.current) {
        callRef.current.destroy();
        callRef.current = null;
      }
    };
  }, [startCall]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={leave}>
          <ArrowLeft className="h-4 w-4" />
          {t.common.back}
        </Button>
        <span className="text-sm font-medium text-foreground">
          {t.appointments.consultationRoom}
        </span>
      </div>

      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          </div>
        )}
        {displayError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
            <p className="text-sm text-destructive">{displayError}</p>
            {opensAt && (
              <p className="text-sm text-muted-foreground">
                {t.appointments.roomOpensAt.replace(
                  "{time}",
                  `${formatDateInTimezone(opensAt, viewerTimezone, dateLocale)}, ${formatTimeInTimezone(opensAt, viewerTimezone, dateLocale)}`
                )}
              </p>
            )}
            <Button onClick={leave}>{t.common.back}</Button>
          </div>
        )}
        <div ref={iframeRef} className="h-full w-full" />
      </div>
    </div>
  );
}
