import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listSessions,
  getSession,
  getDoctorSessions,
  createSession,
  updateSession,
  cancelSession,
  goLive,
  endSession,
  registerForSession,
  getMyRegistrations,
  joinSession,
  verifySessionPayment,
} from "../controllers/group-sessions";

const router = Router();

// ─── Public (no auth required) ────────────────────────────────────────────────
router.get("/", listSessions);

// ─── Authenticated ─────────────────────────────────────────────────────────────
// Static sub-paths must be registered BEFORE the /:id wildcard.
// /user/* and /doctor/* are reserved sub-paths.
router.get("/user/registered", authMiddleware, getMyRegistrations);
router.get("/user/verify-payment", authMiddleware, verifySessionPayment);
router.get("/doctor/mine", authMiddleware, getDoctorSessions);
router.post("/", authMiddleware, createSession);

// Parameterized paths
router.get("/:id", getSession);
router.patch("/:id", authMiddleware, updateSession);
router.delete("/:id", authMiddleware, cancelSession);
router.patch("/:id/go-live", authMiddleware, goLive);
router.patch("/:id/end", authMiddleware, endSession);
router.post("/:id/register", authMiddleware, registerForSession);
router.get("/:id/join", authMiddleware, joinSession);

export default router;
