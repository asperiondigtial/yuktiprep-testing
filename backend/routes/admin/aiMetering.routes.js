import express from "express";
import { authMiddleware as adminAuth } from "../../middleware/auth.middleware.js";
import {
  getAiMeteringAnalytics,
  getUserAiMeteringDetails,
} from "../../controllers/adminAiMetering.controller.js";

const router = express.Router();

router.use(adminAuth);

// Analytics across all users
router.get("/analytics", getAiMeteringAnalytics);

// Specific user token & quota details
router.get("/users/:userId", getUserAiMeteringDetails);

export default router;
