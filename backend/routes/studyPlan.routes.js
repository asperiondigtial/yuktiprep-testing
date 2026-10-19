import express from "express";
import { userAuthMiddleware } from "../middleware/userAuth.middleware.js";
import {
  createOrContinueStudyPlan,
  getStudyPlansHistory,
  getStudyPlanDetails,
  askAiTutorQuestion,
  getContinueLearningHistory,
  getAiTutorSessionDetails,
  getAiTutorUsageStats,
} from "../controllers/studyPlan.controller.js";

const router = express.Router();

// Real-time daily quota usage
router.get("/usage", userAuthMiddleware, getAiTutorUsageStats);

// Continue learning combined history (Guru AI + Study Plans)
router.get("/history", userAuthMiddleware, getContinueLearningHistory);

// Guru AI sessions & questions
router.post("/ask", userAuthMiddleware, askAiTutorQuestion);
router.get("/sessions/:id", userAuthMiddleware, getAiTutorSessionDetails);

// Study planner routes
router.post("/", userAuthMiddleware, createOrContinueStudyPlan);
router.get("/", userAuthMiddleware, getStudyPlansHistory);
router.get("/:id", userAuthMiddleware, getStudyPlanDetails);

export default router;


