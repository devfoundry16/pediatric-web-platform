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
} from "../controllers/admin";

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
router.patch("/doctors/:doctorId", updateDoctorAdmin);

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

export default router;
