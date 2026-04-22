import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

/** Must be applied after authMiddleware. Rejects requests from non-admin users. */
export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", req.userId!)
    .single();

  if (profile?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
