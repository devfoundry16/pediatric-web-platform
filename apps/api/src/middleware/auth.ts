import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured: Supabase not initialized" });
    return;
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: error?.message ?? "Invalid or expired token" });
    return;
  }

  // A deactivated account keeps a valid token until it expires, so validating
  // the token is not enough. This is the single chokepoint for every
  // authenticated route (including admin ones, whose adminMiddleware only
  // checks the role), so the flag is checked here rather than per-router.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_active === false) {
    res.status(403).json({ error: "Account deactivated" });
    return;
  }

  req.userId = user.id;
  next();
}
