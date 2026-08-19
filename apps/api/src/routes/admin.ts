import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import {
  getAdminStats,
  listUsers,
  getUser,
  updateUser,
  createUser,
  deleteUser,
  listAllAppointments,
  updateAppointmentAdmin,
  getDoctorScheduleAdmin,
  updateDoctorScheduleAdmin,
  getDoctorHolidaysAdmin,
  addDoctorHolidayAdmin,
  deleteDoctorHolidayAdmin,
  listConsultationTypes,
  createConsultationType,
  updateConsultationType,
  listPayments,
  listPatients,
  getPatient,
  listNotes,
  listEmailLogs,
  listDoctors,
  updateDoctorAdmin,
  createDoctorAdmin,
  linkDoctorAccountAdmin,
} from "../controllers/admin";
import { updateFeatureFlag } from "../controllers/feature-flags";
import {
  getCalendarStatus,
  startCalendarConnect,
  disconnectCalendar,
  listCalendarAccounts,
  listCalendarLogs,
} from "../controllers/google-calendar";

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// Stats
router.get("/stats", getAdminStats);

// Users
router.get("/users", listUsers);
router.post("/users", createUser);
router.get("/users/:id", getUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Appointments
router.get("/appointments", listAllAppointments);
router.patch("/appointments/:id", updateAppointmentAdmin);

// Doctors list (for dropdowns)
router.get("/doctors", listDoctors);
router.post("/doctors", createDoctorAdmin);
router.patch("/doctors/:doctorId", updateDoctorAdmin);
router.post("/doctors/:doctorId/account", linkDoctorAccountAdmin);

// Doctor availability
router.get("/doctors/:doctorId/schedule", getDoctorScheduleAdmin);
router.put("/doctors/:doctorId/schedule", updateDoctorScheduleAdmin);
router.get("/doctors/:doctorId/holidays", getDoctorHolidaysAdmin);
router.post("/doctors/:doctorId/holidays", addDoctorHolidayAdmin);
router.delete("/holidays/:holidayId", deleteDoctorHolidayAdmin);

// Consultation types
router.get("/consultation-types", listConsultationTypes);
router.post("/consultation-types", createConsultationType);
router.patch("/consultation-types/:id", updateConsultationType);

// Payments
router.get("/payments", listPayments);

// Patients
router.get("/patients", listPatients);
router.get("/patients/:id", getPatient);

// Notes
router.get("/notes", listNotes);

// Email logs
router.get("/email-logs", listEmailLogs);

// Google Calendar integration (clinic-wide account + oversight)
router.get("/google-calendar/status", getCalendarStatus);
router.post("/google-calendar/connect", startCalendarConnect);
router.delete("/google-calendar", disconnectCalendar);
router.get("/google-calendar/accounts", listCalendarAccounts);
router.get("/calendar-logs", listCalendarLogs);

// Feature flags ("coming soon" switches). Reading them is public — see
// GET /api/feature-flags — so only the write lives here.
router.patch("/feature-flags/:key", updateFeatureFlag);

export default router;
