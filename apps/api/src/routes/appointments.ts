import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listAppointments,
  getAppointment,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  joinAppointment,
} from "../controllers/appointments";

const router = Router();

router.use(authMiddleware);

router.get("/", listAppointments);
router.post("/", createAppointment);
router.get("/:id", getAppointment);
router.get("/:id/join", joinAppointment);
router.patch("/:id/cancel", cancelAppointment);
router.patch("/:id/reschedule", rescheduleAppointment);

export default router;
