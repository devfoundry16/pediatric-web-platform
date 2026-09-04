import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  AttendanceOutcome,
  RefundOption,
  RefundRequest,
  RefundRequestStatus,
} from "@/types/appointment";

/**
 * Shared reading of a missed consultation, used by both the parent's request
 * button and the doctor's queue.
 *
 * The API is the authority — it re-checks all of this before creating a
 * request — but the UI must agree with it, or a button appears that only ever
 * returns an error.
 */

/**
 * Whether somebody failed to show up.
 *
 * `null` means the attendance sweep has not run for this consultation yet, and
 * is deliberately not a miss: an unswept appointment is undecided, not empty.
 */
export function isMissedOutcome(
  outcome: AttendanceOutcome | null | undefined
): boolean {
  return (
    outcome === "parent_only" || outcome === "doctor_only" || outcome === "neither"
  );
}

/** Whether a booking was settled and so has something to give back. */
export function isSettled(paymentStatus: string): boolean {
  return paymentStatus === "paid" || paymentStatus === "package_credit";
}

export function getRefundOptionLabel(t: Dictionary, option: RefundOption): string {
  return option === "refund"
    ? t.doctorDashboard.refundOptionMoney
    : t.doctorDashboard.refundOptionSession;
}

/** The parent-facing badge for a request that has been raised. */
export function getRefundRequestStatusLabel(t: Dictionary, status: RefundRequestStatus): string {
  const map: Record<RefundRequestStatus, string> = {
    pending: t.appointments.refundPendingBadge,
    approved: t.appointments.refundApprovedBadge,
    declined: t.appointments.refundDeclinedBadge,
  };
  return map[status] ?? status;
}

/** How the outcome reads to the doctor, who is one of the two parties. */
export function getAttendanceLabel(
  t: Dictionary,
  outcome: AttendanceOutcome | null | undefined
): string | null {
  if (outcome === "neither") return t.doctorDashboard.attendanceNobody;
  if (outcome === "doctor_only") return t.doctorDashboard.attendanceDoctorOnly;
  if (outcome === "parent_only") return t.doctorDashboard.attendanceParentOnly;
  return null;
}

/**
 * The request that speaks for this consultation.
 *
 * A consultation yields one request, enforced by a unique index. This still
 * reads defensively and takes the newest, so a historical row set carrying
 * more than one cannot render an arbitrary pick.
 */
export function latestRefundRequest(
  requests: RefundRequest[] | undefined
): RefundRequest | null {
  if (!requests || requests.length === 0) return null;
  return [...requests].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  )[0];
}

/**
 * Whether a request may be raised at all.
 *
 * One per consultation, for good. A decline is the doctor's decision, not a
 * retryable failure, so it closes the door like an approval does -- the note
 * on the decision is what carries the recourse.
 */
export function canRaiseRefundRequest(latest: RefundRequest | null): boolean {
  return latest === null;
}
