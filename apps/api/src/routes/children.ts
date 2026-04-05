import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listChildren,
  createChild,
  getChild,
  updateChild,
  deleteChild,
} from "../controllers/children";

const router = Router();

router.use(authMiddleware);

router.get("/", listChildren);
router.post("/", createChild);
router.get("/:id", getChild);
router.put("/:id", updateChild);
router.delete("/:id", deleteChild);

export default router;
