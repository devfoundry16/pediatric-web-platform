import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  AttendanceOutcome,
  RemedyKind,
  RemedyStatus,
} from "@/types/appointment";

/**
 * Shared reading of a missed consultation, used by both the parent's claim
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

export function getRemedyLabel(t: Dictionary, remedy: RemedyKind): string {
  return remedy === "refund"
    ? t.doctorDashboard.remedyRefund
    : t.doctorDashboard.remedyFreeSession;
}

/** The parent-facing badge for a claim that has been raised. */
export function getRemedyStatusLabel(t: Dictionary, status: RemedyStatus): string {
  const map: Record<RemedyStatus, string> = {
    pending: t.appointments.remedyPendingBadge,
    approved: t.appointments.remedyApprovedBadge,
    declined: t.appointments.remedyDeclinedBadge,
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
