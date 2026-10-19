import express from "express";
import {
  getTests,
  getTestDetails,
  generateTestWithAI,
  triggerSeed,
  submitTestAttempt,
  getAttempts,
  getAttemptDetails,
  getQuotaStatus,
  deleteTest,
} from "../controllers/test.controller.js";
import { userAuthMiddleware } from "../middleware/userAuth.middleware.js";
import { adminAuth } from "../middleware/adminAuth.js";
const router = express.Router();

// Mock tests list & single test retrieval
router.get("/", userAuthMiddleware, getTests);
router.get("/quota-status", userAuthMiddleware, getQuotaStatus);
router.get("/attempts", userAuthMiddleware, getAttempts);
router.get("/attempts/:id", userAuthMiddleware, getAttemptDetails);
router.get("/:id", userAuthMiddleware, getTestDetails);

// Test submission
router.post("/:id/submit", userAuthMiddleware, submitTestAttempt);

// Admin & AI generation
router.post("/generate-ai", adminAuth, generateTestWithAI);
router.post("/seed", adminAuth, triggerSeed);
router.delete("/:id", adminAuth, deleteTest);

export default router;
