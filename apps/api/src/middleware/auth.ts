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

  req.userId = user.id;
  next();
}
