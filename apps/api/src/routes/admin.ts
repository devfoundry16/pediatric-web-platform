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
  listUserPackages,
  listPatients,
  getPatient,
  listNotes,
  listEmailLogs,
  listDoctors,
  updateDoctorAdmin,
  createDoctorAdmin,
  linkDoctorAccountAdmin,
} from "../controllers/admin";
import {
  listAdminSettings,
  updateFeatureFlag,
} from "../controllers/feature-flags";
import { listCalendarAccounts, listCalendarLogs } from "../controllers/google-calendar";

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

// Purchased consultation packages
router.get("/packages", listUserPackages);

// Patients
router.get("/patients", listPatients);
router.get("/patients/:id", getPatient);

// Notes
router.get("/notes", listNotes);

// Email logs
router.get("/email-logs", listEmailLogs);

// Google Calendar oversight. Admins connect their OWN calendar through the
// shared /api/google-calendar routes; these are read-only views for support.
router.get("/google-calendar/accounts", listCalendarAccounts);
router.get("/calendar-logs", listCalendarLogs);

// Switches an admin controls. The "coming soon" section flags are readable
// publicly (GET /api/feature-flags) because the app needs them before anyone
// signs in; the operational settings are not, so they are read here. Both
// kinds are written through the same admin-only PATCH.
router.get("/settings", listAdminSettings);
router.patch("/feature-flags/:key", updateFeatureFlag);

export default router;
