import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

/** Constant time, so the comparison cannot be used to recover the secret. */
function matches(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, so that is checked first —
  // the length of a bearer token is not worth protecting.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Guard for the cron routes.
 *
 * They run the sweeps that send mail, so anyone who can call them can make the
 * API email the clinic's patients. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` on every scheduled invocation and
 * nothing else is accepted; an unset secret closes the routes rather than
 * leaving a public trigger for the whole reminder sweep.
 */
export function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET is not configured" });
    return;
  }

  if (!matches(req.headers.authorization ?? "", `Bearer ${secret}`)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
