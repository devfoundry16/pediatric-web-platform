import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listMedicalFiles,
  createMedicalFile,
  deleteMedicalFile,
} from "../controllers/medical-files";

const router = Router();

router.use(authMiddleware);

router.get("/", listMedicalFiles);
router.post("/", createMedicalFile);
router.delete("/:id", deleteMedicalFile);

export default router;
