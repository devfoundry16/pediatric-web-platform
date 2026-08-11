/**
 * Durations and prices for the bookable consultation types, mirroring
 * public.consultation_types (seeded in migration 013, repriced in 016).
 *
 * Slot generation and booking MUST agree on the duration. They were previously
 * declared separately and drifted: slot generation used 45 minutes for
 * `consultation` while booking stored 30, so the grid stepped 55 minutes and
 * advertised fewer slots than the doctor could actually take.
 */
export const CONSULTATION_CONFIG: Record<string, { duration: number; price: number }> = {
  quick: { duration: 15, price: 150 },
  standard: { duration: 30, price: 250 },
  extended: { duration: 45, price: 350 },
  // Single bookable consultation (booking redesign 013; repriced in 016).
  consultation: { duration: 30, price: 350 },
};

/** Gap left between consecutive appointments when generating slots. */
export const BUFFER_MINUTES = 10;

/**
 * How long a `pending` (unpaid) appointment may hold its slot while the parent
 * completes Stripe checkout. After this the reservation is stale and no longer
 * blocks the slot, so an abandoned checkout can't lock a slot forever.
 */
export const PENDING_HOLD_MINUTES = 15;

/** Whether an existing appointment row still blocks its slot. */
export function isBlockingAppointment(
  appt: { status: string; payment_status: string; created_at: string },
  now: number = Date.now()
): boolean {
  const isStalePending =
    appt.status === "pending" &&
    appt.payment_status === "pending" &&
    new Date(appt.created_at).getTime() < now - PENDING_HOLD_MINUTES * 60 * 1000;
  return !isStalePending;
}
