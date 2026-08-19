"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n-context";
import { calendarApi, type CalendarConnectionStatus } from "@/lib/api/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Lets a parent or doctor connect their own Google Calendar, so their bookings
 * are written straight into it. Anyone who does not connect keeps receiving
 * ordinary email invitations instead, so this is always optional.
 */
function GoogleCalendarCardInner() {
  const { dictionary: t } = useI18n();
  const g = t.profile.googleCalendar;
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<CalendarConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    calendarApi
      .getStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The OAuth callback redirects back here with the outcome in the query.
  useEffect(() => {
    if (searchParams.get("calendar") === "connected") toast.success(g.connectedToast);
    const error = searchParams.get("calendar_error");
    if (error) toast.error(error === "no_refresh_token" ? g.errorNoRefreshToken : g.errorGeneric);
  }, [searchParams, g]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      window.location.href = await calendarApi.connect();
    } catch {
      toast.error(g.errorGeneric);
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await calendarApi.disconnect();
      toast.success(g.disconnectedToast);
      load();
    } catch {
      toast.error(g.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  // Nothing to offer if the server has no Google credentials configured.
  if (!loading && !status?.configured) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          {g.title}
        </CardTitle>
        <CardDescription>{g.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : status?.connected ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{status.email}</span>
                <span className="text-xs text-muted-foreground">
                  {status.status === "error" ? g.needsReconnect : g.connected}
                </span>
              </div>
              <div className="flex gap-2">
                {status.status === "error" && (
                  <Button onClick={handleConnect} disabled={busy}>
                    {g.reconnect}
                  </Button>
                )}
                <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
                  {g.disconnect}
                </Button>
              </div>
            </div>
            {status.status === "error" && (
              <p className="text-xs text-destructive">{g.needsReconnectHint}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{g.notConnected}</p>
            <Button onClick={handleConnect} disabled={busy}>
              {busy ? t.common.loading : g.connect}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// useSearchParams (used to read the OAuth callback outcome) needs a Suspense
// boundary or Next fails the prerender of the profile pages.
export function GoogleCalendarCard() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <GoogleCalendarCardInner />
    </Suspense>
  );
}
