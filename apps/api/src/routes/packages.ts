import { Router, raw } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listPackages,
  createCheckoutSession,
  stripeWebhook,
  getMyPackages,
  getUsageLogs,
} from "../controllers/packages";

const router = Router();

// Public: list available packages
router.get("/", listPackages);

// Stripe webhook — must receive raw body for signature verification
router.post("/webhook", raw({ type: "application/json" }), stripeWebhook);

// Protected routes
router.post("/checkout", authMiddleware, createCheckoutSession);
router.get("/my", authMiddleware, getMyPackages);
router.get("/usage", authMiddleware, getUsageLogs);

export default router;
