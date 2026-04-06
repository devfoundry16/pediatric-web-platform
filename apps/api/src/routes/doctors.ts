import { Router } from "express";
import { listDoctors, getDoctorSlots } from "../controllers/doctors";

const router = Router();

router.get("/", listDoctors);
router.get("/:id/slots", getDoctorSlots);

export default router;
