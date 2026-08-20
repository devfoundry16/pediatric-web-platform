"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { liveSessionsApi } from "@/lib/api/live-sessions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function SessionRoomPage() {
  const { dictionary: t } = useI18n();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const iframeRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DailyIframe is loaded from the @daily-co/daily-js bundle which augments window
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

  const startCall = useCallback(
    async (DailyIframe: DailyFactory) => {
      if (!iframeRef.current) throw new Error("Room container not ready");

      // Fetch the Daily token + room URL from our API
      const { token, roomUrl } = await liveSessionsApi.joinSession(params.id);

      const call = DailyIframe.createFrame(iframeRef.current, {
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: "8px",
        },
        showLeaveButton: true,
      });

      callRef.current = call;

      // Without this, leaving strands the participant on Daily's own end
      // screen inside our shell instead of returning them to the session page.
      call.on("left-meeting", () => {
        call.destroy();
        callRef.current = null;
        router.push(`/live-sessions/${params.id}`);
      });

      // Hide our loading overlay as soon as the iframe is mounted.
      // Daily's prebuilt UI handles its own "connecting…" state from here.
      setLoading(false);

      // Fire join without blocking — Daily emits events for errors internally.
      call.join({ url: roomUrl, token }).catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Failed to join room";
        setError(msg);
      });
    },
    [params.id, router]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Dynamically import @daily-co/daily-js to avoid SSR issues
        const DailyIframe = (await import("@daily-co/daily-js")).default as unknown as DailyFactory;
        if (!mounted) return;
        await startCall(DailyIframe);
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Failed to join session";
        setError(msg);
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
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            if (callRef.current) {
              callRef.current.destroy();
              callRef.current = null;
            }
            router.push(`/live-sessions/${params.id}`);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t.common.back}
        </Button>
        <span className="text-sm font-medium text-foreground">
          {t.liveSessions.liveNow}
        </span>
      </div>

      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <p className="text-destructive text-sm">{error}</p>
            <Button onClick={() => router.back()}>{t.common.back}</Button>
          </div>
        )}
        <div ref={iframeRef} className="h-full w-full" />
      </div>
    </div>
  );
}
