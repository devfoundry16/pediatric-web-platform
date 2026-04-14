import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  listCourses,
  getCourse,
  enrollCourse,
  getMyEnrollments,
  streamLesson,
  markLessonComplete,
  getCreatedCourses,
  createCourse,
  updateCourse,
  getCourseLesson,
  addLesson,
  updateLesson,
  deleteLesson,
  getUploadUrl,
} from "../controllers/courses";

const router = Router();

// Public
router.get("/", listCourses);

// Auth-protected: must come before /:id to avoid route conflicts
router.get("/my", authMiddleware, getMyEnrollments);
router.get("/created", authMiddleware, getCreatedCourses);

// Public: course detail
router.get("/:id", getCourse);

// Auth-protected: enrollment & progress
router.post("/:id/enroll", authMiddleware, enrollCourse);
router.get("/:id/lessons/:lessonId/stream", authMiddleware, streamLesson);
router.post("/:id/lessons/:lessonId/progress", authMiddleware, markLessonComplete);

// Doctor: course management
router.post("/", authMiddleware, createCourse);
router.put("/:id", authMiddleware, updateCourse);
router.get("/:id/lessons", authMiddleware, getCourseLesson);
router.post("/:id/lessons", authMiddleware, addLesson);
router.put("/:id/lessons/:lessonId", authMiddleware, updateLesson);
router.delete("/:id/lessons/:lessonId", authMiddleware, deleteLesson);
router.post("/:id/upload-url", authMiddleware, getUploadUrl);

export default router;
