import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listAppointments,
  getAppointment,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
} from "../controllers/appointments";

const router = Router();

router.use(authMiddleware);

router.get("/", listAppointments);
router.post("/", createAppointment);
router.get("/:id", getAppointment);
router.patch("/:id/cancel", cancelAppointment);
router.patch("/:id/reschedule", rescheduleAppointment);

export default router;
