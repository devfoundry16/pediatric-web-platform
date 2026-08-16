import { Router } from "express";
import { listFeatureFlags } from "../controllers/feature-flags";

const router = Router();

// Public: every visitor needs to know which sections are live.
// Writes live on the admin router (PATCH /api/admin/feature-flags/:key).
router.get("/", listFeatureFlags);

export default router;
