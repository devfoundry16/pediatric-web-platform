import axios from "axios";
import { isAuthError } from "@supabase/supabase-js";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * The API answers in English only (`{ error: "..." }`), and much of it is not
 * meant for end users (raw database errors, "x is required"). Error text is
 * therefore never shown as-is: the messages a user can act on are matched here
 * and translated, and everything else falls back to the caller's message.
 *
 * Keys are the API's exact strings — keep them in sync with apps/api when a
 * message changes, or it silently degrades to the fallback.
 */
const API_MESSAGES: Record<string, (t: Dictionary) => string> = {
  "The requested time slot is not available": (t) => t.errors.api.slotUnavailable,
  "This time slot is no longer available": (t) => t.errors.api.slotUnavailable,
  "That time is not available for this doctor": (t) => t.errors.api.slotUnavailable,
  "Already enrolled in this course": (t) => t.errors.api.alreadyEnrolled,
  "You must be enrolled to track progress": (t) => t.errors.api.mustEnroll,
  "That account is already linked to another doctor.": (t) => t.errors.api.accountLinkedToDoctor,
  "This date is already blocked": (t) => t.doctorDashboard.holidayDuplicate,
  "This consultation has ended": (t) => t.appointments.joinEnded,
  "This session has ended": (t) => t.liveSessions.joinEnded,
  "This session has already ended": (t) => t.errors.api.sessionEnded,
  "This session is full": (t) => t.errors.api.sessionFull,
  "This session is no longer available": (t) => t.errors.api.sessionUnavailable,
  "Already registered for this session": (t) => t.errors.api.alreadyRegistered,
  "You are the host of this session": (t) => t.errors.api.youAreHost,
  "Not authorized to join this appointment": (t) => t.errors.api.notAuthorizedToJoin,
  "This appointment is no longer scheduled": (t) => t.errors.api.appointmentNoLongerScheduled,
  "This booking is still awaiting payment": (t) => t.errors.api.bookingAwaitingPayment,
  "Payment not completed": (t) => t.errors.api.paymentNotCompleted,
  "This consultation has not been reviewed yet": (t) => t.errors.api.consultationNotReviewed,
  "Child not found or not owned by this user": (t) => t.errors.api.childNotFound,
  "You can only delete files you uploaded": (t) => t.errors.api.deleteOwnFilesOnly,
  "At least one active admin must remain.": (t) => t.errors.api.lastAdmin,
  "You cannot deactivate your own account.": (t) => t.errors.api.cannotDeactivateSelf,
  "You cannot delete your own account.": (t) => t.errors.api.cannotDeleteSelf,
  "You cannot remove your own admin role.": (t) => t.errors.api.cannotRemoveOwnAdmin,
  "Password must be at least 6 characters": (t) => t.errors.api.passwordTooShort,
  "End time must be after start time": (t) => t.errors.api.endAfterStart,
  "Invalid timezone": (t) => t.errors.api.invalidTimezone,
  // Supabase admin messages the API passes through when creating accounts.
  "A user with this email address has already been registered": (t) => t.errors.auth.emailExists,
  "Password should be at least 6 characters.": (t) => t.errors.api.passwordTooShort,
};

/** Translate a known API error string, or return null for anything else. */
export function translateApiMessage(t: Dictionary, message: string | null | undefined): string | null {
  if (!message) return null;
  return API_MESSAGES[message]?.(t) ?? null;
}

/**
 * Supabase auth error codes the UI can explain. The auth store keeps codes
 * rather than messages (it has no dictionary), and this turns them into text.
 */
export const AUTH_ERROR_CODES = {
  /** Sign-in refused because the account was deactivated (banned). */
  accountDeactivated: "ACCOUNT_DEACTIVATED",
  /** An action needing a session ran without one. */
  notSignedIn: "NOT_SIGNED_IN",
} as const;

export function getAuthErrorMessage(t: Dictionary, code: string | null | undefined): string {
  switch (code) {
    case AUTH_ERROR_CODES.accountDeactivated:
    case "user_banned":
      return t.auth.accountDeactivated;
    case "invalid_credentials":
      return t.errors.auth.invalidCredentials;
    case "email_not_confirmed":
      return t.errors.auth.emailNotConfirmed;
    case "user_already_exists":
    case "email_exists":
    case "identity_already_exists":
      return t.errors.auth.emailExists;
    case "weak_password":
      return t.errors.auth.weakPassword;
    case "same_password":
      return t.errors.auth.samePassword;
    case "email_address_invalid":
    case "email_address_not_authorized":
      return t.errors.auth.invalidEmail;
    case "signup_disabled":
    case "email_provider_disabled":
      return t.errors.auth.signupDisabled;
    case "reauthentication_needed":
    case "reauthentication_not_valid":
      return t.errors.auth.reauthNeeded;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return t.errors.tooManyRequests;
    case AUTH_ERROR_CODES.notSignedIn:
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return t.errors.sessionExpired;
    case "network":
      return t.errors.network;
    default:
      return t.errors.generic;
  }
}

/**
 * The message to show for a caught error. Never returns the raw error text:
 * axios's own message ("Request failed with status code 409") and unknown API
 * strings are English and often technical.
 */
export function getErrorMessage(err: unknown, t: Dictionary, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return t.errors.network;
    if (err.response.status === 429) return t.errors.tooManyRequests;
    const body = err.response.data as { error?: unknown } | undefined;
    const known = typeof body?.error === "string" ? translateApiMessage(t, body.error) : null;
    return known ?? fallback;
  }
  if (isAuthError(err)) {
    return err.code ? getAuthErrorMessage(t, err.code) : fallback;
  }
  return fallback;
}
