import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import childrenRouter from "./routes/children";
import doctorsRouter from "./routes/doctors";
import appointmentsRouter from "./routes/appointments";
import doctorDashboardRouter from "./routes/doctor-dashboard";
import profileRouter from "./routes/profile";
import medicalRecordsRouter from "./routes/medical-records";
import medicalFilesRouter from "./routes/medical-files";
import packagesRouter from "./routes/packages";
import coursesRouter from "./routes/courses";
import groupSessionsRouter from "./routes/group-sessions";
import adminRouter from "./routes/admin";
import { stripeWebhook } from "./controllers/packages";

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Stripe webhook: raw body + registered before express.json() (signature verification)
app.use(
  "/api/packages/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Root endpoint
app.get("/", (_req, res) => {
  res.json({ 
    message: "Pediatric Telemedicine API",
    version: "1.0.0",
    status: "running"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/children", childrenRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/doctor", doctorDashboardRouter);
app.use("/api/profile", profileRouter);
app.use("/api/medical-records", medicalRecordsRouter);
app.use("/api/medical-files", medicalFilesRouter);
app.use("/api/packages", packagesRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/live-sessions", groupSessionsRouter);
app.use("/api/admin", adminRouter);

const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV === "DEVELOPMENT") {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 API endpoints: http://localhost:${PORT}/api`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;