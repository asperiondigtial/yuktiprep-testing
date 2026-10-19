import express from "express";
import { authMiddleware as adminAuth } from "../../middleware/auth.middleware.js";
import {
  adminGetExamGroups,
  adminGetExamGroupById,
  adminCreateExamGroup,
  adminUpdateExamGroup,
  adminDeleteExamGroup,
  adminGetExamOptions,
  adminCreateExamOption,
  adminUpdateExamOption,
  adminDeleteExamOption,
} from "../../controllers/admin/examCategories.controller.js";

const router = express.Router();

// Admin authentication required for all routes
router.use(adminAuth);

// Exam Groups
router.get("/exam-groups", adminGetExamGroups);
router.post("/exam-groups", adminCreateExamGroup);
router.get("/exam-groups/:id", adminGetExamGroupById);
router.put("/exam-groups/:id", adminUpdateExamGroup);
router.delete("/exam-groups/:id", adminDeleteExamGroup);

// Exam Options
router.get("/exam-options", adminGetExamOptions);
router.post("/exam-options", adminCreateExamOption);
router.put("/exam-options/:id", adminUpdateExamOption);
router.delete("/exam-options/:id", adminDeleteExamOption);

export default router;
