import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listMedicalRecords,
  getMedicalRecord,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
} from "../controllers/medical-records";

const router = Router();

router.use(authMiddleware);

router.get("/", listMedicalRecords);
router.post("/", createMedicalRecord);
router.get("/:id", getMedicalRecord);
router.patch("/:id", updateMedicalRecord);
router.delete("/:id", deleteMedicalRecord);

export default router;
