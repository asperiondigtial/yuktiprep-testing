import express from "express";
import { optionalUserAuthMiddleware } from "../middleware/userAuth.middleware.js";
import {
  getPublishedQuestions,
  getPublishedQuestionById,
  getMainsQuestions,
  getMainsQuestionById,
} from "../controllers/publishedQuestion.controller.js";

const router = express.Router();

router.use(optionalUserAuthMiddleware);

// Mains / Theory endpoints (no options / descriptive questions only)
router.get("/mains", getMainsQuestions);
router.get("/mains/:id", getMainsQuestionById);

// Prelims / Objective endpoints (multiple choice questions)
router.get("/", getPublishedQuestions);
router.get("/:id", getPublishedQuestionById);

export default router;
