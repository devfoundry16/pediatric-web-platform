import { Router } from "express";
import { requireCronSecret } from "../middleware/cron";
import { runCalendarSweep, runReminders } from "../controllers/cron";

const router = Router();

// GET rather than POST because Vercel Cron only issues GET requests. The shared
// secret, not the method, is what keeps these closed.
router.get("/reminders", requireCronSecret, runReminders);
router.get("/calendar-sweep", requireCronSecret, runCalendarSweep);

export default router;
