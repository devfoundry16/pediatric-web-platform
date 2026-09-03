"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { doctorApi, type DoctorRemedyRequest } from "@/lib/api/doctor";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { getAttendanceLabel, getRemedyLabel } from "@/lib/remedy";
import { DEFAULT_TIMEZONE, formatStoredAppointment } from "@/lib/timezone";

/**
 * The claims waiting on this doctor after a missed consultation.
 *
 * Renders nothing at all when the queue is empty, so it costs the appointments
 * page no vertical space on the ordinary day where nobody missed anything.
 */
export function RefundRequests({ onResolved }: { onResolved?: () => void }) {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone: viewerTimezone } = useViewerTimezone(DEFAULT_TIMEZONE);

  const [requests, setRequests] = useState<DoctorRemedyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // The request being answered, and how. Held together so the confirmation
  // dialog can describe the exact consequence of this particular decision.
  const [pending, setPending] = useState<{
    request: DoctorRemedyRequest;
    action: "approve" | "decline";
  } | null>(null);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await doctorApi.getRemedyRequests("pending"));
    } catch {
      // A failed queue load must not take the appointments page down with it.
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm() {
    if (!pending) return;
    setIsSaving(true);
    try {
      await doctorApi.resolveRemedyRequest(pending.request.id, pending.action, note);
      toast.success(
        pending.action === "approve"
          ? t.doctorDashboard.remedyApproved
          : t.doctorDashboard.remedyDeclined
      );
      setPending(null);
      setNote("");
      await load();
      onResolved?.();
    } catch {
      toast.error(t.doctorDashboard.remedyFailed);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (requests.length === 0) return null;

  /**
   * What approving actually does, which differs by remedy and by how the
   * consultation was paid for. A refund against a credit booking returns the
   * credit rather than money, and the doctor should know that before clicking.
   */
  function approveBody(request: DoctorRemedyRequest): string {
    if (request.requested_remedy === "free_session") {
      return t.doctorDashboard.remedyApproveSessionBody;
    }
    return request.appointments?.payment_status === "package_credit"
      ? t.doctorDashboard.remedyApproveCreditBody
      : t.doctorDashboard.remedyApproveRefundBody;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <LifeBuoy className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          {t.doctorDashboard.remedyQueue}
        </h2>
        <Badge variant="secondary">{requests.length}</Badge>
      </div>

      {requests.map((request) => {
        const appt = request.appointments;
        const child = appt?.child_profiles;
        const childName = child ? `${child.first_name} ${child.last_name}` : "—";
        const attendance = getAttendanceLabel(t, appt?.attendance_outcome);
        const shownAt = appt
          ? formatStoredAppointment(
              appt.scheduled_date,
              appt.scheduled_time,
              appt.timezone ?? DEFAULT_TIMEZONE,
              viewerTimezone,
              dateLocale
            )
          : null;

        return (
          <Card key={request.id}>
            <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {childName}
                  {request.parent_name ? (
                    <span className="text-muted-foreground"> · {request.parent_name}</span>
                  ) : null}
                </p>
                {shownAt && (
                  <p className="text-xs text-muted-foreground">
                    {shownAt.date} · {shownAt.time}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t.doctorDashboard.remedyAsked}{" "}
                  <span className="font-medium text-foreground">
                    {getRemedyLabel(t, request.requested_remedy)}
                  </span>
                  {attendance ? ` · ${attendance}` : ""}
                </p>
                {request.reason && (
                  <p className="text-xs italic text-muted-foreground">
                    “{request.reason}”
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPending({ request, action: "decline" });
                    setNote("");
                  }}
                >
                  {t.doctorDashboard.remedyDecline}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setPending({ request, action: "approve" });
                    setNote("");
                  }}
                >
                  {t.doctorDashboard.remedyApprove}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pending?.action === "approve"
                ? t.doctorDashboard.remedyApproveTitle
                : t.doctorDashboard.remedyDeclineTitle}
            </DialogTitle>
            <DialogDescription>
              {pending
                ? pending.action === "approve"
                  ? approveBody(pending.request)
                  : t.doctorDashboard.remedyDeclineBody
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remedy-note">{t.doctorDashboard.remedyNote}</Label>
            <Textarea
              id="remedy-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={confirm} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending?.action === "approve"
                ? t.doctorDashboard.remedyApprove
                : t.doctorDashboard.remedyDecline}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
