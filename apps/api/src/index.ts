import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import childrenRouter from "./routes/children";
import doctorsRouter from "./routes/doctors";
import appointmentsRouter from "./routes/appointments";

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

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