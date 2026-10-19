import express from "express";
import { userAuthMiddleware } from "../middleware/userAuth.middleware.js";
import {
  getActiveExamGroups,
  saveUserExamSelection,
} from "../controllers/examSelection.controller.js";

const router = express.Router();

// Public: get all active exam groups and their options
router.get("/exam-groups", getActiveExamGroups);

// User: save selection and activate account
router.post("/users/me/exam-selection", userAuthMiddleware, saveUserExamSelection);

export default router;
