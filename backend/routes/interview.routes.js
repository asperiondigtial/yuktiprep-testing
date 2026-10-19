import express from "express";
import multer from "multer";
import { userAuthMiddleware } from "../middleware/userAuth.middleware.js";
import {
  getExams,
  createSession,
  getSessionById,
  ingestEvent,
  tutorTurn,
  completeSession,
  getLearnerAnalytics,
  uploadSessionRecording,
} from "../controllers/interview.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150 MB max recording file
    fieldSize: 10 * 1024 * 1024,
  },
});

const router = express.Router();

// Public / Authenticated catalog
router.get("/exams", userAuthMiddleware, getExams);

// Sessions
router.post("/sessions", userAuthMiddleware, createSession);
router.get("/sessions/:id", userAuthMiddleware, getSessionById);
router.post("/sessions/:id/events", userAuthMiddleware, ingestEvent);
router.post("/sessions/:id/tutor", userAuthMiddleware, tutorTurn);
router.post("/sessions/:id/complete", userAuthMiddleware, completeSession);
router.post(
  "/sessions/:id/recording",
  userAuthMiddleware,
  (req, res, next) => {
    upload.single("recording")(req, res, (err) => {
      if (err) {
        console.warn("[Interview Recording Upload] Multer error:", err?.message || err);
        return errorResponse(res, err?.message || "File upload error", [], 400);
      }
      next();
    });
  },
  uploadSessionRecording
);

// Analytics
router.get("/analytics/me", userAuthMiddleware, getLearnerAnalytics);

export default router;
