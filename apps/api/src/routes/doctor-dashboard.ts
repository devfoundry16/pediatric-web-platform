import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getDoctorMe,
  getDoctorStats,
  getDoctorAppointments,
  startSession,
  completeAppointment,
  getDoctorPatients,
  getDoctorSchedule,
  updateDoctorSchedule,
  updateDoctorProfile,
  getDoctorHolidays,
  addDoctorHoliday,
  deleteDoctorHoliday,
  listRemedyRequests,
  resolveRemedyRequest,
} from "../controllers/doctor-dashboard";

const router = Router();

router.use(authMiddleware);

router.get("/me", getDoctorMe);
router.patch("/profile", updateDoctorProfile);
router.get("/stats", getDoctorStats);
router.get("/appointments", getDoctorAppointments);
router.patch("/appointments/:id/start", startSession);
router.patch("/appointments/:id/complete", completeAppointment);
router.get("/patients", getDoctorPatients);
router.get("/schedule", getDoctorSchedule);
router.put("/schedule", updateDoctorSchedule);
router.get("/holidays", getDoctorHolidays);
router.post("/holidays", addDoctorHoliday);
router.delete("/holidays/:id", deleteDoctorHoliday);
router.get("/refund-requests", listRemedyRequests);
router.patch("/refund-requests/:id", resolveRemedyRequest);

export default router;
