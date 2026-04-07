import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { syncPersonalProfile } from "../controllers/profile";

const router = Router();

router.use(authMiddleware);
router.patch("/", syncPersonalProfile);

export default router;
