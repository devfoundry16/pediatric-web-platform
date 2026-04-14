import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listPackages,
  createCheckoutSession,
  getMyPackages,
  getUsageLogs,
} from "../controllers/packages";

const router = Router();

// Public: list available packages
router.get("/", listPackages);

// POST /api/packages/webhook is registered in index.ts (raw body before express.json)

// Protected routes
router.post("/checkout", authMiddleware, createCheckoutSession);
router.get("/my", authMiddleware, getMyPackages);
router.get("/usage", authMiddleware, getUsageLogs);

export default router;
