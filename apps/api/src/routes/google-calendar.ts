import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  googleCalendarCallback,
  getMyCalendarStatus,
  startMyCalendarConnect,
  disconnectMyCalendar,
} from "../controllers/google-calendar";

const router = Router();

// Public by necessity: Google's consent redirect arrives as a plain browser
// navigation with no Authorization header. The signed state parameter (see
// signState/verifyState) authenticates the request instead, and a clinic-wide
// connect re-checks the admin role before storing anything.
// Registered before the authenticated routes so the middleware cannot swallow it.
router.get("/callback", googleCalendarCallback);

// Any signed-in user (parent or doctor) may connect their own calendar.
router.get("/status", authMiddleware, getMyCalendarStatus);
router.post("/connect", authMiddleware, startMyCalendarConnect);
router.delete("/", authMiddleware, disconnectMyCalendar);

export default router;
