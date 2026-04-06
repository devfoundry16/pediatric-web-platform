import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { AppointmentStatus } from "@/types/appointment";

export function getAppointmentStatusLabel(
  t: Dictionary,
  status: AppointmentStatus
): string {
  const map: Record<AppointmentStatus, string> = {
    pending: t.appointments.statusPending,
    confirmed: t.appointments.statusConfirmed,
    completed: t.appointments.statusCompleted,
    cancelled: t.appointments.statusCancelled,
    rescheduled: t.appointments.statusRescheduled,
  };
  return map[status] ?? status;
}
